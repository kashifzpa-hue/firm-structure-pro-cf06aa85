import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { getDocumentStatus } from "@/lib/document-status";
import { Building2, FileWarning, AlertTriangle, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalEntities: 0, expiringCount: 0, expiredCount: 0, totalCompanies: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entitiesRes, docsRes] = await Promise.all([
        supabase.from("entities").select("id, type").eq("workspace_id", workspaceId),
        supabase.from("documents").select("*, entities!inner(name, type)").eq("workspace_id", workspaceId),
      ]);

      const entities = entitiesRes.data || [];
      const docs = docsRes.data || [];

      const totalEntities = entities.length;
      const totalCompanies = entities.filter((e) => e.type === "company").length;

      let expiredCount = 0;
      let expiringCount = 0;
      const alertDocs: any[] = [];

      docs.forEach((doc) => {
        const status = getDocumentStatus(doc.expiry_date);
        if (status === "expired") {
          expiredCount++;
          alertDocs.push({ ...doc, status });
        } else if (status === "expiring_soon") {
          expiringCount++;
          alertDocs.push({ ...doc, status });
        }
      });

      alertDocs.sort((a, b) => {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      });

      setStats({ totalEntities, expiringCount, expiredCount, totalCompanies });
      setAlerts(alertDocs);
      setLoading(false);
    };
    fetchData();
  }, [workspaceId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  const cards = [
    { title: "Total Entities", value: stats.totalEntities, icon: Users, color: "text-primary" },
    { title: "Expiring in 30 Days", value: stats.expiringCount, icon: AlertTriangle, color: "text-warning" },
    { title: "Expired Documents", value: stats.expiredCount, icon: FileWarning, color: "text-destructive" },
    { title: "Total Companies", value: stats.totalCompanies, icon: Building2, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Expiry Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No expiry alerts</p>
              <p className="text-sm">All documents are up to date.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Name</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Document Number</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/entities/${doc.entity_id}`)}
                  >
                    <TableCell className="font-medium">{(doc.entities as any)?.name}</TableCell>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell>{doc.document_number || "—"}</TableCell>
                    <TableCell>{doc.expiry_date ? format(parseISO(doc.expiry_date), "MMM dd, yyyy") : "—"}</TableCell>
                    <TableCell><StatusBadge expiryDate={doc.expiry_date} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
