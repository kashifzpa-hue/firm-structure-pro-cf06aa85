import { Handle, Position } from "@xyflow/react";
import { Building2, User, Link2 } from "lucide-react";
import { CapitalBadge } from "./CapitalBadge";

interface CompanyNodeData {
  label: string;
  companyType?: string;
  jurisdiction?: string;
  registrationNumber?: string;
  incorporationDate?: string;
  officerCount: number;
  subsidiaryCount: number;
  docStatus: "green" | "amber" | "red";
  shareClasses: any[];
  visibility: {
    capitalBadges: boolean;
    officerCounts: boolean;
    regNumbers: boolean;
    incDates: boolean;
  };
}

const STATUS_COLORS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };

export function CompanyNode({ data }: { data: CompanyNodeData }) {
  const showBadge = data.visibility.capitalBadges;

  return (
    <div
      className="rounded-lg shadow-lg flex overflow-hidden"
      style={{
        backgroundColor: "#0F172A",
        color: "#FFFFFF",
        minWidth: showBadge ? 440 : 280,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />

      {/* Left column — details */}
      <div className="flex-grow px-3 py-2.5 min-w-0" style={{ maxWidth: showBadge ? 280 : undefined }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_COLORS[data.docStatus] }}
          />
          <span className="font-semibold text-sm truncate">{data.label}</span>
        </div>

        <div className="text-[11px] opacity-70 truncate">
          {[data.companyType, data.jurisdiction].filter(Boolean).join(" · ") || "Company"}
        </div>

        {data.visibility.regNumbers && data.registrationNumber && (
          <div className="text-[10px] opacity-50 mt-0.5 truncate">
            Reg: {data.registrationNumber}
          </div>
        )}

        {data.visibility.incDates && data.incorporationDate && (
          <div className="text-[10px] opacity-50 truncate">
            Inc: {data.incorporationDate}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-[10px] opacity-60">
          {data.visibility.officerCounts && data.officerCount > 0 && (
            <span className="flex items-center gap-0.5">
              <User className="h-3 w-3" /> {data.officerCount}
            </span>
          )}
          {data.subsidiaryCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Link2 className="h-3 w-3" /> {data.subsidiaryCount} subs
            </span>
          )}
        </div>
      </div>

      {/* Right column — capital badge */}
      {showBadge && (
        <div
          className="border-l border-white/10 px-2 py-2.5 flex-shrink-0"
          style={{ width: 160 }}
        >
          <CapitalBadge shareClasses={data.shareClasses} />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
}
