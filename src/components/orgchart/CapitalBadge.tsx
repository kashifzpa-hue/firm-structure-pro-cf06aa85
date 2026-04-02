import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ShareClassInfo {
  id: string;
  class_name: string;
  total_shares_issued: number;
  par_value_per_share: number;
  currency: string;
  voting_rights: boolean;
  allocated_shares: number;
}

interface CapitalBadgeProps {
  shareClasses: ShareClassInfo[];
}

const CLASS_COLORS: Record<string, string> = {
  Ordinary: "#22C55E",
  Preference: "#F59E0B",
  "Class A": "#3B82F6",
  "Class B": "#F97316",
};

function getClassColor(name: string): string {
  for (const [key, color] of Object.entries(CLASS_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#94A3B8";
}

function getAllocationStatus(sc: ShareClassInfo) {
  if (sc.total_shares_issued === 0) return { label: "○ No shares", color: "#94A3B8" };
  const pct = (sc.allocated_shares / sc.total_shares_issued) * 100;
  if (pct >= 100) return { label: "✓ Fully allocated", color: "#22C55E" };
  if (pct > 0) return { label: `⚠ ${pct.toFixed(0)}% allocated`, color: "#F59E0B" };
  return { label: "○ Unallocated", color: "#94A3B8" };
}

export function CapitalBadge({ shareClasses }: CapitalBadgeProps) {
  const [expanded, setExpanded] = useState(shareClasses.length <= 3);

  if (shareClasses.length === 0) {
    return (
      <div className="text-xs opacity-60 text-center py-2">
        <p>No share capital recorded</p>
        <p className="mt-1 text-[10px] underline opacity-80">→ Set up share capital</p>
      </div>
    );
  }

  const visible = expanded ? shareClasses : shareClasses.slice(0, 3);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-60 mb-1">
        Share Capital
      </div>
      {visible.map((sc) => {
        const dotColor = getClassColor(sc.class_name);
        const alloc = getAllocationStatus(sc);
        return (
          <div key={sc.id} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-[11px] font-medium truncate">{sc.class_name}</span>
            </div>
            <div className="text-[10px] opacity-70 pl-3.5">
              {sc.total_shares_issued.toLocaleString()} sh · {sc.currency} {sc.par_value_per_share}
            </div>
            <div className="flex items-center gap-1 pl-3.5">
              <span
                className="text-[9px] px-1 py-px rounded"
                style={{ backgroundColor: sc.voting_rights ? "rgba(34,197,94,0.2)" : "rgba(148,163,184,0.2)" }}
              >
                {sc.voting_rights ? "Vote" : "Non-vote"}
              </span>
              <span className="text-[9px]" style={{ color: alloc.color }}>
                {alloc.label}
              </span>
            </div>
          </div>
        );
      })}
      {shareClasses.length > 3 && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center gap-0.5 text-[10px] opacity-60 hover:opacity-100 mx-auto mt-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Collapse" : `+${shareClasses.length - 3} more`}
        </button>
      )}
    </div>
  );
}
