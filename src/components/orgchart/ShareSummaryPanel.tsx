import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, PieChart } from "lucide-react";

interface ShareClass {
  id: string;
  class_name: string;
  total_shares_issued: number;
  par_value_per_share: number;
  currency: string;
  voting_rights: boolean;
}

interface ShareSummaryPanelProps {
  shareClasses: ShareClass[];
  allLinks: any[];
  rootId: string;
  selectedShareClass: string;
  onShareClassChange: (value: string) => void;
}

export function ShareSummaryPanel({
  shareClasses,
  allLinks,
  rootId,
  selectedShareClass,
  onShareClassChange,
}: ShareSummaryPanelProps) {
  if (!rootId || shareClasses.length === 0) return null;

  const activeLinks = allLinks.filter((l) => l.owned_entity_id === rootId && !l.end_date);

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Share Capital Summary</span>
          </div>
          <Select value={selectedShareClass} onValueChange={onShareClassChange}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Filter by class..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Share Classes</SelectItem>
              {shareClasses.map((sc) => (
                <SelectItem key={sc.id} value={sc.id}>{sc.class_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {shareClasses
            .filter((sc) => selectedShareClass === "all" || sc.id === selectedShareClass)
            .map((sc) => {
              const allocatedShares = activeLinks
                .filter((l) => l.share_class_id === sc.id)
                .reduce((sum, l) => sum + (l.shares_owned || 0), 0);
              const unallocated = sc.total_shares_issued - allocatedShares;
              const allocatedPct = sc.total_shares_issued > 0
                ? ((allocatedShares / sc.total_shares_issued) * 100).toFixed(1)
                : "0";
              const isFullyAllocated = unallocated === 0;

              return (
                <div key={sc.id} className="rounded-lg border p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate">{sc.class_name}</span>
                    {sc.voting_rights ? (
                      <Badge className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-0">Vote</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Non-vote</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total: {sc.total_shares_issued.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Allocated: {allocatedShares.toLocaleString()} ({allocatedPct}%)
                  </div>
                  {!isFullyAllocated && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {unallocated.toLocaleString()} unallocated
                    </div>
                  )}
                  {isFullyAllocated && (
                    <div className="text-xs text-green-600 font-medium">✓ Fully allocated</div>
                  )}
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
