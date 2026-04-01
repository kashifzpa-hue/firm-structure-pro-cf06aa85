import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface UnallocatedReportProps {
  rootId: string;
  rootEntity: any;
  shareClasses: any[];
  allLinks: any[];
  entityMap: Record<string, any>;
}

export function UnallocatedReport({ rootId, rootEntity, shareClasses, allLinks, entityMap }: UnallocatedReportProps) {
  const reportData = useMemo(() => {
    if (!rootId) return [];

    return shareClasses.map((sc) => {
      const activeLinks = allLinks.filter(
        (l) => l.owned_entity_id === rootId && l.share_class_id === sc.id && !l.end_date
      );
      const allocatedShares = activeLinks.reduce((sum, l) => sum + (l.shares_owned || 0), 0);
      const unallocated = sc.total_shares_issued - allocatedShares;
      const allocatedPct = sc.total_shares_issued > 0
        ? (allocatedShares / sc.total_shares_issued) * 100
        : 0;

      return {
        shareClass: sc,
        totalShares: sc.total_shares_issued,
        allocatedShares,
        unallocated,
        allocatedPct,
        holders: activeLinks.map((l) => ({
          entity: entityMap[l.owner_entity_id],
          sharesOwned: l.shares_owned || 0,
          percentage: Number(l.percentage),
        })),
      };
    });
  }, [shareClasses, allLinks, rootId, entityMap]);

  if (!rootId || !rootEntity) return null;

  const hasUnallocated = reportData.some((r) => r.unallocated !== 0);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {hasUnallocated ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          Shareholding Allocation Report — {rootEntity.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reportData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No share classes defined for this company.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Share Class</TableHead>
                <TableHead>Total Issued</TableHead>
                <TableHead>Allocated</TableHead>
                <TableHead>Unallocated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((r) => (
                <TableRow key={r.shareClass.id}>
                  <TableCell className="font-medium">{r.shareClass.class_name}</TableCell>
                  <TableCell>{r.totalShares.toLocaleString()}</TableCell>
                  <TableCell>
                    {r.allocatedShares.toLocaleString()} ({r.allocatedPct.toFixed(1)}%)
                  </TableCell>
                  <TableCell>
                    {r.unallocated !== 0 ? (
                      <span className="text-amber-600 font-medium">{r.unallocated.toLocaleString()}</span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell>
                    {r.unallocated === 0 ? (
                      <Badge className="bg-green-100 text-green-700 border-0">Fully Allocated</Badge>
                    ) : r.unallocated > 0 ? (
                      <Badge className="bg-amber-100 text-amber-700 border-0">Under-allocated</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-0">Over-allocated</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
