import React, { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDocumentStatus } from "@/lib/document-status";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

function scoreColor(score: number): string {
  if (score >= 90) return "#16A34A";
  if (score >= 70) return "#D97706";
  if (score >= 50) return "#EF4444";
  return "#DC2626";
}

function statusLine(score: number, expiring: number, expired: number): { text: string; icon: string } {
  if (score === 100) return { text: "All documents valid", icon: "✓" };
  if (expired > 0) return { text: `${expired} expired`, icon: "✕" };
  if (expiring > 0) return { text: `${expiring} expiring soon`, icon: "⚠" };
  return { text: "No documents", icon: "—" };
}

interface CompanyHealth {
  id: string;
  name: string;
  score: number;
  valid: number;
  total: number;
  expiring: number;
  expired: number;
}

function KYCHealthGridInner() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyHealth[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const [entitiesRes, docsRes, linksRes, appointmentsRes] = await Promise.all([
        supabase.from("entities").select("id, name, type").eq("workspace_id", workspaceId).eq("type", "company"),
        supabase.from("documents").select("id, entity_id, expiry_date").eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("owner_entity_id, owned_entity_id").eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("appointments").select("person_entity_id, company_entity_id").eq("workspace_id", workspaceId).is("resignation_date", null),
      ]);

      const companyEntities = entitiesRes.data || [];
      const allDocs = docsRes.data || [];
      const links = linksRes.data || [];
      const appointments = appointmentsRes.data || [];

      // Build doc map by entity_id
      const docsByEntity: Record<string, typeof allDocs> = {};
      allDocs.forEach(d => {
        if (!docsByEntity[d.entity_id]) docsByEntity[d.entity_id] = [];
        docsByEntity[d.entity_id].push(d);
      });

      const results: CompanyHealth[] = companyEntities.map(co => {
        // 1. Company's own docs
        const relatedEntityIds = new Set<string>([co.id]);

        // 2. Shareholders (persons linked via equity_links)
        links.forEach(l => {
          if (l.owned_entity_id === co.id) relatedEntityIds.add(l.owner_entity_id);
        });

        // 3. Board/management (via appointments)
        appointments.forEach(a => {
          if (a.company_entity_id === co.id) relatedEntityIds.add(a.person_entity_id);
        });

        // Collect all docs for related entities
        let total = 0, valid = 0, expiring = 0, expired = 0;
        relatedEntityIds.forEach(eid => {
          const docs = docsByEntity[eid] || [];
          docs.forEach(doc => {
            total++;
            const status = getDocumentStatus(doc.expiry_date);
            if (status === "expired") { expired++; }
            else if (status === "expiring_soon") { expiring++; }
            else { valid++; }
          });
        });

        const score = total > 0 ? Math.round((valid / total) * 100) : 0;
        return { id: co.id, name: co.name, score, valid, total, expiring, expired };
      });

      // Sort by worst score first, limit to 12
      results.sort((a, b) => a.score - b.score);
      setCompanies(results.slice(0, 12));
      setLoading(false);
    };
    fetch();
  }, [workspaceId]);

  const avgScore = useMemo(() => {
    if (companies.length === 0) return 0;
    return Math.round(companies.reduce((s, c) => s + c.score, 0) / companies.length);
  }, [companies]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (companies.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">KYC Compliance Overview</h2>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
          style={{ backgroundColor: scoreColor(avgScore) }}
        >
          Workspace average: {avgScore}%
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map(co => {
          const color = scoreColor(co.score);
          const { text, icon } = statusLine(co.score, co.expiring, co.expired);
          const chartData = [{ value: co.score, fill: color }];

          return (
            <Card
              key={co.id}
              className="shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/entities/${co.id}?tab=documents`)}
            >
              <CardContent className="pt-4 pb-3 flex flex-col items-center">
                <div className="w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      innerRadius="75%"
                      outerRadius="100%"
                      data={chartData}
                      startAngle={225}
                      endAngle={-45}
                      barSize={8}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={4}
                        background={{ fill: "hsl(var(--border))" }}
                        isAnimationActive
                        animationDuration={1000}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                {/* Overlay text inside gauge */}
                <div className="-mt-[72px] mb-4 text-center">
                  <div className="text-2xl font-bold" style={{ color }}>{co.score}%</div>
                  <div className="text-[10px] text-muted-foreground">{co.valid} of {co.total} valid</div>
                </div>
                <div className="text-sm font-medium truncate max-w-[160px] text-center">{co.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {icon} {text}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {companies.length >= 12 && (
        <button onClick={() => navigate("/entities")} className="text-xs text-primary hover:underline">
          View all →
        </button>
      )}
    </div>
  );
}

export const KYCHealthGrid = React.memo(KYCHealthGridInner);
