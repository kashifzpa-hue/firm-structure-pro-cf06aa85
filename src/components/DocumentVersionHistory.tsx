import { useEffect, useState } from "react";
import { encryptedDownload } from "@/lib/encryption";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Props {
  documentId: string;
}

export function DocumentVersionHistory({ documentId }: Props) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("document_versions")
        .select("*, uploaded_by_profile:profiles!document_versions_uploaded_by_fkey(full_name)")
        .eq("document_id", documentId)
        .order("version_number", { ascending: false });
      setVersions(data || []);
      setLoading(false);
    };
    fetch();
  }, [documentId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading versions...</p>;
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">No version history available.</p>;

  return (
    <div className="space-y-3">
      {versions.map((v, i) => (
        <div key={v.id} className="flex items-start gap-3 border-l-2 border-muted pl-4 py-2 relative">
          <div className="absolute -left-[5px] top-3 h-2 w-2 rounded-full bg-primary" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Version {v.version_number}</span>
              {i === 0 && (
                <Badge variant="default" className="text-xs">Current</Badge>
              )}
              {i === versions.length - 1 && versions.length > 1 && (
                <Badge variant="outline" className="text-xs">Original</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {v.issue_date && <div>Issue: {format(parseISO(v.issue_date), "MMM dd, yyyy")}</div>}
              {v.expiry_date && <div>Expiry: {format(parseISO(v.expiry_date), "MMM dd, yyyy")}</div>}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Uploaded {v.uploaded_by_profile?.full_name ? `by ${v.uploaded_by_profile.full_name} ` : ''}
                on {format(parseISO(v.uploaded_at), "MMM dd, yyyy")}
              </div>
              {v.notes && <div className="italic">{v.notes}</div>}
            </div>
          </div>
          {v.file_url && (
            <a href={v.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
