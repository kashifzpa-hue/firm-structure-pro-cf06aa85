import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";

interface LinkData {
  id: string;
  shareClassName: string;
  sharesOwned: number | null;
  percentage: number;
  votingRights: boolean;
}

interface CustomEdgeData {
  links: LinkData[];
  showLabels: boolean;
  maxPct: number;
}

function getEdgeStyle(maxPct: number) {
  if (maxPct > 50) return { color: "#16A34A", width: 3 };
  if (maxPct >= 25) return { color: "#D97706", width: 2 };
  return { color: "#94A3B8", width: 1.5 };
}

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as unknown as CustomEdgeData;
  const { color, width } = getEdgeStyle(edgeData.maxPct);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray="5,5"
        className="react-flow__edge-path"
        style={{
          animation: "dashflow 1.5s linear infinite",
          filter: "none",
          transition: "filter 0.2s",
        }}
        markerEnd={markerEnd}
        onMouseEnter={(e) => {
          (e.target as SVGPathElement).style.filter = `drop-shadow(0 0 4px ${color})`;
        }}
        onMouseLeave={(e) => {
          (e.target as SVGPathElement).style.filter = "none";
        }}
      />
      {edgeData.showLabels && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="bg-background border rounded-md px-2 py-1.5 shadow-sm text-[10px] space-y-1 max-w-[180px] nodrag nopan"
          >
            {edgeData.links.map((link) => (
              <div key={link.id} className="space-y-0.5">
                <div className="flex items-center gap-1 text-foreground">
                  <span className="text-[9px] leading-none" style={{ color }}>●</span>
                  <span className="font-medium">{link.shareClassName || "Equity"}</span>
                </div>
                <div className="pl-3 text-muted-foreground">
                  {link.sharesOwned != null ? `${link.sharesOwned.toLocaleString()} sh · ` : ""}
                  {link.percentage.toFixed(2)}% · {link.votingRights ? "Vote" : "Non-vote"}
                </div>
              </div>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
