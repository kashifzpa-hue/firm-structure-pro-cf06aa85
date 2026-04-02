import { Handle, Position } from "@xyflow/react";
import { User } from "lucide-react";

interface PersonNodeData {
  label: string;
  nationality?: string;
  docStatus: "green" | "amber" | "red";
  primaryRole?: string;
  ownerships: { targetName: string; percentage: number }[];
  visibility: {
    personHoldings: boolean;
  };
}

const STATUS_COLORS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

export function PersonNode({ data }: { data: PersonNodeData }) {
  const visibleOwnerships = data.ownerships.slice(0, 3);
  const extraCount = Math.max(0, data.ownerships.length - 3);

  return (
    <div
      className="rounded-lg shadow-lg px-3 py-2.5 text-center"
      style={{
        background: "linear-gradient(135deg, #3B82F6, #2563EB)",
        color: "#FFFFFF",
        width: 260,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-2 !h-2" />

      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: STATUS_COLORS[data.docStatus] }}
        />
        <span className="font-semibold text-sm truncate">{data.label}</span>
      </div>

      {data.nationality && (
        <div className="text-[11px] opacity-70">{data.nationality}</div>
      )}

      {data.primaryRole && (
        <div className="text-[10px] opacity-80 mt-1 bg-white/10 rounded px-1.5 py-0.5 inline-block">
          {data.primaryRole}
        </div>
      )}

      {data.visibility.personHoldings && visibleOwnerships.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {visibleOwnerships.map((o, i) => (
            <div key={i} className="text-[10px] opacity-70 truncate">
              {o.percentage.toFixed(1)}% of {o.targetName}
            </div>
          ))}
          {extraCount > 0 && (
            <div className="text-[10px] opacity-50">+{extraCount} more</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-blue-300 !w-2 !h-2" />
    </div>
  );
}
