import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { getDocumentStatus } from "@/lib/document-status";
import { Download, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Documents() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, entities!inner(name, type)")
        .eq("workspace_id", workspaceId);
      setDocs(data || []);
      setLoading(false);
    };
    fetch();
  }, [workspaceId]);

  const docTypes = [...new Set(docs.map((d) => d.document_type))].sort();

  const filtered = docs.filter((d) => {
    const status = getDocumentStatus(d.expiry_date);
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (entityTypeFilter !== "all" && (d.entities as any)?.type !== entityTypeFilter) return false;
    if (docTypeFilter !== "all" && d.document_type !== docTypeFilter) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Documents</h1>

      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
            <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entity Types</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
        <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Document Types</SelectItem>
            {docTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No documents found</p>
          <p className="text-sm">Add documents to your entities to see them here.</p>
        </div>
      ) : (
        <div className="rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity Name</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Document Number</TableHead>
                <TableHead>Country of Issue</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/entities/${doc.entity_id}`)}>
                  <TableCell className="font-medium">{(doc.entities as any)?.name}</TableCell>
                  <TableCell>{doc.document_type}</TableCell>
                  <TableCell>{doc.document_number || "—"}</TableCell>
                  <TableCell>{doc.country_of_issue || "—"}</TableCell>
                  <TableCell>{doc.expiry_date ? format(parseISO(doc.expiry_date), "MMM dd, yyyy") : "—"}</TableCell>
                  <TableCell><StatusBadge expiryDate={doc.expiry_date} /></TableCell>
                  <TableCell>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm" onClick={(e) => e.stopPropagation()}>
                        <Download className="h-4 w-4" /> Download
                      </a>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
