import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, User, Search, Upload, Download, Ban } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, parseISO } from "date-fns";
import { getDocumentStatus } from "@/lib/document-status";
import { EntityImportModal } from "@/components/EntityImportModal";
import * as XLSX from "xlsx";

export default function Entities() {
  const { workspaceId, userRole } = useAuth();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const fetchEntities = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("entities")
      .select("*, documents(*)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setEntities(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!workspaceId) return;
    fetchEntities();
  }, [workspaceId]);

  const getEntityDocStatus = (entity: any) => {
    const docs = entity.documents || [];
    if (docs.length === 0) return null;
    const hasExpired = docs.some((d: any) => getDocumentStatus(d.expiry_date) === "expired");
    const hasExpiring = docs.some((d: any) => getDocumentStatus(d.expiry_date) === "expiring_soon");
    if (hasExpired) return "expired";
    if (hasExpiring) return "expiring_soon";
    return "valid";
  };

  const handleExportExcel = async () => {
    // Fetch share classes for all company entities
    const companyIds = filtered.filter(e => e.type === "company").map(e => e.id);
    let shareClasses: any[] = [];
    if (companyIds.length > 0 && workspaceId) {
      const { data } = await supabase
        .from("share_classes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("company_entity_id", companyIds);
      shareClasses = data || [];
    }

    // Build entity name lookup
    const entityNameMap = new Map(filtered.map(e => [e.id, e.name]));

    const exportData = filtered.map((e) => ({
      "Name": e.name,
      "Type": e.type === "person" ? "Person" : "Company",
      "Nationality / Jurisdiction": e.nationality_or_jurisdiction || "",
      "Date of Birth / Incorporation": e.date_of_birth_or_incorporation || "",
      "Email": e.email || "",
      "Phone": e.phone || "",
      "Company Type": e.company_type || "",
      "Registration Number": e.registration_number || "",
      "Registered Address": e.registered_address || "",
      "Primary Contact Name": e.primary_contact_name || "",
      "Primary Contact Email": e.primary_contact_email || "",
      "Notes": e.notes || "",
      "Created": format(parseISO(e.created_at), "yyyy-MM-dd"),
    }));

    const shareClassData = shareClasses.map((sc) => ({
      "Company Name": entityNameMap.get(sc.company_entity_id) || "",
      "Class Name": sc.class_name,
      "Total Shares Issued": sc.total_shares_issued,
      "Par Value Per Share": sc.par_value_per_share,
      "Currency": sc.currency,
      "Voting Rights": sc.voting_rights ? "Yes" : "No",
      "Notes": sc.notes || "",
    }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(exportData);
    ws1["!cols"] = Object.keys(exportData[0] || {}).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws1, "Entities");

    if (shareClassData.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(shareClassData);
      ws2["!cols"] = Object.keys(shareClassData[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws2, "Share Classes");
    }

    XLSX.writeFile(wb, `CorpSync_Entities_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const filtered = entities.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.type === typeFilter;
    const docStatus = getEntityDocStatus(e);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "issues" && docStatus === "expired") ||
      (statusFilter === "attention" && docStatus === "expiring_soon") ||
      (statusFilter === "ok" && docStatus === "valid") ||
      (statusFilter === "no_docs" && !docStatus);
    // Hide inactive unless toggled
    const matchActive = showInactive || e.entity_status !== "inactive";
    return matchSearch && matchType && matchStatus && matchActive;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
        <div className="flex gap-2">
          {userRole === "admin" && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import Excel
            </Button>
          )}
          {filtered.length > 0 && (
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          )}
          <Button onClick={() => navigate("/entities/new")}>
            <Plus className="mr-2 h-4 w-4" /> Add Entity
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search entities..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="issues">Issues</SelectItem>
            <SelectItem value="attention">Attention</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="no_docs">No Docs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Building2 className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">No entities yet</p>
          <p className="text-sm mb-4">Add your first entity to get started.</p>
          <Button onClick={() => navigate("/entities/new")}>
            <Plus className="mr-2 h-4 w-4" /> Add Entity
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Doc Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entity) => {
                const docStatus = getEntityDocStatus(entity);
                return (
                  <TableRow key={entity.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/entities/${entity.id}`)}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {entity.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {entity.type === "person" ? "Person" : "Company"}
                      </Badge>
                    </TableCell>
                    <TableCell>{entity.nationality_or_jurisdiction || "—"}</TableCell>
                    <TableCell>{format(parseISO(entity.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      {docStatus === "expired" && <Badge className="bg-destructive text-destructive-foreground">Issues</Badge>}
                      {docStatus === "expiring_soon" && <Badge className="bg-warning text-warning-foreground">Attention</Badge>}
                      {docStatus === "valid" && <Badge className="bg-success text-success-foreground">OK</Badge>}
                      {!docStatus && <span className="text-muted-foreground text-sm">No docs</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityImportModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchEntities} />
    </div>
  );
}
