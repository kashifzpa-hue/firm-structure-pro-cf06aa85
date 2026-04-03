import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  Handle,
  Position,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Building2, Download, Eye, Map, Landmark, Briefcase } from "lucide-react";
import { toPng } from "html-to-image";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getAvatarColor, getInitials } from "@/lib/entity-avatar";
import { differenceInDays, parseISO, isValid } from "date-fns";
import { useNavigate } from "react-router-dom";
import { EntityAvatar } from "@/components/EntityAvatar";

/* ── Doc status helper ── */
function computeDocStatus(docs: { entity_id: string; expiry_date: string | null }[]): Record<string, "green" | "amber" | "red"> {
  const map: Record<string, "green" | "amber" | "red"> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byEntity: Record<string, { expiry_date: string | null }[]> = {};
  docs.forEach((d) => { if (!byEntity[d.entity_id]) byEntity[d.entity_id] = []; byEntity[d.entity_id].push(d); });
  for (const [entityId, eDocs] of Object.entries(byEntity)) {
    let hasExpired = false, hasExpiring = false;
    for (const doc of eDocs) {
      if (!doc.expiry_date) continue;
      const date = parseISO(doc.expiry_date);
      if (!isValid(date)) continue;
      const days = differenceInDays(date, today);
      if (days < 0) { hasExpired = true; break; }
      if (days <= 60) hasExpiring = true;
    }
    map[entityId] = hasExpired ? "red" : hasExpiring ? "amber" : "green";
  }
  return map;
}

/* ── Governance Company Node ── */
interface GovCompanyData {
  label: string;
  companyType?: string;
  jurisdiction?: string;
  docStatus: "green" | "amber" | "red";
  boardCount: number;
  managementCount: number;
}
const STATUS_COLORS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

function GovCompanyNode({ data }: { data: GovCompanyData }) {
  return (
    <div className="rounded-lg shadow-lg flex overflow-hidden" style={{ backgroundColor: "#0F172A", color: "#FFFFFF", minWidth: 280 }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex-grow px-3 py-2.5 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[data.docStatus] }} />
          <span className="font-semibold text-sm truncate">{data.label}</span>
        </div>
        <div className="text-[11px] opacity-70 truncate">{[data.companyType, data.jurisdiction].filter(Boolean).join(" · ") || "Company"}</div>
      </div>
      <div className="border-l border-white/10 px-2 py-2.5 flex-shrink-0 text-[10px]" style={{ width: 140 }}>
        <div className="font-semibold text-[11px] mb-1 opacity-80">GOVERNANCE</div>
        {data.boardCount > 0 && <div className="flex items-center gap-1 opacity-70"><Landmark className="h-3 w-3" /> {data.boardCount} Director{data.boardCount !== 1 ? "s" : ""}</div>}
        {data.managementCount > 0 && <div className="flex items-center gap-1 opacity-70 mt-0.5"><Briefcase className="h-3 w-3" /> {data.managementCount} Management</div>}
        <div className="mt-1 pt-1 border-t border-white/10 opacity-60">{data.boardCount + data.managementCount} Total Officers</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}

/* ── Governance Person Node ── */
interface GovPersonData {
  label: string;
  nationality?: string;
  docStatus: "green" | "amber" | "red";
  roleTitle: string;
  roleCategory: "board" | "management";
  entityId?: string;
  profilePhotoThumb?: string | null;
  showPhotos: boolean;
  showRoleTitles: boolean;
  showNationality: boolean;
  showAppointmentDate: boolean;
  appointmentDate?: string;
}

function GovPersonNode({ data }: { data: GovPersonData }) {
  const initials = getInitials(data.label);
  const bgColor = data.entityId ? getAvatarColor(data.entityId) : "#3B82F6";
  const isBoard = data.roleCategory === "board";

  return (
    <div className="rounded-lg shadow-lg px-3 py-2.5 text-left" style={{ background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#FFFFFF", width: 240 }}>
      <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-2 !h-2" />
      <div className="flex items-center gap-2 mb-1">
        {data.showPhotos && (
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30">
            {data.profilePhotoThumb ? (
              <img src={data.profilePhotoThumb} alt={data.label} className="w-full h-full object-cover" onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }} />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center text-white text-xs font-semibold ${data.profilePhotoThumb ? "hidden" : ""}`} style={{ backgroundColor: bgColor }}>{initials}</div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[data.docStatus] }} />
            <span className="font-semibold text-sm truncate">{data.label}</span>
          </div>
          {data.showNationality && data.nationality && <div className="text-[11px] opacity-70 truncate">{data.nationality}</div>}
        </div>
      </div>
      {data.showRoleTitles && (
        <div className="text-[10px] opacity-80 mt-1 bg-white/10 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
          {isBoard ? <Landmark className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
          {data.roleTitle}
        </div>
      )}
      {data.showAppointmentDate && data.appointmentDate && (
        <div className="text-[9px] opacity-60 mt-0.5">Appointed: {new Date(data.appointmentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-300 !w-2 !h-2" />
    </div>
  );
}

/* ── Category label node ── */
function CategoryLabelNode({ data }: { data: { label: string } }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1" style={{ width: 200, textAlign: "center" }}>
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-0 !h-0" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-0 !h-0" />
    </div>
  );
}

const govNodeTypes = {
  govCompanyNode: GovCompanyNode,
  govPersonNode: GovPersonNode,
  categoryLabel: CategoryLabelNode,
};

/* ── Layout helper ── */
function layoutGovGraph(nodes: Node[], edges: Edge[], dims: Record<string, { width: number; height: number }>) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });
  nodes.forEach((n) => { const d = dims[n.id] || { width: 240, height: 100 }; g.setNode(n.id, { width: d.width, height: d.height }); });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => { const nd = g.node(n.id); const d = dims[n.id] || { width: 240, height: 100 }; return { ...n, position: { x: nd.x - d.width / 2, y: nd.y - d.height / 2 } }; });
}

/* ── Governance edge (solid line) ── */
function GovEdge({ id, sourceX, sourceY, targetX, targetY, data }: any) {
  const color = data?.roleCategory === "board" ? "#0F172A" : "#3B82F6";
  const midY = (sourceY + targetY) / 2;
  const path = `M${sourceX},${sourceY} C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;
  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={2} markerEnd={`url(#gov-arrow-${data?.roleCategory || "board"})`} />
      {data?.showLabels && data?.roleTitle && (
        <foreignObject x={(sourceX + targetX) / 2 - 60} y={midY - 12} width={120} height={24} className="overflow-visible">
          <div className="bg-white rounded px-1.5 py-0.5 shadow-sm text-[9px] text-center font-medium truncate" style={{ color: "#0F172A" }}>{data.roleTitle}</div>
        </foreignObject>
      )}
    </g>
  );
}

const govEdgeTypes = { govEdge: GovEdge };

/* ── Visibility flags ── */
interface GovVisibility {
  boardDirectors: boolean;
  keyManagement: boolean;
  profilePhotos: boolean;
  roleTitles: boolean;
  appointmentDates: boolean;
  nationality: boolean;
}

/* ── Main Component ── */
interface GovernanceChartProps {
  height?: string;
}

export function GovernanceChart({ height = "55vh" }: GovernanceChartProps) {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();

  const [entities, setEntities] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [docStatusMap, setDocStatusMap] = useState<Record<string, "green" | "amber" | "red">>({});

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [rootId, setRootId] = useState<string>("__all__");
  const [showMinimap, setShowMinimap] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [selectedPersonRoles, setSelectedPersonRoles] = useState<any[]>([]);

  const [visibility, setVisibility] = useState<GovVisibility>({
    boardDirectors: true,
    keyManagement: true,
    profilePhotos: true,
    roleTitles: true,
    appointmentDates: false,
    nationality: false,
  });

  const entityMap = useMemo(() => Object.fromEntries(entities.map((e) => [e.id, e])), [entities]);
  const companyEntities = useMemo(() => entities.filter((e) => e.type === "company"), [entities]);

  // Fetch data
  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const [entRes, appRes, docRes] = await Promise.all([
        supabase.from("entities").select("*").eq("workspace_id", workspaceId).order("name"),
        supabase.from("appointments").select("*").eq("workspace_id", workspaceId).is("resignation_date", null),
        supabase.from("documents").select("id, entity_id, expiry_date").eq("workspace_id", workspaceId),
      ]);
      setEntities(entRes.data || []);
      setAppointments(appRes.data || []);
      setDocStatusMap(computeDocStatus(docRes.data || []));
    };
    fetch();
  }, [workspaceId]);

  // Build graph
  const buildGovernanceGraph = useCallback(() => {
    const activeAppts = appointments.filter((a) => {
      if (!visibility.boardDirectors && a.role_category === "board") return false;
      if (!visibility.keyManagement && a.role_category === "management") return false;
      return true;
    });

    const companies = rootId === "__all__"
      ? companyEntities
      : companyEntities.filter((c) => c.id === rootId);

    const graphNodes: Node[] = [];
    const graphEdges: Edge[] = [];
    const dims: Record<string, { width: number; height: number }> = {};

    let treeOffset = 0;

    companies.forEach((company) => {
      const companyAppts = activeAppts.filter((a) => a.company_entity_id === company.id);
      const boardAppts = companyAppts.filter((a) => a.role_category === "board");
      const mgmtAppts = companyAppts.filter((a) => a.role_category === "management");

      const companyNodeId = `gov-co-${company.id}`;
      graphNodes.push({
        id: companyNodeId,
        type: "govCompanyNode",
        position: { x: 0, y: 0 },
        data: {
          label: company.name,
          companyType: company.company_type,
          jurisdiction: company.nationality_or_jurisdiction,
          docStatus: docStatusMap[company.id] || "green",
          boardCount: boardAppts.length,
          managementCount: mgmtAppts.length,
        },
      });
      dims[companyNodeId] = { width: 420, height: 100 };

      if (companyAppts.length === 0) {
        const placeholderId = `gov-empty-${company.id}`;
        graphNodes.push({
          id: placeholderId,
          type: "categoryLabel",
          position: { x: 0, y: 0 },
          data: { label: "No board or management recorded" },
        });
        dims[placeholderId] = { width: 200, height: 30 };
        graphEdges.push({ id: `e-${companyNodeId}-${placeholderId}`, source: companyNodeId, target: placeholderId, type: "govEdge", data: { roleCategory: "board", showLabels: false } });
      }

      // Board column
      if (boardAppts.length > 0) {
        const boardLabelId = `gov-bl-${company.id}`;
        graphNodes.push({ id: boardLabelId, type: "categoryLabel", position: { x: 0, y: 0 }, data: { label: "Board of Directors" } });
        dims[boardLabelId] = { width: 200, height: 24 };
        graphEdges.push({ id: `e-${companyNodeId}-${boardLabelId}`, source: companyNodeId, target: boardLabelId, type: "govEdge", data: { roleCategory: "board", showLabels: false } });

        boardAppts.forEach((a, i) => {
          const person = entityMap[a.person_entity_id];
          if (!person) return;
          const nodeId = `gov-p-${a.id}`;
          graphNodes.push({
            id: nodeId,
            type: "govPersonNode",
            position: { x: 0, y: 0 },
            data: {
              label: person.name,
              nationality: person.nationality_or_jurisdiction,
              docStatus: docStatusMap[person.id] || "green",
              roleTitle: a.role_title,
              roleCategory: "board",
              entityId: person.id,
              profilePhotoThumb: person.profile_photo_thumb,
              showPhotos: visibility.profilePhotos,
              showRoleTitles: visibility.roleTitles,
              showNationality: visibility.nationality,
              showAppointmentDate: visibility.appointmentDates,
              appointmentDate: a.appointment_date,
            },
          });
          dims[nodeId] = { width: 240, height: visibility.appointmentDates ? 110 : 90 };
          graphEdges.push({
            id: `e-${boardLabelId}-${nodeId}`,
            source: boardLabelId,
            target: nodeId,
            type: "govEdge",
            data: { roleCategory: "board", roleTitle: visibility.roleTitles ? a.role_title : undefined, showLabels: visibility.roleTitles },
          });
        });
      }

      // Management column
      if (mgmtAppts.length > 0) {
        const mgmtLabelId = `gov-ml-${company.id}`;
        graphNodes.push({ id: mgmtLabelId, type: "categoryLabel", position: { x: 0, y: 0 }, data: { label: "Key Management" } });
        dims[mgmtLabelId] = { width: 200, height: 24 };
        graphEdges.push({ id: `e-${companyNodeId}-${mgmtLabelId}`, source: companyNodeId, target: mgmtLabelId, type: "govEdge", data: { roleCategory: "management", showLabels: false } });

        mgmtAppts.forEach((a) => {
          const person = entityMap[a.person_entity_id];
          if (!person) return;
          const nodeId = `gov-p-${a.id}`;
          graphNodes.push({
            id: nodeId,
            type: "govPersonNode",
            position: { x: 0, y: 0 },
            data: {
              label: person.name,
              nationality: person.nationality_or_jurisdiction,
              docStatus: docStatusMap[person.id] || "green",
              roleTitle: a.role_title,
              roleCategory: "management",
              entityId: person.id,
              profilePhotoThumb: person.profile_photo_thumb,
              showPhotos: visibility.profilePhotos,
              showRoleTitles: visibility.roleTitles,
              showNationality: visibility.nationality,
              showAppointmentDate: visibility.appointmentDates,
              appointmentDate: a.appointment_date,
            },
          });
          dims[nodeId] = { width: 240, height: visibility.appointmentDates ? 110 : 90 };
          graphEdges.push({
            id: `e-${mgmtLabelId}-${nodeId}`,
            source: mgmtLabelId,
            target: nodeId,
            type: "govEdge",
            data: { roleCategory: "management", roleTitle: visibility.roleTitles ? a.role_title : undefined, showLabels: visibility.roleTitles },
          });
        });
      }
    });

    return { nodes: graphNodes, edges: graphEdges, dims };
  }, [appointments, companyEntities, entityMap, docStatusMap, rootId, visibility]);

  useEffect(() => {
    if (!entities.length) return;
    const graph = buildGovernanceGraph();
    const layoutedNodes = layoutGovGraph(graph.nodes, graph.edges, graph.dims);
    setNodes(layoutedNodes);
    setEdges(graph.edges);
  }, [buildGovernanceGraph, entities]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type !== "govPersonNode") return;
    const personId = (node.data as any).entityId;
    const person = entityMap[personId];
    if (!person) return;
    const roles = appointments
      .filter((a) => a.person_entity_id === personId)
      .map((a) => ({
        ...a,
        companyName: entityMap[a.company_entity_id]?.name || "Unknown",
      }));
    setSelectedPerson(person);
    setSelectedPersonRoles(roles);
    setSheetOpen(true);
  }, [entityMap, appointments]);

  const handleExportPng = useCallback(() => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    toPng(el, { backgroundColor: "#F8FAFC", width: el.scrollWidth, height: el.scrollHeight }).then((url) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "governance-chart.png";
      a.click();
    });
  }, []);

  const toggleVis = (key: keyof GovVisibility) => setVisibility((v) => ({ ...v, [key]: !v[key] }));

  return (
    <>
      <div className="rounded-lg border shadow-sm" style={{ height, background: "#F8FAFC" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={govNodeTypes}
          edgeTypes={govEdgeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <defs>
            <marker id="gov-arrow-board" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#0F172A" />
            </marker>
            <marker id="gov-arrow-management" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#3B82F6" />
            </marker>
          </defs>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#CBD5E1" />
          <Controls showInteractive={false} />
          {showMinimap && (
            <MiniMap
              style={{ backgroundColor: "#F8FAFC" }}
              nodeColor={(node) => (node.type === "govPersonNode" ? "#3B82F6" : node.type === "govCompanyNode" ? "#0F172A" : "#CBD5E1")}
              maskColor="rgba(0,0,0,0.1)"
            />
          )}
          <Panel position="top-left">
            <div className="bg-background border rounded-lg p-2 shadow-sm">
              <Select value={rootId} onValueChange={setRootId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="View from company..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Companies</SelectItem>
                  {companyEntities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Panel>
          <Panel position="top-right">
            <div className="flex gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" title="Show / Hide"><Eye className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Show / Hide</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={visibility.boardDirectors} onCheckedChange={() => toggleVis("boardDirectors")}>Board of Directors</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibility.keyManagement} onCheckedChange={() => toggleVis("keyManagement")}>Key Management</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibility.profilePhotos} onCheckedChange={() => toggleVis("profilePhotos")}>Profile Photos</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibility.roleTitles} onCheckedChange={() => toggleVis("roleTitles")}>Role Titles</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibility.appointmentDates} onCheckedChange={() => toggleVis("appointmentDates")}>Appointment Dates</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibility.nationality} onCheckedChange={() => toggleVis("nationality")}>Nationality</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant={showMinimap ? "default" : "outline"} size="icon" onClick={() => setShowMinimap((v) => !v)} title="Toggle minimap">
                <Map className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleExportPng} title="Export as PNG">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </Panel>
          {entities.length > 0 && appointments.length === 0 && (
            <Panel position="top-center" className="mt-32">
              <div className="text-muted-foreground text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No board or management appointments found.</p>
                <p className="text-sm">Add appointments from the Board & Management tab on each entity.</p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {rootId === "__all__" && appointments.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Persons appearing in multiple companies are shown separately per company.
        </p>
      )}

      {/* Person Side Panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedPerson && (
                <EntityAvatar entityId={selectedPerson.id} name={selectedPerson.name} photoUrl={selectedPerson.profile_photo_thumb} size="lg" />
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedPerson && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedPerson.name}</h3>
                {selectedPerson.nationality_or_jurisdiction && <p className="text-sm text-muted-foreground">{selectedPerson.nationality_or_jurisdiction}</p>}
              </div>

              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold mb-2">Active Roles</h4>
                <div className="space-y-3">
                  {selectedPersonRoles.map((r) => (
                    <div key={r.id} className="text-sm">
                      <button className="font-medium text-primary hover:underline" onClick={() => { setSheetOpen(false); setRootId(r.company_entity_id); }}>
                        {r.companyName}
                      </button>
                      <span className="text-muted-foreground"> — {r.role_title} ({r.role_category === "board" ? "Board" : "Management"})</span>
                      <div className="text-xs text-muted-foreground">
                        Appointed: {new Date(r.appointment_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPerson.professional_bio && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-1">Professional Bio</h4>
                  <p className="text-sm text-muted-foreground">{selectedPerson.professional_bio}</p>
                </div>
              )}

              {selectedPerson.qualifications && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-1">Qualifications</h4>
                  <p className="text-sm text-muted-foreground">{selectedPerson.qualifications}</p>
                </div>
              )}

              <div className="border-t pt-3 space-y-2">
                <Button className="w-full" onClick={() => { setSheetOpen(false); navigate(`/entities/${selectedPerson.id}`); }}>
                  View Full Profile →
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
