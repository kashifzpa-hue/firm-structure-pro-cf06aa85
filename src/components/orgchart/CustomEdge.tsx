import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";

interface LinkData {
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
            className="bg-background border rounded-md px-2 py-1.5 shadow-sm text-[10px] space-y-0.5 max-w-[180px] nodrag nopan"
          >
            {edgeData.links.map((link, i) => (
              <div key={i} className="flex items-center gap-1 flex-wrap">
                <span className="font-medium text-foreground">
                  {link.shareClassName || "Equity"}
                </span>
                {link.sharesOwned != null && (
                  <span className="text-muted-foreground">
                    {link.sharesOwned.toLocaleString()} sh
                  </span>
                )}
                <span className="font-semibold" style={{ color }}>
                  {link.percentage.toFixed(2)}%
                </span>
                <span
                  className="px-0.5 rounded text-[8px]"
                  style={{
                    backgroundColor: link.votingRights
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(148,163,184,0.15)",
                    color: link.votingRights ? "#16A34A" : "#94A3B8",
                  }}
                >
                  {link.votingRights ? "🗳" : "—"}
                </span>
              </div>
            ))}
            {edgeData.links.length > 1 && (
              <div className="border-t pt-0.5 mt-0.5 text-muted-foreground font-medium">
                Total economic: {edgeData.links.reduce((s, l) => s + l.percentage, 0).toFixed(2)}%
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
