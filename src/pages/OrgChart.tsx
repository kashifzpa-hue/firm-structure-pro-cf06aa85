import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
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
import { Building2, User, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { ShareSummaryPanel } from "@/components/orgchart/ShareSummaryPanel";
import { UnallocatedReport } from "@/components/orgchart/UnallocatedReport";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
  nodes.forEach((node) => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);
  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id);
    return { ...node, position: { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 } };
  });
  return { nodes: layoutedNodes, edges };
}

function EntityNode({ data }: { data: any }) {
  const isCompany = data.type === "company";
  return (
    <div
      className="rounded-lg px-4 py-3 shadow-md cursor-pointer text-center min-w-[200px]"
      style={{ backgroundColor: isCompany ? "#0F172A" : "#3B82F6", color: "#FFFFFF" }}
    >
      <div className="font-semibold text-sm truncate">{data.label}</div>
      <div className="text-xs opacity-80 mt-0.5">{isCompany ? data.companyType || "Company" : "Individual"}</div>
      {data.ownerships && data.ownerships.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {data.ownerships.map((o: any, i: number) => (
            <div key={i} className="text-[10px] opacity-70 truncate">
              Owns {o.percentage.toFixed(1)}% of {o.targetName}
            </div>
          ))}
        </div>
      )}
      {isCompany && data.officerCount > 0 && (
        <div className="text-xs opacity-70 mt-1 flex items-center justify-center gap-1">
          <User className="h-3 w-3" /> {data.officerCount}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode };

export default function OrgChart() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rootId = searchParams.get("root") || "";

  const [entities, setEntities] = useState<any[]>([]);
  const [allLinks, setAllLinks] = useState<any[]>([]);
  const [shareClasses, setShareClasses] = useState<any[]>([]);
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedShareClass, setSelectedShareClass] = useState("all");

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entRes, linksRes, apptsRes, scRes] = await Promise.all([
        supabase.from("entities").select("*").eq("workspace_id", workspaceId).order("name"),
        supabase.from("equity_links").select("*").eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("appointments").select("company_entity_id").eq("workspace_id", workspaceId).is("resignation_date", null),
        supabase.from("share_classes").select("*").eq("workspace_id", workspaceId),
      ]);
      setEntities(entRes.data || []);
      setAllLinks(linksRes.data || []);
      const counts: Record<string, number> = {};
      (apptsRes.data || []).forEach((a: any) => { counts[a.company_entity_id] = (counts[a.company_entity_id] || 0) + 1; });
      setAppointmentCounts(counts);
      setShareClasses(scRes.data || []);
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

  // Filter links by selected share class
  const filteredLinks = useMemo(() => {
    if (selectedShareClass === "all") return allLinks;
    return allLinks.filter((l) => l.share_class_id === selectedShareClass);
  }, [allLinks, selectedShareClass]);

  useEffect(() => {
    if (!rootId || !filteredLinks.length) { setNodes([]); setEdges([]); return; }

    const visitedNodes = new Set<string>();
    const graphNodes: Node[] = [];
    const graphEdges: Edge[] = [];
    const queue = [rootId];
    visitedNodes.add(rootId);

    // Pre-compute ownerships for each entity
    const ownershipsByEntity: Record<string, { targetName: string; percentage: number }[]> = {};
    filteredLinks.forEach((link) => {
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

      graphNodes.push({
        id: current,
        type: "entityNode",
        position: { x: 0, y: 0 },
        data: {
          label: entity.name,
          type: entity.type,
          companyType: entity.company_type,
          officerCount: appointmentCounts[current] || 0,
          ownerships: ownershipsByEntity[current] || [],
        },
      });

      const ownedLinks = filteredLinks.filter((l) => l.owner_entity_id === current);
      ownedLinks.forEach((link) => {
        const pct = Number(link.percentage);
        const color = pct > 50 ? "hsl(142.1, 76.2%, 36.3%)" : pct >= 25 ? "hsl(38, 92%, 50%)" : "hsl(215, 16%, 47%)";
        const sc = link.share_class_id ? shareClassMap[link.share_class_id] : null;
        const labelParts: string[] = [];
        if (sc) labelParts.push(sc.class_name);
        if (link.shares_owned) labelParts.push(`${link.shares_owned.toLocaleString()} shares`);
        labelParts.push(`${pct.toFixed(2)}%`);
        graphEdges.push({
          id: link.id,
          source: current,
          target: link.owned_entity_id,
          label: labelParts.join(" · "),
          style: { stroke: color, strokeWidth: 2 },
          labelStyle: { fontSize: 11, fontWeight: 600 },
          markerEnd: { type: "arrowclosed" as any, color },
          data: { link, shareClass: sc },
        });
        if (!visitedNodes.has(link.owned_entity_id)) {
          visitedNodes.add(link.owned_entity_id);
          queue.push(link.owned_entity_id);
        }
      });

      const ownerLinks = filteredLinks.filter((l) => l.owned_entity_id === current);
      ownerLinks.forEach((link) => {
        const pct = Number(link.percentage);
        const color = pct > 50 ? "hsl(142.1, 76.2%, 36.3%)" : pct >= 25 ? "hsl(38, 92%, 50%)" : "hsl(215, 16%, 47%)";
        if (!visitedNodes.has(link.owner_entity_id)) {
          visitedNodes.add(link.owner_entity_id);
          queue.push(link.owner_entity_id);
        }
        if (!graphEdges.find((e) => e.id === link.id)) {
          const sc = link.share_class_id ? shareClassMap[link.share_class_id] : null;
          const labelParts: string[] = [];
          if (sc) labelParts.push(sc.class_name);
          if (link.shares_owned) labelParts.push(`${link.shares_owned.toLocaleString()} shares`);
          labelParts.push(`${pct.toFixed(2)}%`);
          graphEdges.push({
            id: link.id,
            source: link.owner_entity_id,
            target: link.owned_entity_id,
            label: labelParts.join(" · "),
            style: { stroke: color, strokeWidth: 2 },
            labelStyle: { fontSize: 11, fontWeight: 600 },
            markerEnd: { type: "arrowclosed" as any, color },
            data: { link, shareClass: sc },
          });
        }
      });
    }

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(graphNodes, graphEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
  }, [rootId, filteredLinks, entityMap, shareClassMap, appointmentCounts]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const entity = entityMap[node.id];
    if (entity) { setSelectedEntity(entity); setSheetOpen(true); }
  }, [entityMap]);

  const handleExportPng = useCallback(() => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    toPng(el, { backgroundColor: "#F8FAFC" }).then((url) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Org Chart</h1>
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
          fitView
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#CBD5E1" />
          <Controls showInteractive={false} />
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
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={handleExportPng} title="Export as PNG">
                <Download className="h-4 w-4" />
              </Button>
            </div>
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
                          s.shareClass.voting_rights ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Yes</Badge> : <Badge variant="secondary" className="text-xs">Non-voting</Badge>
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
