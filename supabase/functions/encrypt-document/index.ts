import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INFO_V1 = new TextEncoder().encode("corpsync-document-encryption-v1");

async function deriveKey(masterKeyBase64: string, workspaceId: string): Promise<CryptoKey> {
  const masterKeyBytes = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));
  const salt = new TextEncoder().encode(workspaceId);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    masterKeyBytes,
    "HKDF",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO_V1 },
    baseKey,
    256
  );

  return crypto.subtle.importKey(
    "raw",
    derivedBits,
    "AES-GCM",
    false,
    ["encrypt"]
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth - must be authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user token
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's workspace
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.workspace_id) {
      return new Response(JSON.stringify({ error: "No workspace found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = profile.workspace_id;

    // Check encryption is enabled for this workspace
    const { data: encKey } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .select("encryption_version")
      .eq("workspace_id", workspaceId)
      .single();

    if (!encKey) {
      return new Response(JSON.stringify({ error: "Encryption not enabled for this workspace" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const storagePath = formData.get("storage_path") as string | null;
    const documentId = formData.get("document_id") as string | null;
    const versionId = formData.get("version_id") as string | null;
    const table = (formData.get("table") as string) || "documents";

    if (!file || !storagePath) {
      return new Response(
        JSON.stringify({ error: "file and storage_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get master key
    const masterKey = Deno.env.get("ENCRYPTION_MASTER_KEY");
    if (!masterKey) {
      console.error("ENCRYPTION_MASTER_KEY not configured");
      return new Response(JSON.stringify({ error: "Encryption not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive workspace key
    const key = await deriveKey(masterKey, workspaceId);

    // Generate IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt file
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      fileBytes
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));

    // Upload encrypted file to storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("documents")
      .upload(storagePath, new Uint8Array(encrypted), {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Update document/version record with encryption metadata
    if (table === "document_versions" && versionId) {
      await supabaseAdmin
        .from("document_versions")
        .update({
          is_encrypted: true,
          encryption_version: encKey.encryption_version,
          iv: ivBase64,
          file_url: urlData.publicUrl,
        })
        .eq("id", versionId)
        .eq("workspace_id", workspaceId);
    } else if (documentId) {
      await supabaseAdmin
        .from("documents")
        .update({
          is_encrypted: true,
          encryption_version: encKey.encryption_version,
          iv: ivBase64,
          file_url: urlData.publicUrl,
        })
        .eq("id", documentId)
        .eq("workspace_id", workspaceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        iv: ivBase64,
        file_url: urlData.publicUrl,
        is_encrypted: true,
        encryption_version: encKey.encryption_version,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Encrypt error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Encryption failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
