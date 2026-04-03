import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Upload a file through the encrypt-document edge function.
 * Returns { file_url, iv, is_encrypted, encryption_version } on success.
 */
export async function encryptedUpload(opts: {
  file: File;
  storagePath: string;
  documentId?: string;
  versionId?: string;
  table?: "documents" | "document_versions" | "bank_account_documents" | "movement_documents";
  onProgress?: (step: "uploading" | "encrypting" | "done") => void;
}): Promise<{
  file_url: string;
  iv: string;
  is_encrypted: boolean;
  encryption_version: number;
}> {
  const { file, storagePath, documentId, versionId, table, onProgress } = opts;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  onProgress?.("uploading");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("storage_path", storagePath);
  if (documentId) formData.append("document_id", documentId);
  if (versionId) formData.append("version_id", versionId);
  if (table) formData.append("table", table);

  onProgress?.("encrypting");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-document`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Encrypted upload failed");
  }

  const result = await res.json();
  onProgress?.("done");
  return result;
}

/**
 * Download a file through the decrypt-document edge function.
 * Handles both encrypted and legacy (unencrypted) documents.
 */
export async function encryptedDownload(opts: {
  documentId?: string;
  versionId?: string;
  table?: "documents" | "document_versions";
  filename?: string;
}): Promise<void> {
  const { documentId, versionId, table, filename } = opts;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/decrypt-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document_id: documentId,
      version_id: versionId,
      table: table || "documents",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(err.error || "Download failed");
  }

  const blob = await res.blob();

  // Extract filename from Content-Disposition or use provided
  const disposition = res.headers.get("Content-Disposition");
  let downloadName = filename || "document";
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) downloadName = match[1];
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
