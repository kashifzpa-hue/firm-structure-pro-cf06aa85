import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all workspaces
    const { data: workspaces } = await supabase.from("workspaces").select("id, name");
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    let totalCreated = 0;
    let totalEmails = 0;

    for (const ws of workspaces) {
      // Get active document expiry rules
      const { data: rules } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("is_active", true)
        .in("rule_type", ["DOCUMENT_EXPIRED", "DOCUMENT_EXPIRING_SOON"]);

      if (!rules?.length) continue;

      // Get all documents with expiry dates
      const { data: docs } = await supabase
        .from("documents")
        .select("*, entities!inner(id, name, type)")
        .eq("workspace_id", ws.id)
        .not("expiry_date", "is", null);

      if (!docs?.length) continue;

      // Get admin users for email
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("workspace_id", ws.id)
        .eq("role", "admin");

      const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);

      const { data: adminProfiles } = adminUserIds.length > 0
        ? await supabase.from("profiles").select("id, email, user_id").in("user_id", adminUserIds)
        : { data: [] };

      // Get appointments for context
      const { data: appointments } = await supabase
        .from("appointments")
        .select("person_entity_id, role_title, company:entities!appointments_company_entity_id_fkey(name)")
        .eq("workspace_id", ws.id)
        .is("resignation_date", null);

      // Get UBO data for context
      const { data: uboData } = await supabase
        .from("ubo_snapshots")
        .select("person_entity_id, company_entity_id, effective_economic_pct")
        .eq("workspace_id", ws.id)
        .eq("snapshot_type", "live")
        .eq("is_above_threshold", true);

      // Get entity names for UBO context
      const { data: entities } = await supabase
        .from("entities")
        .select("id, name")
        .eq("workspace_id", ws.id);

      const entityMap = Object.fromEntries((entities || []).map((e: any) => [e.id, e.name]));

      for (const rule of rules) {
        for (const doc of docs) {
          const expiryDate = new Date(doc.expiry_date);
          const todayDate = new Date(today);
          const diffDays = Math.ceil((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

          let notificationType: string | null = null;
          if (rule.rule_type === "DOCUMENT_EXPIRED" && diffDays < 0) {
            notificationType = "DOCUMENT_EXPIRED";
          } else if (rule.rule_type === "DOCUMENT_EXPIRING_SOON" && rule.threshold_days && diffDays >= 0 && diffDays <= rule.threshold_days) {
            notificationType = "DOCUMENT_EXPIRING_SOON";
          }

          if (!notificationType) continue;

          // Check duplicate for today
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("document_id", doc.id)
            .eq("notification_type", notificationType)
            .gte("created_at", today + "T00:00:00Z")
            .lte("created_at", today + "T23:59:59Z")
            .limit(1);

          if (existing?.length) continue;

          const entityName = (doc.entities as any)?.name || "Unknown";
          const isExpired = notificationType === "DOCUMENT_EXPIRED";
          const title = isExpired
            ? `Expired: ${doc.document_type} — ${entityName}`
            : `Expiring in ${diffDays} days: ${doc.document_type} — ${entityName}`;

          // Build context for roles
          const personAppts = (appointments || [])
            .filter((a: any) => a.person_entity_id === doc.entity_id)
            .map((a: any) => `${a.role_title} at ${(a.company as any)?.name || "Unknown"}`);

          const personUbo = (uboData || [])
            .filter((u: any) => u.person_entity_id === doc.entity_id)
            .map((u: any) => `UBO in ${entityMap[u.company_entity_id] || "Unknown"} (${Number(u.effective_economic_pct).toFixed(2)}%)`);

          let body = isExpired
            ? `${doc.document_type} for ${entityName} expired on ${doc.expiry_date} (${Math.abs(diffDays)} days overdue).`
            : `${doc.document_type} for ${entityName} expires on ${doc.expiry_date} (${diffDays} days remaining).`;

          if (personAppts.length > 0) body += ` Active roles: ${personAppts.join(", ")}.`;
          if (personUbo.length > 0) body += ` ${personUbo.join(". ")}.`;

          // Create notification for each admin
          for (const profile of (adminProfiles || [])) {
            await supabase.from("notifications").insert({
              workspace_id: ws.id,
              recipient_user_id: profile.id,
              notification_type: notificationType,
              title,
              body,
              entity_id: doc.entity_id,
              document_id: doc.id,
              action_url: `/entities/${doc.entity_id}`,
            });
            totalCreated++;
          }

          // Send email if enabled
          if (rule.notify_email && resendApiKey) {
            const emails = [
              ...(adminProfiles || []).map((p: any) => p.email).filter(Boolean),
              ...(rule.additional_emails || []),
            ];

            const senderEmail = rule.sender_email || "noreply@corpsync.app";
            const subject = isExpired
              ? `[URGENT] Expired Document — ${entityName} — CorpSync`
              : `[Action Required] Document Expiring in ${diffDays} days — ${entityName} — CorpSync`;

            const htmlBody = `
              <h2>${title}</h2>
              <p><strong>Entity:</strong> ${entityName}</p>
              <p><strong>Document Type:</strong> ${doc.document_type}</p>
              <p><strong>Document Number:</strong> ${doc.document_number || "N/A"}</p>
              <p><strong>Expiry Date:</strong> ${doc.expiry_date} ${isExpired ? `(${Math.abs(diffDays)} days overdue)` : `(${diffDays} days remaining)`}</p>
              ${personAppts.length > 0 ? `<p><strong>Active Roles:</strong> ${personAppts.join(", ")}</p>` : ""}
              ${personUbo.length > 0 ? `<p><strong>UBO Status:</strong> ${personUbo.join("; ")}</p>` : ""}
              <p><strong>Action Required:</strong> Please renew this document and upload the new version to CorpSync.</p>
              <hr />
              <p style="color: #666;">This alert was generated by CorpSync on behalf of ${ws.name}.</p>
            `;

            for (const email of emails) {
              try {
                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${resendApiKey}`,
                  },
                  body: JSON.stringify({
                    from: `CorpSync <${senderEmail}>`,
                    to: [email],
                    subject,
                    html: htmlBody,
                    text: body,
                  }),
                });
                totalEmails++;
              } catch (err) {
                console.error("Email send failed:", err);
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Document expiry check complete", notifications: totalCreated, emails: totalEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-document-expiry error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
