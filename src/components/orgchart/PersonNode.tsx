import { Handle, Position } from "@xyflow/react";
import { getAvatarColor, getInitials } from "@/lib/entity-avatar";

interface PersonNodeData {
  label: string;
  nationality?: string;
  docStatus: "green" | "amber" | "red";
  primaryRole?: string;
  ownerships: { targetName: string; percentage: number }[];
  visibility: {
    personHoldings: boolean;
  };
  entityId?: string;
  profilePhotoThumb?: string | null;
}

const STATUS_COLORS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

function PersonAvatar({ entityId, name, photoUrl }: { entityId?: string; name: string; photoUrl?: string | null }) {
  const initials = getInitials(name);
  const bgColor = entityId ? getAvatarColor(entityId) : "#3B82F6";

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }} />
      ) : null}
      <div
        className={`w-full h-full flex items-center justify-center text-white text-xs font-semibold ${photoUrl ? "hidden" : ""}`}
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </div>
    </div>
  );
}

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

      <div className="flex items-center gap-2 mb-1">
        <PersonAvatar entityId={data.entityId} name={data.label} photoUrl={data.profilePhotoThumb} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: STATUS_COLORS[data.docStatus] }}
            />
            <span className="font-semibold text-sm truncate">{data.label}</span>
          </div>
          {data.nationality && (
            <div className="text-[11px] opacity-70 truncate">{data.nationality}</div>
          )}
        </div>
      </div>

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
