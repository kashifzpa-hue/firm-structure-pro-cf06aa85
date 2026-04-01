import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, ArrowDown } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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

  // Build multiplication string
  const pctSteps = chain.filter(c => c.owns_pct_in_next != null).map(c => `${Number(c.owns_pct_in_next).toFixed(0)}%`);
  const econFormula = pctSteps.join(" × ") + ` = ${econPct.toFixed(2)}%`;
  const voteFormula = pctSteps.join(" × ") + ` = ${votePct.toFixed(2)}%`;

  // React Flow nodes/edges
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];
    chain.forEach((step, i) => {
      const isPerson = step.entity_type === "person";
      const isTarget = i === chain.length - 1;
      n.push({
        id: step.entity_id,
        position: { x: 250, y: i * 150 },
        data: {
          label: (
            <div className="flex items-center gap-2 px-3 py-2">
              {isPerson ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              <div>
                <div className="font-medium text-sm">{step.entity_name}</div>
                <div className="text-xs opacity-70">{isPerson ? "Person" : "Company"}</div>
              </div>
            </div>
          ),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        style: {
          background: isPerson ? "hsl(var(--primary) / 0.1)" : isTarget ? "hsl(var(--sidebar-background))" : "hsl(var(--muted))",
          border: isPerson ? "2px solid hsl(var(--primary))" : isTarget ? "2px solid hsl(var(--sidebar-background))" : "1px solid hsl(var(--border))",
          borderRadius: "8px",
          color: isTarget ? "hsl(var(--sidebar-foreground))" : "inherit",
        },
      });
      if (i < chain.length - 1) {
        e.push({
          id: `e-${i}`,
          source: step.entity_id,
          target: chain[i + 1].entity_id,
          label: step.owns_pct_in_next != null ? `${Number(step.owns_pct_in_next).toFixed(1)}%` : "",
          type: "smoothstep",
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          labelStyle: { fill: "hsl(var(--foreground))", fontWeight: 600, fontSize: 12 },
        });
      }
    });
    return { nodes: n, edges: e };
  }, [chain]);

  return (
    <div className="flex h-full">
      {/* Left Panel - Chain Details */}
      <div className="w-[40%] border-r overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold">{personName}'s ownership path to {companyName}</h2>
        </div>

        {/* Chain Timeline */}
        <div className="space-y-0">
          {chain.map((step, i) => {
            const isPerson = step.entity_type === "person";
            const isTarget = i === chain.length - 1;
            return (
              <div key={i}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isPerson ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {isPerson ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium">{step.entity_name}</div>
                    <div className="text-xs text-muted-foreground">{isPerson ? "Person" : "Company"}</div>
                  </div>
                  {isTarget && <Badge variant="outline" className="ml-auto text-xs">TARGET</Badge>}
                </div>
                {i < chain.length - 1 && (
                  <div className="ml-4 flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <div className="w-px h-4 bg-border ml-3" />
                    <ArrowDown className="h-3 w-3" />
                    <span>owns {Number(step.owns_pct_in_next).toFixed(2)}% of</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Boxes */}
        <div className="space-y-3">
          <Card className={`${econPct >= 25 ? "border-destructive/50 bg-destructive/5" : "border-green-300 bg-green-50"}`}>
            <CardContent className="pt-4 pb-4">
              <div className="text-sm font-medium mb-1">Effective Economic Ownership</div>
              <div className="text-lg font-bold">{econFormula}</div>
              <div className={`text-xs mt-1 ${econPct >= 25 ? "text-destructive" : "text-green-700"}`}>
                {econPct >= 25 ? "▲ Above 25% threshold" : "● Below 25% threshold"}
              </div>
            </CardContent>
          </Card>
          <Card className={`${votePct >= 25 ? "border-destructive/50 bg-destructive/5" : "border-green-300 bg-green-50"}`}>
            <CardContent className="pt-4 pb-4">
              <div className="text-sm font-medium mb-1">Effective Voting Control</div>
              <div className="text-lg font-bold">{voteFormula}</div>
              <div className={`text-xs mt-1 ${votePct >= 25 ? "text-destructive" : "text-green-700"}`}>
                {votePct >= 25 ? "▲ Above 25% threshold" : "● Below 25% threshold"}
              </div>
            </CardContent>
          </Card>
          {econDiffers && (
            <p className="text-xs text-muted-foreground italic">
              Economic and voting percentages differ because one or more companies in the chain have non-voting share classes.
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Mini Org Chart */}
      <div className="w-[60%] h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
