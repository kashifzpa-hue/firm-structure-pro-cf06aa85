import { corsFor, requireInternalAuth } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Scheduled job: operates across all workspaces with the service role.
  const denied = await requireInternalAuth(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: workspaces } = await supabase.from("workspaces").select("id, name");
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    let totalCreated = 0;

    for (const ws of workspaces) {
      const { data: rules } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("is_active", true)
        .eq("rule_type", "UBO_THRESHOLD_BREACH");

      if (!rules?.length) continue;

      // Get UBOs above threshold
      const { data: ubos } = await supabase
        .from("ubo_snapshots")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("snapshot_type", "live")
        .eq("is_above_threshold", true)
        .eq("calculation_error", false);

      if (!ubos?.length) continue;

      const personIds = [...new Set(ubos.map((u: any) => u.person_entity_id).filter(Boolean))];
      if (!personIds.length) continue;

      // Get passports/IDs for these persons
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("workspace_id", ws.id)
        .in("entity_id", personIds)
        .in("document_type", ["Passport", "Emirates ID", "National ID"]);

      // Get entity names
      const { data: entities } = await supabase.from("entities").select("id, name").eq("workspace_id", ws.id);
      const entityMap = Object.fromEntries((entities || []).map((e: any) => [e.id, e.name]));

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("workspace_id", ws.id).eq("role", "admin");
      const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);
      const { data: adminProfiles } = adminUserIds.length > 0
        ? await supabase.from("profiles").select("id, email").in("user_id", adminUserIds)
        : { data: [] };

      for (const ubo of ubos) {
        if (!ubo.person_entity_id) continue;

        const personDocs = (docs || []).filter((d: any) => d.entity_id === ubo.person_entity_id);
        const problematicDocs = personDocs.filter((d: any) => {
          if (!d.expiry_date) return false;
          const diffDays = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return diffDays < 60; // expired or expiring within 60 days
        });

        if (!problematicDocs.length) continue;

        for (const doc of problematicDocs) {
          // Duplicate check
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("document_id", doc.id)
            .eq("notification_type", "UBO_THRESHOLD_BREACH")
            .gte("created_at", today + "T00:00:00Z")
            .lte("created_at", today + "T23:59:59Z")
            .limit(1);

          if (existing?.length) continue;

          const personName = entityMap[ubo.person_entity_id] || "Unknown";
          const companyName = entityMap[ubo.company_entity_id] || "Unknown";
          const diffDays = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const isExpired = diffDays < 0;
          const statusText = isExpired ? `Expired (${Math.abs(diffDays)} days overdue)` : `Expiring in ${diffDays} days`;

          const title = `UBO Alert: ${personName} — ${companyName}`;
          const body = `${personName} is a UBO in ${companyName} with ${Number(ubo.effective_economic_pct).toFixed(2)}% ownership (above 25% threshold). ${doc.document_type}: ${statusText}. Immediate action recommended under UAE Federal Decree-Law No. 13 of 2023.`;

          for (const rule of rules) {
            for (const profile of (adminProfiles || [])) {
              await supabase.from("notifications").insert({
                workspace_id: ws.id,
                recipient_user_id: profile.id,
                notification_type: "UBO_THRESHOLD_BREACH",
                title,
                body,
                entity_id: ubo.person_entity_id,
                document_id: doc.id,
                action_url: "/ubo",
              });
              totalCreated++;
            }

            if (rule.notify_email && resendApiKey) {
              const emails = [
                ...(adminProfiles || []).map((p: any) => p.email).filter(Boolean),
                ...(rule.additional_emails || []),
              ];
              const senderEmail = rule.sender_email || "onboarding@resend.dev";

              for (const email of emails) {
                try {
                  await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
                    body: JSON.stringify({
                      from: `CorpSync <${senderEmail}>`,
                      to: [email],
                      subject: `[Compliance Alert] UBO Document Issue — ${companyName} — CorpSync`,
                      html: `<h2>${title}</h2><p>${body}</p><hr /><p style="color:#666;">This alert was generated by CorpSync on behalf of ${ws.name}.</p>`,
                      text: body,
                    }),
                  });
                } catch (err) {
                  console.error("Email send failed:", err);
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "UBO alerts check complete", notifications: totalCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-ubo-alerts error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
