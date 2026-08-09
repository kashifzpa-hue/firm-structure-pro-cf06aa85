import { corsFor, requireInternalAuth } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";


Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Scheduled job: operates across all workspaces with the service role.
  const denied = requireInternalAuth(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find equity_links with disposal_required = true and upcoming/overdue deadlines
    const { data: links, error: linksErr } = await supabase
      .from("equity_links")
      .select("id, owner_entity_id, owned_entity_id, workspace_id, disposal_deadline, disposal_jurisdiction, circular_ownership_type")
      .eq("disposal_required", true)
      .not("disposal_deadline", "is", null)
      .is("end_date", null);

    if (linksErr) throw linksErr;
    if (!links || links.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let created = 0;

    for (const link of links) {
      const deadline = new Date(link.disposal_deadline);
      deadline.setHours(0, 0, 0, 0);
      const diffMs = deadline.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let notificationType: string | null = null;
      let title = "";
      let body = "";

      // Get entity names
      const [{ data: owner }, { data: owned }] = await Promise.all([
        supabase.from("entities").select("name").eq("id", link.owner_entity_id).single(),
        supabase.from("entities").select("name").eq("id", link.owned_entity_id).single(),
      ]);

      const ownerName = owner?.name || "Unknown";
      const ownedName = owned?.name || "Unknown";
      const jurisdiction = link.disposal_jurisdiction || "applicable";

      if (diffDays < 0) {
        // Overdue
        notificationType = "CIRCULAR_DISPOSAL_OVERDUE";
        title = `⚠ Circular Disposal Overdue — ${ownerName}`;
        body = `${ownerName} was required to dispose of shares in ${ownedName} by ${link.disposal_deadline}. ${Math.abs(diffDays)} days overdue. Legal advice required.`;
      } else if (diffDays <= 30) {
        // Due soon
        notificationType = "CIRCULAR_DISPOSAL_DUE";
        title = `Circular Disposal Due — ${ownerName}`;
        body = `${ownerName} holds shares in ${ownedName} (its parent company). Disposal required by ${jurisdiction} law. Deadline: ${link.disposal_deadline} (${diffDays} days remaining).`;
      }

      if (!notificationType) continue;

      // Check if we already sent this notification today
      const todayStr = now.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("workspace_id", link.workspace_id)
        .eq("notification_type", notificationType)
        .eq("entity_id", link.owner_entity_id)
        .gte("created_at", todayStr)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Get all workspace users for notification
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("workspace_id", link.workspace_id);

      for (const profile of (profiles || [])) {
        await supabase.from("notifications").insert({
          workspace_id: link.workspace_id,
          notification_type: notificationType,
          title,
          body,
          entity_id: link.owner_entity_id,
          recipient_user_id: profile.id,
          action_url: `/entities/${link.owner_entity_id}`,
        });
      }
      created++;
    }

    return new Response(JSON.stringify({ processed: links.length, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
