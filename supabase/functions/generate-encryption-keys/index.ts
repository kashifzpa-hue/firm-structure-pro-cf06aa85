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

    const { mode, workspace_id } = await req.json();

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
      const result = await generateKeyForWorkspace(supabaseAdmin, workspace_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // seed_existing
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id");
    if (wsErr) throw wsErr;

    const { data: existingKeys, error: ekErr } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .select("workspace_id");
    if (ekErr) throw ekErr;

    const existingSet = new Set((existingKeys || []).map((k: any) => k.workspace_id));
    let generated = 0;
    const errors: string[] = [];

    for (const ws of workspaces || []) {
      if (existingSet.has(ws.id)) continue;
      const result = await generateKeyForWorkspace(supabaseAdmin, ws.id);
      if (result.success) {
        generated++;
      } else {
        errors.push(`${ws.id}: ${result.error}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated,
        skipped: (workspaces?.length || 0) - generated - errors.length,
        total_workspaces: workspaces?.length || 0,
        errors: errors.length > 0 ? errors : undefined,
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

async function generateKeyForWorkspace(
  supabaseAdmin: any,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Idempotent: skip if key exists
    const { data: existing } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (existing) {
      return { success: true };
    }

    // Generate 256-bit key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const keyBase64 = btoa(String.fromCharCode(...keyBytes));
    const keyName = `workspace_key_${workspaceId}`;

    // Store in Vault via RPC
    const { error: vaultErr } = await supabaseAdmin.rpc("vault_insert_secret", {
      _name: keyName,
      _secret: keyBase64,
    });

    if (vaultErr) {
      throw new Error(`Vault insert failed: ${vaultErr.message}`);
    }

    // Record key reference
    const { error: insertErr } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .insert({
        workspace_id: workspaceId,
        key_reference: keyName,
        encryption_version: 1,
      });

    if (insertErr) {
      throw new Error(`Key reference insert failed: ${insertErr.message}`);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
