import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Security: Block ANY access to original signatures
  const url = new URL(req.url);
  if (url.pathname.includes("/original/")) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's workspace
    const { data: profile } = await userClient
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile?.workspace_id) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const signatoryId = formData.get("signatory_id") as string | null;
    const workspaceId = formData.get("workspace_id") as string | null;

    if (!file || !signatoryId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file, signatory_id, workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate workspace matches
    if (workspaceId !== profile.workspace_id) {
      return new Response(JSON.stringify({ error: "Workspace mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Only PNG and JPG are accepted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 5MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Store original (service role only - never accessible from frontend)
    const originalPath = `original/${workspaceId}/${signatoryId}`;
    await adminClient.storage.from("signatures").upload(originalPath, fileBytes, {
      contentType: file.type,
      upsert: true,
    });

    // Process image using Canvas API (Deno built-in)
    // Since Deno edge functions have limited image processing,
    // we'll create a processed version with a canvas-based approach
    // For now, we'll use the raw image and add metadata about processing
    // The actual overlay will be applied client-side for display purposes
    
    // Store processed image (in production, this would have the overlay applied)
    const processedPath = `processed/${workspaceId}/${signatoryId}`;
    await adminClient.storage.from("signatures").upload(processedPath, fileBytes, {
      contentType: file.type,
      upsert: true,
    });

    // Generate signed URL for the processed image (1 year expiry)
    const { data: signedUrlData } = await adminClient.storage
      .from("signatures")
      .createSignedUrl(processedPath, 60 * 60 * 24 * 365);

    if (!signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update signatory record with processed URL
    await adminClient
      .from("signatories")
      .update({
        signature_image_url: signedUrlData.signedUrl,
        signature_original_url: originalPath, // Internal reference only
      })
      .eq("id", signatoryId)
      .eq("workspace_id", workspaceId);

    return new Response(
      JSON.stringify({ processed_url: signedUrlData.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("apply-signature-overlay error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
