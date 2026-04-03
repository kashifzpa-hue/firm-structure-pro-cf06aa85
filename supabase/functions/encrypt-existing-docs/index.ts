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
  const baseKey = await crypto.subtle.importKey("raw", masterKeyBytes, "HKDF", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: INFO_V1 },
    baseKey, 256
  );
  return crypto.subtle.importKey("raw", derivedBits, "AES-GCM", false, ["encrypt"]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Forbidden" }, 403);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: "Forbidden" }, 403);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.workspace_id) return json({ error: "Forbidden" }, 403);
    const workspaceId = profile.workspace_id;

    // Verify admin role
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (role?.role !== "admin") return json({ error: "Admin access required" }, 403);

    // Check encryption enabled
    const { data: encKey } = await supabaseAdmin
      .from("workspace_encryption_keys")
      .select("encryption_version")
      .eq("workspace_id", workspaceId)
      .single();

    if (!encKey) return json({ error: "Encryption not enabled" }, 400);

    const masterKey = Deno.env.get("ENCRYPTION_MASTER_KEY");
    if (!masterKey) return json({ error: "Encryption not configured" }, 500);

    // Fetch all unencrypted documents with file_url
    const { data: docs } = await supabaseAdmin
      .from("documents")
      .select("id, file_url")
      .eq("workspace_id", workspaceId)
      .eq("is_encrypted", false)
      .not("file_url", "is", null);

    const unencryptedDocs = (docs || []).filter(d => d.file_url && !d.file_url.includes("placeholder"));
    const totalCount = unencryptedDocs.length;

    if (totalCount === 0) {
      return json({ encrypted_count: 0, total_count: 0, errors: [] });
    }

    const key = await deriveKey(masterKey, workspaceId);
    const errors: { document_id: string; error: string }[] = [];
    let encryptedCount = 0;

    const bucketPrefix = "/storage/v1/object/public/documents/";

    for (const doc of unencryptedDocs) {
      try {
        const fileUrl = doc.file_url!;
        const idx = fileUrl.indexOf(bucketPrefix);
        let storagePath: string;

        if (idx >= 0) {
          storagePath = decodeURIComponent(fileUrl.substring(idx + bucketPrefix.length));
        } else {
          storagePath = fileUrl;
        }

        // Download existing file
        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from("documents")
          .download(storagePath);

        if (dlErr || !fileData) {
          errors.push({ document_id: doc.id, error: `Download failed: ${dlErr?.message || "no data"}` });
          continue;
        }

        // Encrypt
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const fileBytes = new Uint8Array(await fileData.arrayBuffer());
        const encrypted = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          fileBytes
        );

        const ivBase64 = btoa(String.fromCharCode(...iv));

        // Replace file in storage with encrypted version
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("documents")
          .upload(storagePath, new Uint8Array(encrypted), {
            contentType: "application/octet-stream",
            upsert: true,
          });

        if (uploadErr) {
          errors.push({ document_id: doc.id, error: `Upload failed: ${uploadErr.message}` });
          continue;
        }

        // Update DB record
        await supabaseAdmin
          .from("documents")
          .update({
            is_encrypted: true,
            iv: ivBase64,
            encryption_version: encKey.encryption_version,
          })
          .eq("id", doc.id);

        encryptedCount++;
      } catch (err: any) {
        errors.push({ document_id: doc.id, error: err.message || "Unknown error" });
      }
    }

    console.log(`[encrypt-existing] Workspace ${workspaceId}: ${encryptedCount}/${totalCount} encrypted, ${errors.length} errors`);

    return json({ encrypted_count: encryptedCount, total_count: totalCount, errors });
  } catch (err: any) {
    console.error("[encrypt-existing] Error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
