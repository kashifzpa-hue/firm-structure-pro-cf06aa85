import { corsFor } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";


const DEMO_EMAIL = "demo@corpsync.app";
const DEMO_NAME = "Demo Viewer";
const PUBLIC_DEMO_PASSWORD = "CorpSync-Demo-2026";

type DemoCredentialCheck = {
  ok: boolean;
  status: number;
  message?: string;
};

async function verifyDemoCredentials(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<DemoCredentialCheck> {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const responseText = await response.text();

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  return {
    ok: false,
    status: response.status,
    message: responseText,
  };
}

async function ensureDemoProfileAndRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
) {
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileLookupError) {
    throw profileLookupError;
  }

  if (existingProfile) {
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        email: DEMO_EMAIL,
        full_name: DEMO_NAME,
        workspace_id: workspaceId,
      })
      .eq("user_id", userId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }
  } else {
    const { error: profileInsertError } = await supabase.from("profiles").insert({
      user_id: userId,
      email: DEMO_EMAIL,
      full_name: DEMO_NAME,
      workspace_id: workspaceId,
    });

    if (profileInsertError) {
      throw profileInsertError;
    }
  }

  const { data: existingRole, error: roleLookupError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (roleLookupError) {
    throw roleLookupError;
  }

  if (!existingRole) {
    const { error: roleInsertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, workspace_id: workspaceId, role: "viewer" });

    if (roleInsertError) {
      throw roleInsertError;
    }
  }
}

async function recreateDemoUser(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  existingUserId?: string,
) {
  if (existingUserId) {
    const { error: roleDeleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", existingUserId);

    if (roleDeleteError) {
      throw roleDeleteError;
    }

    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", existingUserId);

    if (profileDeleteError) {
      throw profileDeleteError;
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(existingUserId, false);

    if (deleteUserError) {
      throw deleteUserError;
    }
  }

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: PUBLIC_DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_NAME },
  });

  if (createError || !newUser?.user?.id) {
    throw createError ?? new Error("Failed to create demo user");
  }

  await ensureDemoProfileAndRole(supabase, newUser.user.id, workspaceId);
  return newUser.user.id;
}

// Simple per-instance throttle: this endpoint is unauthenticated by design
// (it provisions/repairs the public demo account) but performs admin auth work,
// so it must not be callable in a tight loop.
const RATE_LIMIT_WINDOW_MS = 30_000;
const RATE_LIMIT_MAX = 5;
const callTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > RATE_LIMIT_WINDOW_MS) callTimestamps.shift();
  if (callTimestamps.length >= RATE_LIMIT_MAX) return true;
  callTimestamps.push(now);
  return false;
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (isRateLimited()) {
    return new Response(JSON.stringify({ error: "Too many demo requests, please retry shortly" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "30" },
    });
  }



  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const configuredPassword = Deno.env.get("DEMO_USER_PASSWORD")?.trim();

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Required demo auth configuration is missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (configuredPassword && configuredPassword !== PUBLIC_DEMO_PASSWORD) {
      console.warn("DEMO_USER_PASSWORD does not match the public demo password; using the public demo password constant.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();

    if (listUsersError) {
      throw listUsersError;
    }

    const existingUser = existingUsers?.users?.find((user) => user.email === DEMO_EMAIL);
    let userId = existingUser?.id;

    if (existingUser) {
      console.log("Demo user already exists, updating password:", existingUser.id);
      const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: PUBLIC_DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: DEMO_NAME },
      });

      if (updateError) {
        throw updateError;
      }

      await ensureDemoProfileAndRole(supabase, existingUser.id, workspace.id);
    } else {
      userId = await recreateDemoUser(supabase, workspace.id);
    }

    let verification = await verifyDemoCredentials(
      supabaseUrl,
      anonKey,
      DEMO_EMAIL,
      PUBLIC_DEMO_PASSWORD,
    );

    if (!verification.ok) {
      console.warn("Demo credentials failed verification after update; recreating the demo user.", verification);
      userId = await recreateDemoUser(supabase, workspace.id, userId);
      verification = await verifyDemoCredentials(
        supabaseUrl,
        anonKey,
        DEMO_EMAIL,
        PUBLIC_DEMO_PASSWORD,
      );
    }

    if (!verification.ok || !userId) {
      return new Response(
        JSON.stringify({
          error: "Demo account verification failed",
          verification_status: verification.status,
          verification_message: verification.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
