import { corsFor, requireInternalAuth } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Scheduled job: operates across all workspaces with the service role.
  const denied = requireInternalAuth(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: workspaces } = await supabase.from("workspaces").select("id, name").eq("banking_enabled", true);
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No banking-enabled workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    let totalCreated = 0;
    let totalEmails = 0;

    for (const ws of workspaces) {
      // Get alert rules for signatory types
      const { data: rules } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("is_active", true)
        .in("rule_type", ["SIGNATORY_EXPIRING", "BANK_ACK_PENDING"]);

      if (!rules?.length) continue;

      // Get admin profiles for notifications
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("workspace_id", ws.id)
        .eq("role", "admin");

      const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);
      const { data: adminProfiles } = adminUserIds.length > 0
        ? await supabase.from("profiles").select("id, email, user_id").in("user_id", adminUserIds)
        : { data: [] };

      // Get active signatories with related data
      const { data: signatories } = await supabase
        .from("signatories")
        .select("*, bank_account:bank_accounts!signatories_bank_account_id_fkey(bank_name, company_entity_id), person:entities!signatories_person_entity_id_fkey(name)")
        .eq("workspace_id", ws.id)
        .eq("status", "active");

      if (!signatories?.length) continue;

      // Get company names
      const companyIds = [...new Set((signatories || []).map((s: any) => s.bank_account?.company_entity_id).filter(Boolean))];
      const { data: companies } = companyIds.length > 0
        ? await supabase.from("entities").select("id, name").in("id", companyIds)
        : { data: [] };
      const companyMap = Object.fromEntries((companies || []).map((c: any) => [c.id, c.name]));

      for (const rule of rules) {
        if (rule.rule_type === "SIGNATORY_EXPIRING") {
          const thresholdDays = rule.threshold_days || 30;
          
          for (const sig of signatories) {
            if (!sig.expiry_date) continue;
            
            const expiryDate = new Date(sig.expiry_date);
            const todayDate = new Date(today);
            const diffDays = Math.ceil((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays > thresholdDays) continue;

            // Check duplicate
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("entity_id", sig.person_entity_id)
              .eq("notification_type", "SIGNATORY_EXPIRING")
              .gte("created_at", today + "T00:00:00Z")
              .lte("created_at", today + "T23:59:59Z")
              .limit(1);

            if (existing?.length) continue;

            const personName = (sig.person as any)?.name || "Unknown";
            const bankName = (sig.bank_account as any)?.bank_name || "Unknown";
            const companyName = companyMap[(sig.bank_account as any)?.company_entity_id] || "Unknown";
            const isExpired = diffDays < 0;

            const title = "Signatory Authority " + (isExpired ? "Expired" : "Expiring");
            const body = `${personName}'s signatory authority at ${bankName} for ${companyName} ${isExpired ? "expired on" : "expires on"} ${sig.expiry_date}.`;

            for (const profile of (adminProfiles || [])) {
              await supabase.from("notifications").insert({
                workspace_id: ws.id,
                recipient_user_id: profile.id,
                notification_type: "SIGNATORY_EXPIRING",
                title,
                body,
                entity_id: sig.person_entity_id,
                action_url: `/bank-accounts/${sig.bank_account_id}`,
              });
              totalCreated++;
            }

            // Send email if enabled
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
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                      from: `CorpSync <${senderEmail}>`,
                      to: [email],
                      subject: `[Action Required] Signatory Authority ${isExpired ? "Expired" : "Expiring"} — ${companyName} — CorpSync`,
                      html: `<h2>${title}</h2><p>${body}</p><p>A new Board Resolution may be required.</p><hr/><p style="color:#666;">Generated by CorpSync on behalf of ${ws.name}.</p>`,
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

        if (rule.rule_type === "BANK_ACK_PENDING") {
          const thresholdDays = rule.threshold_days || 14;

          for (const sig of signatories) {
            if (sig.bank_acknowledged_date) continue;
            
            const createdDate = new Date(sig.created_at);
            const todayDate = new Date(today);
            const daysSinceCreation = Math.ceil((todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceCreation < thresholdDays) continue;

            // Check duplicate
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("entity_id", sig.person_entity_id)
              .eq("notification_type", "BANK_ACK_PENDING")
              .gte("created_at", today + "T00:00:00Z")
              .lte("created_at", today + "T23:59:59Z")
              .limit(1);

            if (existing?.length) continue;

            const personName = (sig.person as any)?.name || "Unknown";
            const bankName = (sig.bank_account as any)?.bank_name || "Unknown";

            const title = "Bank Acknowledgement Pending";
            const body = `${personName}'s authority at ${bankName} was added ${daysSinceCreation} days ago but bank acknowledgement not recorded.`;

            for (const profile of (adminProfiles || [])) {
              await supabase.from("notifications").insert({
                workspace_id: ws.id,
                recipient_user_id: profile.id,
                notification_type: "BANK_ACK_PENDING",
                title,
                body,
                entity_id: sig.person_entity_id,
                action_url: `/bank-accounts/${sig.bank_account_id}`,
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
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${resendApiKey}`,
                    },
                    body: JSON.stringify({
                      from: `CorpSync <${senderEmail}>`,
                      to: [email],
                      subject: `[Follow Up] Bank Acknowledgement Pending — CorpSync`,
                      html: `<h2>${title}</h2><p>${body}</p><hr/><p style="color:#666;">Generated by CorpSync on behalf of ${ws.name}.</p>`,
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
    }

    return new Response(
      JSON.stringify({ message: "Signatory expiry check complete", notifications: totalCreated, emails: totalEmails }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-signatory-expiry error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
