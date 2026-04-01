import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, User, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getDocumentStatus } from "@/lib/document-status";

export default function Entities() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [entities, setEntities] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("entities")
        .select("*, documents(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      setEntities(data || []);
      setLoading(false);
    };
    fetch();
  }, [workspaceId]);

  const filtered = entities.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.type === typeFilter;
    return matchSearch && matchType;
  });

  const getEntityDocStatus = (entity: any) => {
    const docs = entity.documents || [];
    if (docs.length === 0) return null;
    const hasExpired = docs.some((d: any) => getDocumentStatus(d.expiry_date) === "expired");
    const hasExpiring = docs.some((d: any) => getDocumentStatus(d.expiry_date) === "expiring_soon");
    if (hasExpired) return "expired";
    if (hasExpiring) return "expiring_soon";
    return "valid";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
        <Button onClick={() => navigate("/entities/new")}>
          <Plus className="mr-2 h-4 w-4" /> Add Entity
        </Button>
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
    </div>
  );
}
