import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play, Pause, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

const TYPE_COLORS: Record<string, string> = {
  ISSUANCE: "#16A34A",
  TRANSFER: "#3B82F6",
  CANCELLATION: "#EF4444",
  INHERITANCE: "#8B5CF6",
  GIFT: "#06B6D4",
  CAPITAL_INCREASE: "#10B981",
  CAPITAL_DECREASE: "#F59E0B",
  COURT_ORDER: "#F97316",
};

const SHAREHOLDER_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#F97316", "#EC4899"];

interface Movement {
  id: string;
  movement_date: string;
  movement_type: string;
  status: string;
  shares_transferred: number;
  share_class?: { class_name: string; total_shares_issued: number } | null;
  from_entity?: { name: string } | null;
  to_entity?: { name: string } | null;
  from_entity_id?: string | null;
  to_entity_id?: string | null;
  share_class_id: string;
  void_reason?: string | null;
}

interface MovementTimelineProps {
  movements: Movement[];
  companyName: string;
}

function replayToIndex(movements: Movement[], index: number): { holdings: Record<string, number>; totalByClass: Record<string, number> } {
  const holdings: Record<string, number> = {};
  const totalByClass: Record<string, number> = {};

  for (let i = 0; i <= index; i++) {
    const m = movements[i];
    if (m.status !== "confirmed") continue;
    const scId = m.share_class_id;

    if (m.movement_type === "CAPITAL_INCREASE") {
      totalByClass[scId] = (totalByClass[scId] || 0) + m.shares_transferred;
    } else if (m.movement_type === "CAPITAL_DECREASE") {
      totalByClass[scId] = (totalByClass[scId] || 0) - m.shares_transferred;
    }

    if (m.from_entity_id) {
      const key = m.from_entity?.name || m.from_entity_id;
      holdings[key] = (holdings[key] || 0) - m.shares_transferred;
    }
    if (m.to_entity_id) {
      const key = m.to_entity?.name || m.to_entity_id;
      holdings[key] = (holdings[key] || 0) + m.shares_transferred;
    }
  }

  return { holdings, totalByClass };
}

function MovementTimelineInner({ movements, companyName }: MovementTimelineProps) {
  // Sort by date ascending, confirmed first
  const sorted = useMemo(() => {
    return [...movements]
      .sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime());
  }, [movements]);

  const confirmed = useMemo(() => sorted.filter(m => m.status === "confirmed"), [sorted]);

  const [selectedIdx, setSelectedIdx] = useState(confirmed.length > 0 ? confirmed.length - 1 : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stop play when reaching end
  useEffect(() => {
    if (isPlaying && selectedIdx >= confirmed.length - 1) {
      setIsPlaying(false);
    }
  }, [selectedIdx, confirmed.length, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setSelectedIdx(prev => {
          if (prev >= confirmed.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [isPlaying, confirmed.length]);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);
  const stepBack = useCallback(() => setSelectedIdx(p => Math.max(0, p - 1)), []);
  const stepForward = useCallback(() => setSelectedIdx(p => Math.min(confirmed.length - 1, p + 1)), [confirmed.length]);

  // Build snapshot bar data
  const snapshot = useMemo(() => {
    if (confirmed.length === 0) return [];
    const { holdings } = replayToIndex(confirmed, selectedIdx);
    const entries = Object.entries(holdings).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return entries.map(([name, shares], i) => ({
      name,
      shares,
      pct: total > 0 ? (shares / total) * 100 : 0,
      color: SHAREHOLDER_COLORS[i % SHAREHOLDER_COLORS.length],
    }));
  }, [confirmed, selectedIdx]);

  if (confirmed.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No movement history yet.</p>
        <p className="text-xs mt-1">Record a movement to start the timeline.</p>
      </div>
    );
  }

  const selectedMov = confirmed[selectedIdx];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={stepBack} disabled={selectedIdx <= 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={togglePlay}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={stepForward} disabled={selectedIdx >= confirmed.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          Event {selectedIdx + 1} of {confirmed.length}
        </span>
      </div>

      {/* Timeline track */}
      <div className="relative overflow-x-auto pb-2" ref={scrollRef}>
        <div className="relative min-w-[600px]" style={{ width: Math.max(600, confirmed.length * 120) }}>
          {/* Track line */}
          <div className="absolute top-[22px] left-0 right-0 h-0.5" style={{ backgroundColor: "#E2E8F0" }} />

          {/* Events */}
          <div className="flex">
            {confirmed.map((m, i) => {
              const isSelected = i === selectedIdx;
              const isVoided = m.status === "voided";
              const color = TYPE_COLORS[m.movement_type] || "#6B7280";
              const above = i % 2 === 0;

              return (
                <div
                  key={m.id}
                  className="flex-1 min-w-[100px] max-w-[140px] relative cursor-pointer"
                  onClick={() => { setSelectedIdx(i); setIsPlaying(false); }}
                  style={{ paddingTop: above ? 0 : 44, paddingBottom: above ? 44 : 0 }}
                >
                  {/* Label - above or below */}
                  <div className={`text-center ${above ? "mb-1" : "mt-1 order-last"} ${above ? "" : "absolute top-[32px]"} left-0 right-0`}>
                    <div className="text-[10px] text-muted-foreground">
                      {format(parseISO(m.movement_date), "dd MMM yyyy")}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 border-0"
                      style={{ color, backgroundColor: `${color}15` }}
                    >
                      {m.movement_type.replace(/_/g, " ")}
                    </Badge>
                    <div className="text-[9px] text-muted-foreground truncate px-1">
                      {m.movement_type === "ISSUANCE" || m.movement_type === "CAPITAL_INCREASE"
                        ? `→ ${m.to_entity?.name || "—"}`
                        : `${m.from_entity?.name || "—"} → ${m.to_entity?.name || "—"}`}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {m.shares_transferred.toLocaleString()} sh
                    </div>
                  </div>

                  {/* Dot */}
                  <div className="flex justify-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 transition-all ${isSelected ? "scale-150 ring-2 ring-offset-1" : ""}`}
                      style={{
                        backgroundColor: isVoided ? "#9CA3AF" : color,
                        borderColor: isSelected ? color : "transparent",
                        boxShadow: isSelected ? `0 0 0 2px ${color}40` : "none",
                      }}
                    >
                      {isVoided && <X className="h-2 w-2 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Snapshot bar */}
      <Card className="shadow-sm">
        <CardContent className="pt-3 pb-3">
          <div className="text-xs text-muted-foreground mb-2">
            Cap table as of {selectedMov ? format(parseISO(selectedMov.movement_date), "dd MMM yyyy") : "—"}
          </div>
          {snapshot.length > 0 ? (
            <>
              <div className="flex h-6 rounded overflow-hidden">
                {snapshot.map((s, i) => (
                  <div
                    key={i}
                    className="h-full transition-all duration-500 ease-out relative group"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: s.pct > 0 ? 2 : 0 }}
                    title={`${s.name}: ${s.shares.toLocaleString()} shares (${s.pct.toFixed(1)}%)`}
                  >
                    {s.pct > 8 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-medium truncate px-0.5">
                        {s.pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {snapshot.map((s, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} ({s.pct.toFixed(1)}%)
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No holdings at this point.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const MovementTimeline = React.memo(MovementTimelineInner);
