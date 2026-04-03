import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import { differenceInDays, parseISO } from "date-fns";

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
  circularType?: "illegal" | "legal_exception" | null;
  circularExceptionType?: string | null;
  disposalDeadline?: string | null;
  disposalRequired?: boolean;
}

function getEdgeStyle(data: CustomEdgeData) {
  // Circular ownership overrides
  if (data.circularType === "illegal") {
    return { color: "#EF4444", width: 2.5, animated: false, dashed: true };
  }
  if (data.circularType === "legal_exception") {
    // Check disposal deadline
    if (data.disposalRequired && data.disposalDeadline) {
      const days = differenceInDays(parseISO(data.disposalDeadline), new Date());
      if (days < 0 || days < 30) {
        return { color: "#EF4444", width: 2.5, animated: false, dashed: true };
      }
    }
    return { color: "#F97316", width: 2.5, animated: false, dashed: true };
  }

  // Normal ownership edges
  const maxPct = data.maxPct;
  if (maxPct > 50) return { color: "#16A34A", width: 3, animated: true, dashed: true };
  if (maxPct >= 25) return { color: "#D97706", width: 2, animated: true, dashed: true };
  return { color: "#94A3B8", width: 1.5, animated: true, dashed: true };
}

function getCircularLabel(data: CustomEdgeData): string | null {
  if (data.circularType === "illegal") {
    return "⚠ Circular — review required";
  }
  if (data.circularType === "legal_exception") {
    const typeLabel = data.circularExceptionType?.replace(/_/g, " ") || "exception";
    if (data.disposalRequired && data.disposalDeadline) {
      const days = differenceInDays(parseISO(data.disposalDeadline), new Date());
      if (days < 0) return `Dispose overdue — ${Math.abs(days)}d`;
      return `Dispose by ${data.disposalDeadline} — ${days}d`;
    }
    return `Legal circular — ${typeLabel}`;
  }
  return null;
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
  const { color, width, animated, dashed } = getEdgeStyle(edgeData);
  const circularLabel = getCircularLabel(edgeData);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dashed ? "5,5" : undefined}
        className="react-flow__edge-path"
        style={{
          animation: animated ? "dashflow 1.5s linear infinite" : "none",
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
      {/* Circular ownership label */}
      {circularLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -120%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold shadow-sm nodrag nopan border ${
              edgeData.circularType === "illegal"
                ? "bg-red-50 text-red-700 border-red-300"
                : "bg-amber-50 text-amber-700 border-amber-300"
            }`}
          >
            {circularLabel}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Normal share labels */}
      {edgeData.showLabels && !circularLabel && (
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
      {/* Show share labels below circular label */}
      {edgeData.showLabels && circularLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, 10%) translate(${labelX}px, ${labelY}px)`,
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
