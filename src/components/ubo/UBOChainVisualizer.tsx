import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, TriangleAlert } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* ─── Custom Node: UBO Person (top of chain) ─── */
const UBOPersonNode = memo(({ data }: NodeProps) => {
  const d = data as any;
  return (
    <div
      className="rounded-lg shadow-lg text-white"
      style={{
        background: "linear-gradient(135deg, #3B82F6, #2563EB)",
        width: 220,
        opacity: d._opacity ?? 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-2 !h-2" />
      <div className="px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <User className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm truncate">{d.label}</span>
        </div>
        {d.subtitle && <div className="text-[11px] opacity-80">{d.subtitle}</div>}
        <div className="border-t border-white/20 my-1" />
        <div className="text-[11px] space-y-0.5">
          <div>Effective Economic: <span className="font-bold">{d.econPct}%</span></div>
          <div>Effective Voting: <span className="font-bold">{d.votePct}%</span></div>
        </div>
        {d.isAboveThreshold && (
          <div className="flex items-center gap-1 mt-1 bg-red-500/30 rounded px-1.5 py-0.5">
            <TriangleAlert className="h-3 w-3" />
            <span className="text-[10px] font-semibold">ABOVE 25% THRESHOLD</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-300 !w-2 !h-2" />
    </div>
  );
});
UBOPersonNode.displayName = "UBOPersonNode";

/* ─── Custom Node: Intermediate Company ─── */
const UBOCompanyNode = memo(({ data }: NodeProps) => {
  const d = data as any;
  return (
    <div
      className="rounded-lg shadow-lg text-white"
      style={{
        background: "#0F172A",
        width: 220,
        opacity: d._opacity ?? 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm truncate">{d.label}</span>
        </div>
        {d.subtitle && <div className="text-[11px] opacity-70">{d.subtitle}</div>}
        <div className="border-t border-white/20 my-1" />
        <div className="text-[11px] opacity-80">
          Passes through: <span className="font-bold">{d.passThroughPct}%</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
});
UBOCompanyNode.displayName = "UBOCompanyNode";

/* ─── Custom Node: Target Company (bottom) ─── */
const UBOTargetNode = memo(({ data }: NodeProps) => {
  const d = data as any;
  return (
    <div
      className="rounded-lg shadow-lg text-white relative"
      style={{
        background: "#1E3A5F",
        border: "2px solid #3B82F6",
        width: 220,
        opacity: d._opacity ?? 1,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-2 !h-2" />
      <Badge className="absolute -top-2.5 right-2 bg-primary text-[9px] px-1.5 py-0 h-5">
        TARGET
      </Badge>
      <div className="px-3 py-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-sm truncate">{d.label}</span>
        </div>
        {d.subtitle && <div className="text-[11px] opacity-70">{d.subtitle}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-300 !w-2 !h-2" />
    </div>
  );
});
UBOTargetNode.displayName = "UBOTargetNode";

/* ─── Edge color helper ─── */
function edgeColor(pct: number): string {
  if (pct > 50) return "#16A34A";
  if (pct >= 25) return "#D97706";
  return "#EF4444";
}

/* ─── Node types registry ─── */
const nodeTypes = {
  uboPersonNode: UBOPersonNode,
  uboCompanyNode: UBOCompanyNode,
  uboTargetNode: UBOTargetNode,
};

/* ─── Props ─── */
interface UBOChainVisualizerProps {
  snapshot: any;
  personName: string;
  companyName: string;
}

export function UBOChainVisualizer({ snapshot, personName, companyName }: UBOChainVisualizerProps) {
  const chain: any[] = Array.isArray(snapshot.ownership_chain) ? snapshot.ownership_chain : [];
  const econPct = Number(snapshot.effective_economic_pct);
  const votePct = Number(snapshot.effective_voting_pct);
  const econDiffers = Math.abs(econPct - votePct) > 0.001;

  // Build multiplication formulas
  const pctSteps = chain.filter(c => c.owns_pct_in_next != null).map(c => Number(c.owns_pct_in_next));
  const econFormula = pctSteps.map(p => `${p.toFixed(0)}%`).join(" × ") + ` = ${econPct.toFixed(2)}%`;
  const voteFormula = pctSteps.map(p => `${p.toFixed(0)}%`).join(" × ") + ` = ${votePct.toFixed(2)}%`;

  // Fade-in animation state
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    setVisibleCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    chain.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), (i + 1) * 200));
    });
    return () => timers.forEach(clearTimeout);
  }, [chain.length]);

  // Build React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    chain.forEach((step, i) => {
      const isPerson = step.entity_type === "person";
      const isTarget = i === chain.length - 1;
      const isFirst = i === 0;

      let nodeType = "uboCompanyNode";
      if (isPerson && isFirst) nodeType = "uboPersonNode";
      else if (isTarget) nodeType = "uboTargetNode";

      const subtitle = isPerson
        ? [step.nationality, step.dob].filter(Boolean).join(" · ")
        : [step.company_type, step.jurisdiction].filter(Boolean).join(" · ");

      n.push({
        id: step.entity_id,
        type: nodeType,
        position: { x: 0, y: i * 180 },
        data: {
          label: step.entity_name,
          subtitle: subtitle || undefined,
          econPct: econPct.toFixed(2),
          votePct: votePct.toFixed(2),
          isAboveThreshold: snapshot.is_above_threshold,
          passThroughPct: step.owns_pct_in_next != null ? Number(step.owns_pct_in_next).toFixed(1) : "—",
          _opacity: i < visibleCount ? 1 : 0,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      if (i < chain.length - 1) {
        const pct = Number(step.owns_pct_in_next || 0);
        const color = edgeColor(pct);
        e.push({
          id: `e-${i}`,
          source: step.entity_id,
          target: chain[i + 1].entity_id,
          type: "smoothstep",
          animated: true,
          label: step.owns_pct_in_next != null
            ? `${Number(step.owns_pct_in_next).toFixed(1)}%${step.share_class_name ? `\n${step.share_class_name}` : ""}`
            : "",
          style: {
            stroke: color,
            strokeWidth: 2,
            strokeDasharray: "5,5",
            animation: i < visibleCount - 1 ? "dashflow 0.5s linear infinite" : "none",
            opacity: i < visibleCount - 1 ? 1 : 0,
            transition: "opacity 0.5s ease-out",
          },
          labelStyle: {
            fill: "hsl(var(--foreground))",
            fontWeight: 600,
            fontSize: 11,
          },
          labelBgStyle: {
            fill: "hsl(var(--background))",
            fillOpacity: 0.9,
          },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    });

    return { nodes: n, edges: e };
  }, [chain, visibleCount, econPct, votePct, snapshot.is_above_threshold]);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.2 }), 100);
  }, []);

  const flowHeight = Math.min(600, Math.max(300, chain.length * 180 + 60));

  return (
    <div className="flex flex-col h-full">
      {/* React Flow Diagram */}
      <div style={{ height: flowHeight, minHeight: 300 }} className="w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          onInit={onInit}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Calculation Panel */}
      <div className="p-4 border-t space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className={econPct >= 25 ? "border-destructive/50 bg-destructive/5" : "border-green-500/30 bg-green-50 dark:bg-green-950/20"}>
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Economic Ownership</div>
              <div className="text-sm font-bold">{econFormula}</div>
              <div className={`text-xs mt-1 font-medium ${econPct >= 25 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                {econPct >= 25 ? "▲ Above 25% threshold" : "● Below 25% threshold"}
              </div>
            </CardContent>
          </Card>
          <Card className={votePct >= 25 ? "border-destructive/50 bg-destructive/5" : "border-green-500/30 bg-green-50 dark:bg-green-950/20"}>
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Voting Control</div>
              <div className="text-sm font-bold">{voteFormula}</div>
              <div className={`text-xs mt-1 font-medium ${votePct >= 25 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                {votePct >= 25 ? "▲ Above 25% threshold" : "● Below 25% threshold"}
              </div>
            </CardContent>
          </Card>
        </div>
        {econDiffers && (
          <p className="text-xs text-muted-foreground italic">
            Economic and voting percentages differ due to non-voting share classes in the chain.
          </p>
        )}
      </div>
    </div>
  );
}
