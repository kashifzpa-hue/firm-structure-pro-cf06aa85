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

  return crypto.subtle.importKey("raw", derivedBits, "AES-GCM", false, ["decrypt"]);
}

function guessMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
  };
  return map[ext || ""] || "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ---- 1a. Verify JWT ----
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

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();
    if (authErr || !user) return json({ error: "Forbidden" }, 403);

    // ---- 1b. Get user workspace ----
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.workspace_id) return json({ error: "Forbidden" }, 403);
    const workspaceId = profile.workspace_id;

    // ---- Parse request ----
    const body = await req.json();
    const { document_id, version_id, table } = body as {
      document_id?: string;
      version_id?: string;
      table?: string;
    };

    // ---- Unified document lookup across all tables ----
    let record: any = null;

    if (table === "document_versions" && version_id) {
      const { data } = await supabaseAdmin
        .from("document_versions")
        .select("*, documents!inner(document_type, document_number, workspace_id)")
        .eq("id", version_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (data) {
        record = {
          ...data,
          document_type: (data as any).documents?.document_type,
          document_number: (data as any).documents?.document_number,
        };
      }
    } else if (table === "bank_account_documents" && document_id) {
      const { data } = await supabaseAdmin
        .from("bank_account_documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (data) {
        record = { ...data, document_type: data.document_type, document_number: null };
      }
    } else if (table === "movement_documents" && document_id) {
      const { data } = await supabaseAdmin
        .from("movement_documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (data) {
        record = { ...data, document_type: data.document_type, document_number: null };
      }
    } else if (document_id) {
      // Default: check documents table
      const { data } = await supabaseAdmin
        .from("documents")
        .select("*")
        .eq("id", document_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (data) {
        record = data;
      }
    }

    if (!record) {
      console.warn(`[decrypt] Access denied or not found: id=${document_id || version_id} table=${table} ws=${workspaceId}`);
      return json({ error: "Forbidden" }, 403);
    }

    const fileUrl = record.file_url;
    if (!fileUrl) return json({ error: "No file attached" }, 404);

    // ---- Extract storage path from URL ----
    const bucketPrefix = "/storage/v1/object/public/documents/";
    const idx = fileUrl.indexOf(bucketPrefix);
    let storagePath: string;

    if (idx >= 0) {
      storagePath = decodeURIComponent(fileUrl.substring(idx + bucketPrefix.length));
    } else {
      const signedPrefix = "/storage/v1/object/sign/documents/";
      const sIdx = fileUrl.indexOf(signedPrefix);
      if (sIdx >= 0) {
        const pathWithQuery = fileUrl.substring(sIdx + signedPrefix.length);
        storagePath = decodeURIComponent(pathWithQuery.split("?")[0]);
      } else {
        storagePath = fileUrl;
      }
    }

    // ---- Legacy documents (not encrypted) → serve directly ----
    if (!record.is_encrypted) {
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage
        .from("documents")
        .download(storagePath);

      if (dlErr || !fileData) return json({ error: "File not found" }, 404);

      const contentType = guessMimeType(fileUrl);
      const filename = [record.document_type, record.document_number]
        .filter(Boolean)
        .join("_")
        .replace(/\s+/g, "_") || "document";

      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // ---- Encrypted document ----
    const masterKey = Deno.env.get("ENCRYPTION_MASTER_KEY");
    if (!masterKey) {
      console.error("[decrypt] ENCRYPTION_MASTER_KEY not configured");
      return json({ error: "Encryption not configured" }, 500);
    }

    const iv = record.iv;
    if (!iv) {
      console.error(`[decrypt] No IV for record ${document_id || version_id}`);
      return json(
        { error: "Document could not be decrypted. Please contact support." },
        422
      );
    }

    const { data: encData, error: dlErr } = await supabaseAdmin.storage
      .from("documents")
      .download(storagePath);

    if (dlErr || !encData) return json({ error: "File not found" }, 404);

    try {
      const key = await deriveKey(masterKey, workspaceId);
      const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
      const encBytes = new Uint8Array(await encData.arrayBuffer());

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBytes },
        key,
        encBytes
      );

      const contentType = guessMimeType(fileUrl);
      const filename = [record.document_type, record.document_number]
        .filter(Boolean)
        .join("_")
        .replace(/\s+/g, "_") || "document";

      return new Response(new Uint8Array(decrypted), {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    } catch (decryptErr) {
      console.error(`[decrypt] Decryption failed for ${document_id || version_id}:`, decryptErr);
      return json(
        { error: "Document could not be decrypted. Please contact support." },
        422
      );
    }
  } catch (err: any) {
    console.error("[decrypt] Unexpected error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
