import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { getDocumentStatus } from "@/lib/document-status";
import { Building2, FileWarning, AlertTriangle, Users, Link2, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalEntities: 0, expiringCount: 0, expiredCount: 0, totalCompanies: 0, totalLinks: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentLinks, setRecentLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entitiesRes, docsRes, linksCountRes, recentLinksRes, appointmentsRes] = await Promise.all([
        supabase.from("entities").select("id, type").eq("workspace_id", workspaceId),
        supabase.from("documents").select("*, entities!inner(name, type)").eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("id").eq("workspace_id", workspaceId).is("end_date", null),
        supabase
          .from("equity_links")
          .select("*, owner:entities!equity_links_owner_entity_id_fkey(name, type), owned:entities!equity_links_owned_entity_id_fkey(name, type)")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("appointments")
          .select("*, person:entities!appointments_person_entity_id_fkey(id, name), company:entities!appointments_company_entity_id_fkey(id, name)")
          .eq("workspace_id", workspaceId)
          .is("resignation_date", null),
      ]);

      const entities = entitiesRes.data || [];
      const docs = docsRes.data || [];

      const totalEntities = entities.length;
      const totalCompanies = entities.filter((e) => e.type === "company").length;
      const totalLinks = (linksCountRes.data || []).length;

      let expiredCount = 0;
      let expiringCount = 0;
      const alertDocs: any[] = [];

      docs.forEach((doc) => {
        const status = getDocumentStatus(doc.expiry_date);
        if (status === "expired") { expiredCount++; alertDocs.push({ ...doc, status }); }
        else if (status === "expiring_soon") { expiringCount++; alertDocs.push({ ...doc, status }); }
      });

      alertDocs.sort((a, b) => {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      });

      setStats({ totalEntities, expiringCount, expiredCount, totalCompanies, totalLinks });
      setAlerts(alertDocs);
      setRecentLinks(recentLinksRes.data || []);

      // Build appointment-linked alerts: find docs for persons with active appointments
      const activeAppointments = appointmentsRes.data || [];
      const personIds = [...new Set(activeAppointments.map((a: any) => a.person_entity_id))];
      const apptAlerts: any[] = [];
      if (personIds.length > 0) {
        const { data: personDocs } = await supabase
          .from("documents")
          .select("*, entities!inner(name, type)")
          .eq("workspace_id", workspaceId)
          .in("entity_id", personIds)
          .in("document_type", ["Passport", "National ID"]);
        (personDocs || []).forEach((doc: any) => {
          const status = getDocumentStatus(doc.expiry_date);
          if (status === "expired" || status === "expiring_soon") {
            const roles = activeAppointments
              .filter((a: any) => a.person_entity_id === doc.entity_id)
              .map((a: any) => `${a.role_title} at ${a.company?.name || "Unknown"}`);
            apptAlerts.push({ ...doc, status, appointmentRole: roles.join(", ") });
          }
        });
      }
      setAppointmentAlerts(apptAlerts);
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
    { title: "Ownership Links", value: stats.totalLinks, icon: Link2, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          {alerts.length === 0 && appointmentAlerts.length === 0 ? (
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
                  <TableHead>Role</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...alerts, ...appointmentAlerts].map((doc, idx) => (
                  <TableRow key={doc.id + "-" + idx} className="cursor-pointer" onClick={() => navigate(`/entities/${doc.entity_id}`)}>
                    <TableCell className="font-medium">{(doc.entities as any)?.name}</TableCell>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell>{doc.document_number || "—"}</TableCell>
                    <TableCell className="text-sm">{doc.appointmentRole || "—"}</TableCell>
                    <TableCell>{doc.expiry_date ? format(parseISO(doc.expiry_date), "MMM dd, yyyy") : "—"}</TableCell>
                    <TableCell><StatusBadge expiryDate={doc.expiry_date} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recently Added Ownership Links */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recently Added Ownership Links</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No ownership links yet</p>
              <p className="text-sm">Add ownership links from the Ownership page.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Owns</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLinks.map((link) => (
                  <TableRow key={link.id} className="cursor-pointer" onClick={() => navigate("/ownership")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{link.owner?.name}</span>
                        <Badge variant="outline" className="text-xs gap-1">
                          {link.owner?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {link.owner?.type === "person" ? "Person" : "Company"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{link.owned?.name}</span>
                        <Badge variant="outline" className="text-xs gap-1">
                          {link.owned?.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {link.owned?.type === "person" ? "Person" : "Company"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{Number(link.percentage).toFixed(2)}%</TableCell>
                    <TableCell>{link.effective_date ? format(parseISO(link.effective_date), "MMM dd, yyyy") : "—"}</TableCell>
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
