import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { getDocumentStatus } from "@/lib/document-status";
import { Building2, FileWarning, AlertTriangle, Users, Link2, User, PieChart, ScrollText, Shield, Landmark, PenLine, Clock, Hourglass } from "lucide-react";
import { KYCHealthGrid } from "@/components/KYCHealthGrid";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalEntities: 0, expiringCount: 0, expiredCount: 0, totalCompanies: 0, totalLinks: 0, draftMovements: 0 });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentLinks, setRecentLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState<any[]>([]);
  const [shareholdingGaps, setShareholdingGaps] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [uboAlerts, setUboAlerts] = useState<any[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState({ total: 0, critical: 0, warnings: 0 });
  const [bankingEnabled, setBankingEnabled] = useState(false);
  const [bankingStats, setBankingStats] = useState({ accounts: 0, signatories: 0, expiring: 0, pendingAck: 0 });
  const [govStats, setGovStats] = useState({ boardAppts: 0, mgmtAppts: 0, companiesNoBoard: 0, totalCompanies: 0 });

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entitiesRes, docsRes, linksCountRes, recentLinksRes, appointmentsRes, shareClassesRes, equityLinksRes, draftMovRes, recentMovRes] = await Promise.all([
        supabase.from("entities").select("id, type, name").eq("workspace_id", workspaceId),
        supabase.from("documents").select("*, entities!inner(name, type)").eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("id").eq("workspace_id", workspaceId).is("end_date", null),
        supabase
          .from("equity_links")
          .select("*, owner:entities!equity_links_owner_entity_id_fkey(name, type), owned:entities!equity_links_owned_entity_id_fkey(name, type), share_class:share_classes(*)")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("appointments")
          .select("*, person:entities!appointments_person_entity_id_fkey(id, name), company:entities!appointments_company_entity_id_fkey(id, name)")
          .eq("workspace_id", workspaceId)
          .is("resignation_date", null),
        supabase.from("share_classes").select("*").eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("share_class_id, shares_owned").eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("movements").select("id").eq("workspace_id", workspaceId).eq("status", "draft"),
        supabase.from("movements")
          .select("*, company:entities!movements_company_entity_id_fkey(name), from_entity:entities!movements_from_entity_id_fkey(name), to_entity:entities!movements_to_entity_id_fkey(name)")
          .eq("workspace_id", workspaceId).eq("status", "confirmed")
          .order("confirmed_at", { ascending: false }).limit(5),
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

      setStats({ totalEntities, expiringCount, expiredCount, totalCompanies, totalLinks, draftMovements: (draftMovRes.data || []).length });
      setAlerts(alertDocs);
      setRecentLinks(recentLinksRes.data || []);
      setRecentMovements(recentMovRes.data || []);

      // Appointment alerts
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

      // Shareholding gaps
      const allShareClasses = shareClassesRes.data || [];
      const allEquityLinks = equityLinksRes.data || [];
      const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));
      const gaps: any[] = [];
      allShareClasses.forEach(sc => {
        const allocated = allEquityLinks
          .filter(l => l.share_class_id === sc.id)
          .reduce((sum, l) => sum + (l.shares_owned || 0), 0);
        if (allocated < sc.total_shares_issued) {
          const unallocated = sc.total_shares_issued - allocated;
          const pctGap = ((unallocated / sc.total_shares_issued) * 100).toFixed(1);
          gaps.push({
            companyName: entityMap[sc.company_entity_id]?.name || "Unknown",
            companyId: sc.company_entity_id,
            className: sc.class_name,
            totalIssued: sc.total_shares_issued,
            allocated,
            unallocated,
            pctGap,
          });
        }
      });
      setShareholdingGaps(gaps);

      // UBO Alerts — above threshold with passport data
      const { data: uboData } = await supabase.from("ubo_snapshots").select("*").eq("workspace_id", workspaceId).eq("snapshot_type", "live").eq("is_above_threshold", true).eq("calculation_error", false);
      if (uboData && uboData.length > 0) {
        const personIdsUbo = [...new Set(uboData.map((u: any) => u.person_entity_id))];
        const { data: uboDocs } = await supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("entity_id", personIdsUbo).eq("document_type", "Passport");
        const uboEntityMap = Object.fromEntries(entities.map(e => [e.id, e]));
        const alerts = uboData.map((u: any) => {
          const passport = (uboDocs || []).find((d: any) => d.entity_id === u.person_entity_id);
          return { ...u, personName: uboEntityMap[u.person_entity_id]?.name, companyName: uboEntityMap[u.company_entity_id]?.name, passport };
        });
        setUboAlerts(alerts);
      }

      // Fetch unread notification counts
      const { data: unreadNotifs } = await supabase
        .from("notifications")
        .select("notification_type")
        .eq("workspace_id", workspaceId)
        .eq("is_read", false);
      
      const criticalTypes = ["DOCUMENT_EXPIRED", "UBO_THRESHOLD_BREACH"];
      const warningTypes = ["DOCUMENT_EXPIRING_SOON", "SHAREHOLDING_GAP", "MOVEMENT_DRAFT_PENDING"];
      setUnreadAlerts({
        total: (unreadNotifs || []).length,
        critical: (unreadNotifs || []).filter((n: any) => criticalTypes.includes(n.notification_type)).length,
        warnings: (unreadNotifs || []).filter((n: any) => warningTypes.includes(n.notification_type)).length,
      });

      // Banking stats
      const { data: wsData } = await supabase.from("workspaces").select("banking_enabled").eq("id", workspaceId).single();
      const isBankingEnabled = !!(wsData as any)?.banking_enabled;
      setBankingEnabled(isBankingEnabled);

      if (isBankingEnabled) {
        const today30 = new Date();
        today30.setDate(today30.getDate() + 30);
        const today30Str = today30.toISOString().split("T")[0];

        const [baRes, sigRes] = await Promise.all([
          supabase.from("bank_accounts").select("id").eq("workspace_id", workspaceId).eq("account_status", "active"),
          supabase.from("signatories").select("id, expiry_date, bank_acknowledged_date").eq("workspace_id", workspaceId).eq("status", "active"),
        ]);
        const activeSigs = sigRes.data || [];
        setBankingStats({
          accounts: (baRes.data || []).length,
          signatories: activeSigs.length,
          expiring: activeSigs.filter(s => s.expiry_date && s.expiry_date <= today30Str).length,
          pendingAck: activeSigs.filter(s => !s.bank_acknowledged_date).length,
        });
      }

      // Governance stats
      const activeAppts = appointmentsRes.data || [];
      const companyIds = entities.filter(e => e.type === "company").map(e => e.id);
      const boardAppts = activeAppts.filter((a: any) => a.role_category === "board");
      const mgmtAppts = activeAppts.filter((a: any) => a.role_category === "management");
      const companiesWithBoard = new Set(boardAppts.map((a: any) => a.company_entity_id));
      setGovStats({
        boardAppts: boardAppts.length,
        mgmtAppts: mgmtAppts.length,
        companiesNoBoard: companyIds.filter(id => !companiesWithBoard.has(id)).length,
        totalCompanies: companyIds.length,
      });

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
    { title: "Pending Drafts", value: stats.draftMovements, icon: ScrollText, color: stats.draftMovements > 0 ? "text-warning" : "text-primary", onClick: () => stats.draftMovements > 0 && navigate("/ledger?status=draft") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title} className={`shadow-sm ${(card as any).onClick ? "cursor-pointer hover:border-primary/50" : ""}`} onClick={(card as any).onClick}>
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

      {unreadAlerts.total > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <span className="text-sm">
            You have <strong>{unreadAlerts.total}</strong> unread alerts
            {unreadAlerts.critical > 0 && <> — <span className="text-destructive font-semibold">{unreadAlerts.critical} critical</span></>}
            {unreadAlerts.warnings > 0 && <>, <span className="text-warning font-semibold">{unreadAlerts.warnings} warnings</span></>}
          </span>
          <button onClick={() => navigate("/notifications?status=unread")} className="ml-auto text-xs text-primary hover:underline">
            View all →
          </button>
        </div>
      )}

      {/* Banking Overview */}
      {bankingEnabled && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Banking Overview</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { title: "Bank Accounts", value: bankingStats.accounts, icon: Landmark, color: "text-primary", link: "/bank-accounts" },
              { title: "Active Signatories", value: bankingStats.signatories, icon: PenLine, color: "text-primary", link: "/bank-accounts" },
              { title: "Expiring Authority (30d)", value: bankingStats.expiring, icon: Clock, color: "text-warning", link: "/signatory-register?expiry=30" },
              { title: "Awaiting Bank Ack", value: bankingStats.pendingAck, icon: Hourglass, color: "text-muted-foreground", link: "/signatory-register?ack=pending" },
            ].map(card => (
              <Card key={card.title} className="shadow-sm cursor-pointer hover:border-primary/50" onClick={() => navigate(card.link)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{card.value}</div></CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Governance Overview */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Governance Overview</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Board Appointments</CardTitle>
              <Landmark className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{govStats.boardAppts}</div></CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Management Appointments</CardTitle>
              <Building2 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{govStats.mgmtAppts}</div></CardContent>
          </Card>
          <Card className={`shadow-sm ${govStats.companiesNoBoard > 0 ? "border-warning/30" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">No Board Recorded</CardTitle>
              <AlertTriangle className={`h-5 w-5 ${govStats.companiesNoBoard > 0 ? "text-warning" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{govStats.companiesNoBoard}</div>
              {govStats.companiesNoBoard > 0 && (
                <button onClick={() => navigate("/org-chart")} className="text-xs text-primary hover:underline mt-1">View in Governance Chart →</button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KYC Health Grid */}
      <KYCHealthGrid />

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

      {/* Shareholding Gaps */}
      {shareholdingGaps.length > 0 && (
        <Card className="shadow-sm border-warning/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-warning" /> Shareholding Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Share Class</TableHead>
                  <TableHead>Total Issued</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Unallocated</TableHead>
                  <TableHead>% Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareholdingGaps.map((gap, i) => (
                  <TableRow key={i} className="cursor-pointer" onClick={() => navigate(`/entities/${gap.companyId}`)}>
                    <TableCell className="font-medium">{gap.companyName}</TableCell>
                    <TableCell>{gap.className}</TableCell>
                    <TableCell>{gap.totalIssued.toLocaleString()}</TableCell>
                    <TableCell>{gap.allocated.toLocaleString()}</TableCell>
                    <TableCell className="text-destructive font-medium">{gap.unallocated.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="text-warning">{gap.pctGap}%</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Share Class</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>% Holding</TableHead>
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
                      </div>
                    </TableCell>
                    <TableCell>{link.share_class?.class_name || "—"}</TableCell>
                    <TableCell>{link.shares_owned ? link.shares_owned.toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{Number(link.percentage).toFixed(2)}%</Badge></TableCell>
                    <TableCell>{link.effective_date ? format(parseISO(link.effective_date), "MMM dd, yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      {recentMovements.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Shares</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((m: any) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/ledger/${m.id}`)}>
                    <TableCell>{format(parseISO(m.movement_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{m.company?.name}</TableCell>
                    <TableCell><Badge variant="outline">{m.movement_type?.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>{m.from_entity?.name || "—"}</TableCell>
                    <TableCell>{m.to_entity?.name || "—"}</TableCell>
                    <TableCell>{m.shares_transferred?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* UBO Alerts */}
      {uboAlerts.length > 0 && (
        <Card className="shadow-sm border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" /> UBO Alerts — Above 25% Threshold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>UBO Name</TableHead>
                  <TableHead>Economic %</TableHead>
                  <TableHead>Voting %</TableHead>
                  <TableHead>Passport Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uboAlerts.map((u: any, i: number) => (
                  <TableRow key={u.id || i} className="cursor-pointer" onClick={() => navigate(`/entities/${u.person_entity_id}`)}>
                    <TableCell className="font-medium">{u.companyName || "—"}</TableCell>
                    <TableCell>{u.personName || "—"}</TableCell>
                    <TableCell><Badge className="bg-destructive text-destructive-foreground">{Number(u.effective_economic_pct).toFixed(2)}%</Badge></TableCell>
                    <TableCell><Badge className="bg-destructive text-destructive-foreground">{Number(u.effective_voting_pct).toFixed(2)}%</Badge></TableCell>
                    <TableCell>{u.passport?.expiry_date ? format(parseISO(u.passport.expiry_date), "MMM dd, yyyy") : "No passport"}</TableCell>
                    <TableCell>{u.passport ? <StatusBadge expiryDate={u.passport.expiry_date} /> : <Badge variant="outline" className="text-warning">Missing</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
