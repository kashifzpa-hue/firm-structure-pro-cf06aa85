import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const demoPassword = Deno.env.get("DEMO_USER_PASSWORD");

    if (!demoPassword) {
      return new Response(JSON.stringify({ error: "DEMO_USER_PASSWORD secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const demoEmail = "demo@corpsync.app";

    // Check if demo user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === demoEmail);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("Demo user already exists:", userId);
    } else {
      // Create the auth user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
        user_metadata: { full_name: "Demo Viewer" },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      console.log("Created demo user:", userId);

      // Wait for handle_new_user trigger to create profile
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Get the existing workspace (first workspace found)
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id, name")
      .limit(1)
      .single();

    if (wsError || !workspaces) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = workspaces.id;

    // Update profile to link to workspace
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ workspace_id: workspaceId })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Upsert viewer role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, workspace_id: workspaceId, role: "viewer" });

      if (roleError) {
        console.error("Role insert error:", roleError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        workspace_id: workspaceId,
        workspace_name: workspaces.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
