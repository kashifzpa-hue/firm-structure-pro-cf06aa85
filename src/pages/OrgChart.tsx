import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { GovernanceChart } from "@/components/orgchart/GovernanceChart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Users } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  getNodesBounds,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Building2, User } from "lucide-react";
import { toPng } from "html-to-image";
import { ShareSummaryPanel } from "@/components/orgchart/ShareSummaryPanel";
import { UnallocatedReport } from "@/components/orgchart/UnallocatedReport";
import { CompanyNode } from "@/components/orgchart/CompanyNode";
import { PersonNode } from "@/components/orgchart/PersonNode";
import { CustomEdge } from "@/components/orgchart/CustomEdge";
import { ChartControls, type VisibilityFlags } from "@/components/orgchart/ChartControls";
import { differenceInDays, parseISO, isValid } from "date-fns";

const ROLE_PRIORITY: Record<string, number> = {
  Director: 1, "Managing Director": 1, Chairman: 0, CEO: 0,
  "Company Secretary": 2, CFO: 2, COO: 2,
};

function getSeniorRole(roles: { role_title: string; company_name: string }[]): string | undefined {
  if (!roles.length) return undefined;
  const sorted = [...roles].sort((a, b) => {
    const pa = ROLE_PRIORITY[a.role_title] ?? 10;
    const pb = ROLE_PRIORITY[b.role_title] ?? 10;
    return pa - pb;
  });
  return `${sorted[0].role_title} — ${sorted[0].company_name}`;
}

function computeDocStatus(docs: { entity_id: string; expiry_date: string | null }[]): Record<string, "green" | "amber" | "red"> {
  const map: Record<string, "green" | "amber" | "red"> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byEntity: Record<string, { expiry_date: string | null }[]> = {};
  docs.forEach((d) => {
    if (!byEntity[d.entity_id]) byEntity[d.entity_id] = [];
    byEntity[d.entity_id].push(d);
  });

  for (const [entityId, eDocs] of Object.entries(byEntity)) {
    let hasExpired = false;
    let hasExpiring = false;
    for (const doc of eDocs) {
      if (!doc.expiry_date) continue;
      const date = parseISO(doc.expiry_date);
      if (!isValid(date)) continue;
      const days = differenceInDays(date, today);
      if (days < 0) { hasExpired = true; break; }
      if (days <= 60) hasExpiring = true;
    }
    const status: "green" | "amber" | "red" = hasExpired ? "red" : hasExpiring ? "amber" : "green";
    map[entityId] = status;
  }
  return map;
}

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  rankdir: "TB" | "LR",
  nodeDimensions: Record<string, { width: number; height: number }>
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep: 100, ranksep: 140 });
  nodes.forEach((node) => {
    const dim = nodeDimensions[node.id] || { width: 280, height: 150 };
    g.setNode(node.id, { width: dim.width, height: dim.height });
  });
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);
  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id);
    const dim = nodeDimensions[node.id] || { width: 280, height: 150 };
    return { ...node, position: { x: n.x - dim.width / 2, y: n.y - dim.height / 2 } };
  });
  return { nodes: layoutedNodes, edges };
}

const nodeTypes = { companyNode: CompanyNode, personNode: PersonNode };
const edgeTypes = { custom: CustomEdge };

export default function OrgChart() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rootId = searchParams.get("root") || "";

  const [entities, setEntities] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [appointmentMap, setAppointmentMap] = useState<Record<string, { role_title: string; company_name: string }[]>>({});
  const [docStatusMap, setDocStatusMap] = useState<Record<string, "green" | "amber" | "red">>({});

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedShareClass, setSelectedShareClass] = useState("all");

  const [layoutDirection, setLayoutDirection] = useState<"TB" | "LR">("TB");
  const [visibility, setVisibility] = useState<VisibilityFlags>({
    capitalBadges: true,
    edgeLabels: true,
    personHoldings: true,
    officerCounts: true,
    regNumbers: false,
    incDates: false,
  });
  const [showMinimap, setShowMinimap] = useState(true);

  // Store raw graph data so layout can be re-run without refetching
  const rawGraphRef = useRef<{ nodes: Node[]; edges: Edge[]; dims: Record<string, { width: number; height: number }> } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entRes, linksRes, apptsRes, scRes, docsRes] = await Promise.all([
        supabase.from("entities").select("*").eq("workspace_id", workspaceId).order("name"),
        supabase.from("equity_links").select("*").eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("appointments").select("person_entity_id, company_entity_id, role_title, role_category").eq("workspace_id", workspaceId).is("resignation_date", null),
        supabase.from("share_classes").select("*").eq("workspace_id", workspaceId),
        supabase.from("documents").select("id, entity_id, expiry_date").eq("workspace_id", workspaceId),
      ]);
      setEntities(entRes.data || []);
      setAllLinks(linksRes.data || []);
      setShareClasses(scRes.data || []);

      // Appointment counts + role map
      const counts: Record<string, number> = {};
      const roleMap: Record<string, { role_title: string; company_name: string }[]> = {};
      const entMap = Object.fromEntries((entRes.data || []).map((e: any) => [e.id, e]));
      (apptsRes.data || []).forEach((a: any) => {
        counts[a.company_entity_id] = (counts[a.company_entity_id] || 0) + 1;
        if (!roleMap[a.person_entity_id]) roleMap[a.person_entity_id] = [];
        roleMap[a.person_entity_id].push({
          role_title: a.role_title,
          company_name: entMap[a.company_entity_id]?.name || "Unknown",
        });
      });
      setAppointmentCounts(counts);
      setAppointmentMap(roleMap);

      // Doc status
      setDocStatusMap(computeDocStatus(docsRes.data || []));
    };
    fetchData();
  }, [workspaceId]);

  const companyEntities = useMemo(() => entities.filter((e) => e.type === "company"), [entities]);
  const entityMap = useMemo(() => Object.fromEntries(entities.map((e) => [e.id, e])), [entities]);
  const shareClassMap = useMemo(() => Object.fromEntries(shareClasses.map((sc) => [sc.id, sc])), [shareClasses]);

  const rootShareClasses = useMemo(
    () => shareClasses.filter((sc) => sc.company_entity_id === rootId),
    [shareClasses, rootId]
  );

  const filteredLinks = useMemo(() => {
    if (selectedShareClass === "all") return allLinks;
    return allLinks.filter((l) => l.share_class_id === selectedShareClass);
  }, [allLinks, selectedShareClass]);

  // Compute per-company share class data with allocation
  const companyShareClassData = useMemo(() => {
    const result: Record<string, any[]> = {};
    shareClasses.forEach((sc) => {
      if (!result[sc.company_entity_id]) result[sc.company_entity_id] = [];
      const allocatedShares = allLinks
        .filter((l) => l.owned_entity_id === sc.company_entity_id && l.share_class_id === sc.id && !l.end_date)
        .reduce((sum, l) => sum + (l.shares_owned || 0), 0);
      result[sc.company_entity_id].push({ ...sc, allocated_shares: allocatedShares });
    });
    return result;
  }, [shareClasses, allLinks]);

  // Subsidiary count per entity
  const subsidiaryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    allLinks.forEach((l) => {
      const key = `${l.owner_entity_id}-${l.owned_entity_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const owner = entityMap[l.owner_entity_id];
      if (owner?.type === "company") {
        const owned = entityMap[l.owned_entity_id];
        if (owned?.type === "company") {
          counts[l.owner_entity_id] = (counts[l.owner_entity_id] || 0) + 1;
        }
      }
    });
    return counts;
  }, [allLinks, entityMap]);

  // Build graph
  const buildGraph = useCallback(
    (badgesOn: boolean) => {
      if (!rootId || !filteredLinks.length) return null;

      // Deduplicate links by ID to prevent double-counting
      const uniqueLinks = Array.from(new Map(filteredLinks.map((l) => [l.id, l])).values());

      const visitedNodes = new Set<string>();
      const graphNodes: Node[] = [];
      const edgeMap = new Map<string, { links: any[]; source: string; target: string }>();
      const queue = [rootId];
      visitedNodes.add(rootId);

      const ownershipsByEntity: Record<string, { targetName: string; percentage: number }[]> = {};
      uniqueLinks.forEach((link) => {
        if (!ownershipsByEntity[link.owner_entity_id]) ownershipsByEntity[link.owner_entity_id] = [];
        const target = entityMap[link.owned_entity_id];
        if (target) {
          ownershipsByEntity[link.owner_entity_id].push({
            targetName: target.name,
            percentage: Number(link.percentage),
          });
        }
      });

      while (queue.length > 0) {
        const current = queue.shift()!;
        const entity = entityMap[current];
        if (!entity) continue;

        const isCompany = entity.type === "company";

        graphNodes.push({
          id: current,
          type: isCompany ? "companyNode" : "personNode",
          position: { x: 0, y: 0 },
          data: isCompany
            ? {
                label: entity.name,
                companyType: entity.company_type,
                jurisdiction: entity.nationality_or_jurisdiction,
                registrationNumber: entity.registration_number,
                incorporationDate: entity.date_of_birth_or_incorporation,
                officerCount: appointmentCounts[current] || 0,
                subsidiaryCount: subsidiaryCounts[current] || 0,
                docStatus: docStatusMap[current] || "green",
                shareClasses: companyShareClassData[current] || [],
                visibility: {
                  capitalBadges: badgesOn,
                  officerCounts: visibility.officerCounts,
                  regNumbers: visibility.regNumbers,
                  incDates: visibility.incDates,
                },
              }
            : {
                label: entity.name,
                nationality: entity.nationality_or_jurisdiction,
                docStatus: docStatusMap[current] || "green",
                primaryRole: getSeniorRole(appointmentMap[current] || []),
                ownerships: ownershipsByEntity[current] || [],
                visibility: { personHoldings: visibility.personHoldings },
                entityId: current,
                profilePhotoThumb: entity.profile_photo_thumb,
              },
        });

        // Collect links for edge dedup
        const ownedLinks = uniqueLinks.filter((l) => l.owner_entity_id === current);
        ownedLinks.forEach((link) => {
          const pairKey = `${link.owner_entity_id}__${link.owned_entity_id}`;
          if (!edgeMap.has(pairKey)) edgeMap.set(pairKey, { links: [], source: link.owner_entity_id, target: link.owned_entity_id });
          edgeMap.get(pairKey)!.links.push(link);
          if (!visitedNodes.has(link.owned_entity_id)) {
            visitedNodes.add(link.owned_entity_id);
            queue.push(link.owned_entity_id);
          }
        });

        const ownerLinks = uniqueLinks.filter((l) => l.owned_entity_id === current);
        ownerLinks.forEach((link) => {
          if (!visitedNodes.has(link.owner_entity_id)) {
            visitedNodes.add(link.owner_entity_id);
            queue.push(link.owner_entity_id);
          }
          const pairKey = `${link.owner_entity_id}__${link.owned_entity_id}`;
          if (!edgeMap.has(pairKey)) edgeMap.set(pairKey, { links: [], source: link.owner_entity_id, target: link.owned_entity_id });
          const existing = edgeMap.get(pairKey)!;
          if (!existing.links.find((l: any) => l.id === link.id)) existing.links.push(link);
        });
      }

      // Build deduplicated edges
      const graphEdges: Edge[] = [];
      edgeMap.forEach((val, key) => {
        const edgeLabelLinks = Array.from(
          new Map(
            val.links.map((link: any) => [
              link.id,
              {
                id: link.id,
                sharesOwned: link.shares_owned,
                percentage: Number(link.percentage),
                shareClassName: link.share_class_id ? (shareClassMap[link.share_class_id]?.class_name ?? "Equity") : "Equity",
                votingRights: link.share_class_id ? (shareClassMap[link.share_class_id]?.voting_rights ?? true) : true,
              },
            ])
          ).values()
        );

        const maxPct = Math.max(...edgeLabelLinks.map((link) => link.percentage));
        const color = maxPct > 50 ? "#16A34A" : maxPct >= 25 ? "#D97706" : "#94A3B8";

        graphEdges.push({
          id: key,
          source: val.source,
          target: val.target,
          type: "custom",
          markerEnd: { type: "arrowclosed" as any, color },
          data: {
            links: edgeLabelLinks,
            showLabels: visibility.edgeLabels,
            maxPct,
          },
        });
      });

      // Compute dimensions
      const dims: Record<string, { width: number; height: number }> = {};
      graphNodes.forEach((n) => {
        if (n.type === "companyNode") {
          dims[n.id] = { width: badgesOn ? 440 : 280, height: 150 };
        } else {
          dims[n.id] = { width: 260, height: 140 };
        }
      });

      return { nodes: graphNodes, edges: graphEdges, dims };
    },
    [rootId, filteredLinks, entityMap, shareClassMap, appointmentCounts, appointmentMap, docStatusMap, companyShareClassData, subsidiaryCounts, visibility]
  );

  // Build + layout when data or layout-affecting state changes
  useEffect(() => {
    const graph = buildGraph(visibility.capitalBadges);
    if (!graph) {
      setNodes([]);
      setEdges([]);
      rawGraphRef.current = null;
      return;
    }
    rawGraphRef.current = graph;
    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
      graph.nodes,
      graph.edges,
      layoutDirection,
      graph.dims
    );
    setNodes(layouted);
    setEdges(layoutedEdges);
  }, [buildGraph, layoutDirection, visibility.capitalBadges]);

  // Re-run layout when layoutDirection or capitalBadges toggle changes
  // (handled in the useEffect above since both are deps)

  // Update edge label visibility without re-layout
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...e.data, showLabels: visibility.edgeLabels },
      }))
    );
  }, [visibility.edgeLabels]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const entity = entityMap[node.id];
    if (entity) { setSelectedEntity(entity); setSheetOpen(true); }
  }, [entityMap]);

  const handleExportPng = useCallback(() => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    toPng(el, { backgroundColor: "#F8FAFC", width: el.scrollWidth, height: el.scrollHeight }).then((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "org-chart.png";
      a.click();
    });
  }, []);

  const directShareholders = useMemo(() => {
    if (!rootId) return [];
    return allLinks
      .filter((l) => l.owned_entity_id === rootId)
      .map((l) => ({ ...l, entity: entityMap[l.owner_entity_id], shareClass: l.share_class_id ? shareClassMap[l.share_class_id] : null }))
      .filter((l) => l.entity);
  }, [rootId, allLinks, entityMap, shareClassMap]);

  const rootEntity = entityMap[rootId];

  const [chartView, setChartView] = useState<"ownership" | "governance">(() => {
    try { return (localStorage.getItem("orgchart-view") as "ownership" | "governance") || "ownership"; } catch { return "ownership"; }
  });
  useEffect(() => { try { localStorage.setItem("orgchart-view", chartView); } catch {} }, [chartView]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Org Chart</h1>
        <Tabs value={chartView} onValueChange={(v) => setChartView(v as "ownership" | "governance")}>
          <TabsList>
            <TabsTrigger value="ownership" className="gap-1.5"><Link2 className="h-4 w-4" /> Ownership Chart</TabsTrigger>
            <TabsTrigger value="governance" className="gap-1.5"><Users className="h-4 w-4" /> Governance Chart</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {rootId && rootShareClasses.length > 0 && (
        <ShareSummaryPanel
          shareClasses={rootShareClasses}
          allLinks={allLinks}
          rootId={rootId}
          selectedShareClass={selectedShareClass}
          onShareClassChange={setSelectedShareClass}
        />
      )}

      <div className="rounded-lg border shadow-sm" style={{ height: "55vh", background: "#F8FAFC" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#CBD5E1" />
          <Controls showInteractive={false} />
          {showMinimap && (
            <MiniMap
              style={{ backgroundColor: "#F8FAFC" }}
              nodeColor={(node) => (node.type === "personNode" ? "#3B82F6" : "#0F172A")}
              maskColor="rgba(0,0,0,0.1)"
            />
          )}
          <Panel position="top-left">
            <div className="bg-background border rounded-lg p-2 shadow-sm">
              <Select value={rootId} onValueChange={(v) => { setSearchParams({ root: v }); setSelectedShareClass("all"); }}>
                <SelectTrigger className="w-64"><SelectValue placeholder="View from entity..." /></SelectTrigger>
                <SelectContent>
                  {companyEntities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Panel>
          <Panel position="top-right">
            <ChartControls
              layoutDirection={layoutDirection}
              onLayoutChange={setLayoutDirection}
              visibility={visibility}
              onVisibilityChange={setVisibility}
              showMinimap={showMinimap}
              onMinimapToggle={() => setShowMinimap((v) => !v)}
              onExportPng={handleExportPng}
            />
          </Panel>
          {!rootId && (
            <Panel position="top-center" className="mt-32">
              <div className="text-muted-foreground text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Select a company above to view its ownership structure.</p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {rootId && rootEntity && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Direct Shareholders of {rootEntity.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {directShareholders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No direct shareholders found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity Name</TableHead>
                    <TableHead>Share Class</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Direct %</TableHead>
                    <TableHead>Voting</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directShareholders.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.entity.name}</TableCell>
                      <TableCell>{s.shareClass?.class_name || "—"}</TableCell>
                      <TableCell>{s.shares_owned ? s.shares_owned.toLocaleString() : "—"}</TableCell>
                      <TableCell>{Number(s.percentage).toFixed(2)}%</TableCell>
                      <TableCell>
                        {s.shareClass ? (
                          s.shareClass.voting_rights ? <Badge className="bg-success/20 text-success border-0 text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">Non-voting</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {s.entity.type === "person" ? <User className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                          {s.entity.type === "person" ? "Person" : "Company"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {rootId && rootEntity && (
        <UnallocatedReport
          rootId={rootId}
          rootEntity={rootEntity}
          shareClasses={rootShareClasses}
          allLinks={allLinks}
          entityMap={entityMap}
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedEntity?.type === "person" ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
              {selectedEntity?.name}
            </SheetTitle>
          </SheetHeader>
          {selectedEntity && (
            <div className="mt-6 space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <p className="font-medium">{selectedEntity.type === "person" ? "Person" : "Company"}</p>
              </div>
              {selectedEntity.nationality_or_jurisdiction && (
                <div>
                  <span className="text-sm text-muted-foreground">{selectedEntity.type === "person" ? "Nationality" : "Jurisdiction"}</span>
                  <p className="font-medium">{selectedEntity.nationality_or_jurisdiction}</p>
                </div>
              )}
              {selectedEntity.company_type && (
                <div>
                  <span className="text-sm text-muted-foreground">Company Type</span>
                  <p className="font-medium">{selectedEntity.company_type}</p>
                </div>
              )}
              <Button className="w-full mt-4" onClick={() => { setSheetOpen(false); navigate(`/entities/${selectedEntity.id}`); }}>
                View Full Profile
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
