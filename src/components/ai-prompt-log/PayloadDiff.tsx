import { useMemo, useState } from "react";
import { collapseUnchanged, countChanges, diffLines, toLines, type DiffLine } from "@/lib/promptDiff";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Field = { key: string; label: string; before: unknown; after: unknown };

function DiffPane({ before, after, collapse }: { before: unknown; after: unknown; collapse: boolean }) {
  const rows = useMemo(() => diffLines(toLines(before), toLines(after)), [before, after]);
  const stats = useMemo(() => countChanges(rows), [rows]);
  const display = useMemo(() => (collapse ? collapseUnchanged(rows, 3) : rows), [rows, collapse]);

  const cellClass = (line: DiffLine, side: "left" | "right") => {
    const value = side === "left" ? line.left : line.right;
    if (value === undefined) return "bg-muted/30";
    if (line.op === "equal") return "";
    return side === "left"
      ? "bg-destructive/10 text-destructive-foreground"
      : "bg-success/10";
  };

  if (stats.added === 0 && stats.removed === 0) {
    return <p className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">Identical between the two requests.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="border-success/30 bg-success/15 text-success">+{stats.added} added</Badge>
        <Badge variant="outline" className="border-destructive/30 bg-destructive/15 text-destructive">−{stats.removed} removed</Badge>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-md border">
        <table className="w-full table-fixed border-collapse font-mono text-[11px] leading-relaxed">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr>
              <th className="w-1/2 border-r px-3 py-1.5 text-left font-semibold">Previous request</th>
              <th className="w-1/2 px-3 py-1.5 text-left font-semibold">This request</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row, idx) => {
              if ("count" in row && row.op === "skip") {
                return (
                  <tr key={`skip-${idx}`}>
                    <td colSpan={2} className="border-y bg-muted/40 px-3 py-1 text-center text-muted-foreground">
                      … {row.count} unchanged line{row.count === 1 ? "" : "s"} …
                    </td>
                  </tr>
                );
              }
              const line = row as DiffLine;
              return (
                <tr key={idx} className="align-top">
                  <td className={`w-1/2 border-r px-3 py-0.5 ${cellClass(line, "left")}`}>
                    <span className="mr-2 select-none text-muted-foreground">{line.leftNumber ?? ""}</span>
                    <span className="whitespace-pre-wrap break-all">{line.left ?? ""}</span>
                  </td>
                  <td className={`w-1/2 px-3 py-0.5 ${cellClass(line, "right")}`}>
                    <span className="mr-2 select-none text-muted-foreground">{line.rightNumber ?? ""}</span>
                    <span className="whitespace-pre-wrap break-all">{line.right ?? ""}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PayloadDiff({ fields }: { fields: Field[] }) {
  const [collapse, setCollapse] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch id="collapse-unchanged" checked={collapse} onCheckedChange={setCollapse} />
        <Label htmlFor="collapse-unchanged" className="text-xs font-normal text-muted-foreground">
          Collapse unchanged lines
        </Label>
      </div>
      <Tabs defaultValue={fields[0]?.key}>
        <TabsList className="flex-wrap">
          {fields.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
        {fields.map((f) => (
          <TabsContent key={f.key} value={f.key} className="mt-3">
            <DiffPane before={f.before} after={f.after} collapse={collapse} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
