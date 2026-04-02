import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

interface ShareClass {
  id: string;
  class_name: string;
  total_shares_issued: number;
  voting_rights: boolean;
}

interface EquityLink {
  owner: { id: string; name: string; type: string } | null;
  share_class: { id: string; class_name: string } | null;
  shares_owned: number | null;
  percentage: number;
  effective_date: string;
}

interface CapTableWaterfallProps {
  shareClasses: ShareClass[];
  ownedBy: EquityLink[];
  onAddOwnership?: () => void;
}

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data?._tooltipData) return null;
  const items: any[] = data._tooltipData;

  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
      {items.map((item: any, i: number) => (
        <div key={i} className={i > 0 ? "mt-2 pt-2 border-t" : ""}>
          <div className="font-semibold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
            {item.name}
          </div>
          <div className="text-muted-foreground mt-0.5">
            {item.shares?.toLocaleString()} shares · {item.pct?.toFixed(2)}%
          </div>
          {item.effectiveDate && (
            <div className="text-muted-foreground">Since: {item.effectiveDate}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const CapTableWaterfallInner = ({ shareClasses, ownedBy, onAddOwnership }: CapTableWaterfallProps) => {
  const navigate = useNavigate();

  // Build per-class data
  const { chartData, shareholderColors, legendItems } = useMemo(() => {
    const colorMap: Record<string, string> = {};
    let colorIdx = 0;

    // Assign colors to shareholders
    const uniqueShareholders = new Map<string, string>();
    ownedBy.forEach(link => {
      if (link.owner && !uniqueShareholders.has(link.owner.id)) {
        uniqueShareholders.set(link.owner.id, link.owner.name);
      }
    });
    uniqueShareholders.forEach((name, id) => {
      colorMap[id] = COLORS[colorIdx % COLORS.length];
      colorIdx++;
    });

    const data: any[] = [];

    shareClasses.forEach(sc => {
      const classLinks = ownedBy.filter(l => l.share_class?.id === sc.id);
      const row: any = {
        name: sc.class_name,
        total: sc.total_shares_issued,
        voting: sc.voting_rights,
        _tooltipData: [],
      };

      let allocatedShares = 0;
      classLinks.forEach(link => {
        if (!link.owner) return;
        const shares = link.shares_owned || Math.round((link.percentage / 100) * sc.total_shares_issued);
        const pct = (shares / sc.total_shares_issued) * 100;
        const key = `sh_${link.owner.id}`;
        row[key] = pct;
        row._tooltipData.push({
          name: link.owner.name,
          shares,
          pct,
          color: colorMap[link.owner.id],
          effectiveDate: link.effective_date,
          entityId: link.owner.id,
        });
        allocatedShares += shares;
      });

      const unallocated = sc.total_shares_issued - allocatedShares;
      if (unallocated > 0) {
        const unallocPct = (unallocated / sc.total_shares_issued) * 100;
        row["unallocated"] = unallocPct;
        row._tooltipData.push({
          name: "Unallocated",
          shares: unallocated,
          pct: unallocPct,
          color: "#94A3B8",
        });
      }

      data.push(row);
    });

    const legend = Array.from(uniqueShareholders.entries()).map(([id, name]) => ({
      id,
      name,
      color: colorMap[id],
      totalPct: 0,
    }));

    // Calculate total % across all classes for legend
    ownedBy.forEach(link => {
      if (!link.owner) return;
      const item = legend.find(l => l.id === link.owner!.id);
      if (item) item.totalPct += link.percentage;
    });

    return { chartData: data, shareholderColors: colorMap, legendItems: legend };
  }, [shareClasses, ownedBy]);

  if (ownedBy.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">No shareholders linked yet</p>
          {onAddOwnership && (
            <button
              onClick={onAddOwnership}
              className="text-primary text-sm font-medium hover:underline"
            >
              → Add Ownership Link
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Get all unique shareholder keys for stacking
  const shareholderIds = Array.from(new Set(ownedBy.map(l => l.owner?.id).filter(Boolean))) as string[];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Shareholding Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {chartData.map((row, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {row.name}
                  {row.voting && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">🗳 Voting</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">{row.total.toLocaleString()} shares</span>
              </div>
              <ResponsiveContainer width="100%" height={32}>
                <BarChart
                  data={[row]}
                  layout="vertical"
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  barSize={24}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" hide />
                  <RechartsTooltip content={<CustomTooltip />} cursor={false} />
                  {shareholderIds.map(shId => (
                    <Bar
                      key={shId}
                      dataKey={`sh_${shId}`}
                      stackId="a"
                      fill={shareholderColors[shId]}
                      radius={0}
                      isAnimationActive
                      animationDuration={800}
                      animationEasing="ease-out"
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/entities/${shId}`)}
                    />
                  ))}
                  {chartData.some(r => r.unallocated) && (
                    <Bar
                      dataKey="unallocated"
                      stackId="a"
                      fill="#94A3B8"
                      radius={0}
                      isAnimationActive
                      animationDuration={800}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t flex flex-wrap gap-3">
          {legendItems.map(item => (
            <button
              key={item.id}
              className="flex items-center gap-1.5 text-xs hover:underline"
              onClick={() => navigate(`/entities/${item.id}`)}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
            </button>
          ))}
          {chartData.some(r => r.unallocated) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Unallocated
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const CapTableWaterfall = React.memo(CapTableWaterfallInner);
