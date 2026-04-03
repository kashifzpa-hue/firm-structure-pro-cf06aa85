import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: internal secret or service role key
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    const providedSecret = req.headers.get("x-internal-secret");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");

    const isAuthorized =
      (internalSecret && providedSecret === internalSecret) ||
      (serviceRoleKey && authHeader === serviceRoleKey);

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, workspace_id, enabled_by } = await req.json();

    if (!mode || !["seed_existing", "single"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use 'seed_existing' or 'single'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "single" && !workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id required for single mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (mode === "single") {
      const { error } = await supabaseAdmin
        .from("workspace_encryption_keys")
        .upsert(
          {
            workspace_id,
            encryption_version: 1,
            enabled_by: enabled_by || null,
          },
          { onConflict: "workspace_id", ignoreDuplicates: true }
        );

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, workspace_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // seed_existing
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id");
    if (wsErr) throw wsErr;

    const { data: existing, error: ekErr } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .select("workspace_id");
    if (ekErr) throw ekErr;

    const existingSet = new Set((existing || []).map((k: any) => k.workspace_id));
    let registered = 0;

    for (const ws of workspaces || []) {
      if (existingSet.has(ws.id)) continue;

      const { error } = await supabaseAdmin
        .from("workspace_encryption_keys")
        .insert({
          workspace_id: ws.id,
          encryption_version: 1,
        });

      if (!error) registered++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        registered,
        total_workspaces: workspaces?.length || 0,
        already_registered: existingSet.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
