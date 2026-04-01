import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { Building2, User, ZoomIn, ZoomOut, Maximize, Download, X } from "lucide-react";
import { toPng } from "html-to-image";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

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
      className="rounded-lg px-4 py-3 shadow-md cursor-pointer text-center min-w-[180px]"
      style={{ backgroundColor: isCompany ? "#0F172A" : "#3B82F6", color: "#FFFFFF" }}
    >
      <div className="font-semibold text-sm truncate">{data.label}</div>
      <div className="text-xs opacity-80 mt-0.5">{isCompany ? data.companyType || "Company" : "Individual"}</div>
      {isCompany && data.officerCount > 0 && (
        <div className="text-xs opacity-70 mt-1 flex items-center justify-center gap-1">
          <User className="h-3 w-3" /> {data.officerCount} Officer{data.officerCount !== 1 ? "s" : ""}
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
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, number>>({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchData = async () => {
      const [entRes, linksRes, apptsRes] = await Promise.all([
        supabase.from("entities").select("*").eq("workspace_id", workspaceId).order("name"),
        supabase.from("equity_links").select("*").eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("appointments").select("company_entity_id").eq("workspace_id", workspaceId).is("resignation_date", null),
      ]);
      setEntities(entRes.data || []);
      setAllLinks(linksRes.data || []);
      // Count officers per company
      const counts: Record<string, number> = {};
      (apptsRes.data || []).forEach((a: any) => { counts[a.company_entity_id] = (counts[a.company_entity_id] || 0) + 1; });
      setAppointmentCounts(counts);
    };
    fetchData();
  }, [workspaceId]);

  const companyEntities = useMemo(() => entities.filter((e) => e.type === "company"), [entities]);
  const entityMap = useMemo(() => Object.fromEntries(entities.map((e) => [e.id, e])), [entities]);

  // Build graph from root
  useEffect(() => {
    if (!rootId || !allLinks.length) { setNodes([]); setEdges([]); return; }

    const visitedNodes = new Set<string>();
    const graphNodes: Node[] = [];
    const graphEdges: Edge[] = [];

    // BFS downward from root
    const queue = [rootId];
    visitedNodes.add(rootId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const entity = entityMap[current];
      if (!entity) continue;

      graphNodes.push({
        id: current,
        type: "entityNode",
        position: { x: 0, y: 0 },
        data: { label: entity.name, type: entity.type, companyType: entity.company_type },
      });

      // Find entities owned by current
      const ownedLinks = allLinks.filter((l) => l.owner_entity_id === current);
      ownedLinks.forEach((link) => {
        const pct = Number(link.percentage);
        const color = pct > 50 ? "hsl(142.1, 76.2%, 36.3%)" : pct >= 25 ? "hsl(38, 92%, 50%)" : "hsl(215, 16%, 47%)";
        graphEdges.push({
          id: link.id,
          source: current,
          target: link.owned_entity_id,
          label: `${pct.toFixed(2)}%`,
          style: { stroke: color, strokeWidth: 2 },
          labelStyle: { fontSize: 12, fontWeight: 600 },
          markerEnd: { type: "arrowclosed" as any, color },
        });
        if (!visitedNodes.has(link.owned_entity_id)) {
          visitedNodes.add(link.owned_entity_id);
          queue.push(link.owned_entity_id);
        }
      });

      // Also find owners of current (upward)
      const ownerLinks = allLinks.filter((l) => l.owned_entity_id === current);
      ownerLinks.forEach((link) => {
        const pct = Number(link.percentage);
        const color = pct > 50 ? "hsl(142.1, 76.2%, 36.3%)" : pct >= 25 ? "hsl(38, 92%, 50%)" : "hsl(215, 16%, 47%)";
        if (!visitedNodes.has(link.owner_entity_id)) {
          visitedNodes.add(link.owner_entity_id);
          queue.push(link.owner_entity_id);
        }
        // Edge always from owner to owned
        if (!graphEdges.find((e) => e.id === link.id)) {
          graphEdges.push({
            id: link.id,
            source: link.owner_entity_id,
            target: link.owned_entity_id,
            label: `${pct.toFixed(2)}%`,
            style: { stroke: color, strokeWidth: 2 },
            labelStyle: { fontSize: 12, fontWeight: 600 },
            markerEnd: { type: "arrowclosed" as any, color },
          });
        }
      });
    }

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(graphNodes, graphEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
  }, [rootId, allLinks, entityMap]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const entity = entityMap[node.id];
    if (entity) {
      setSelectedEntity(entity);
      setSheetOpen(true);
    }
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

  // Direct shareholders for UBO preview
  const directShareholders = useMemo(() => {
    if (!rootId) return [];
    return allLinks
      .filter((l) => l.owned_entity_id === rootId)
      .map((l) => ({ ...l, entity: entityMap[l.owner_entity_id] }))
      .filter((l) => l.entity);
  }, [rootId, allLinks, entityMap]);

  const rootEntity = entityMap[rootId];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Org Chart</h1>
      </div>

      <div className="rounded-lg border shadow-sm" style={{ height: "60vh", background: "#F8FAFC" }}>
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
              <Select value={rootId} onValueChange={(v) => setSearchParams({ root: v })}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="View from entity..." />
                </SelectTrigger>
                <SelectContent>
                  {companyEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
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

      {/* UBO Preview */}
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
                    <TableHead>Direct %</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directShareholders.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.entity.name}</TableCell>
                      <TableCell>{Number(s.percentage).toFixed(2)}%</TableCell>
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
            <p className="text-sm text-muted-foreground italic mt-4">
              Ultimate Beneficial Owner (UBO) calculation across multiple holding layers will be available in a future update.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Entity Detail Sheet */}
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
