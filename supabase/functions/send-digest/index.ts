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

    if (!resendApiKey) {
      return new Response(JSON.stringify({ message: "RESEND_API_KEY not configured, skipping digest" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: workspaces } = await supabase.from("workspaces").select("id, name");
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const ws of workspaces) {
      // Check if digest rule is active
      const { data: digestRule } = await supabase
        .from("alert_rules")
        .select("*")
        .eq("workspace_id", ws.id)
        .eq("is_active", true)
        .eq("rule_type", "SYSTEM_ALERT")
        .limit(1);

      if (!digestRule?.length || !digestRule[0].notify_email) continue;

      // Collect counts
      const { data: docs } = await supabase
        .from("documents")
        .select("expiry_date")
        .eq("workspace_id", ws.id)
        .not("expiry_date", "is", null);

      let expiredCount = 0, expiring30 = 0, expiring90 = 0;
      for (const doc of (docs || [])) {
        const diff = Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diff < 0) expiredCount++;
        else if (diff <= 30) expiring30++;
        else if (diff <= 90) expiring90++;
      }

      const { data: drafts } = await supabase
        .from("movements")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("status", "draft");
      const draftCount = (drafts || []).length;

      const { data: ubos } = await supabase
        .from("ubo_snapshots")
        .select("id, person_entity_id")
        .eq("workspace_id", ws.id)
        .eq("snapshot_type", "live")
        .eq("is_above_threshold", true)
        .eq("calculation_error", false);
      const uboCount = (ubos || []).length;

      // UBOs with expired docs
      const uboPersonIds = [...new Set((ubos || []).map((u: any) => u.person_entity_id).filter(Boolean))];
      let uboExpiredCount = 0;
      if (uboPersonIds.length > 0) {
        const { data: uboDocs } = await supabase
          .from("documents")
          .select("expiry_date")
          .in("entity_id", uboPersonIds)
          .eq("workspace_id", ws.id)
          .in("document_type", ["Passport", "Emirates ID"]);
        uboExpiredCount = (uboDocs || []).filter((d: any) => {
          const diff = Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return diff < 0;
        }).length;
      }

      // Shareholding gaps
      const { data: shareClasses } = await supabase.from("share_classes").select("id, total_shares_issued").eq("workspace_id", ws.id);
      const { data: equityLinks } = await supabase.from("equity_links").select("share_class_id, shares_owned").eq("workspace_id", ws.id).is("end_date", null);
      let gapCount = 0;
      for (const sc of (shareClasses || [])) {
        const allocated = (equityLinks || []).filter((l: any) => l.share_class_id === sc.id).reduce((s: number, l: any) => s + (l.shares_owned || 0), 0);
        if (allocated < sc.total_shares_issued) gapCount++;
      }

      const totalIssues = expiredCount + expiring30 + expiring90 + draftCount + uboExpiredCount + gapCount;
      if (totalIssues === 0) continue; // Skip clean workspaces

      // Get admin emails
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("workspace_id", ws.id).eq("role", "admin");
      const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);
      const { data: adminProfiles } = adminUserIds.length > 0
        ? await supabase.from("profiles").select("email").in("user_id", adminUserIds)
        : { data: [] };

      const emails = [
        ...(adminProfiles || []).map((p: any) => p.email).filter(Boolean),
        ...(digestRule[0].additional_emails || []),
      ];

      if (!emails.length) continue;

      const senderEmail = digestRule[0].sender_email || "noreply@corpsync.app";
      const subject = `CorpSync Weekly Compliance Summary — ${ws.name}`;

      const htmlBody = `
        <h2>Weekly Compliance Summary — ${ws.name}</h2>
        <p>Here is your weekly compliance summary:</p>
        <h3>📄 Documents</h3>
        <ul>
          <li>Expired: <strong>${expiredCount}</strong></li>
          <li>Expiring in 30 days: <strong>${expiring30}</strong></li>
          <li>Expiring in 31-90 days: <strong>${expiring90}</strong></li>
        </ul>
        <h3>📋 Movements</h3>
        <ul><li>Draft movements pending: <strong>${draftCount}</strong></li></ul>
        <h3>🛡 UBO Status</h3>
        <ul>
          <li>UBOs above 25% threshold: <strong>${uboCount}</strong></li>
          <li>UBOs with expired documents: <strong>${uboExpiredCount}</strong></li>
        </ul>
        <h3>📊 Shareholding</h3>
        <ul><li>Companies with shareholding gaps: <strong>${gapCount}</strong></li></ul>
        <hr />
        <p>To manage your alert preferences, visit Settings → Alert Rules.</p>
        <p style="color: #666;">This digest was generated by CorpSync on ${today}.</p>
      `;

      const textBody = `Weekly Compliance Summary — ${ws.name}\n\nDocuments: ${expiredCount} expired, ${expiring30} expiring in 30 days, ${expiring90} expiring in 31-90 days.\nDraft movements: ${draftCount}\nUBOs above 25%: ${uboCount}, with expired docs: ${uboExpiredCount}\nShareholding gaps: ${gapCount}`;

      for (const email of emails) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: `CorpSync <${senderEmail}>`,
              to: [email],
              subject,
              html: htmlBody,
              text: textBody,
            }),
          });
          totalSent++;
        } catch (err) {
          console.error("Digest email send failed:", err);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Weekly digest complete", emailsSent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-digest error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
