import { useMemo, useState, useEffect } from "react";
import { collapseUnchanged, countChanges, diffLines, toLines, type DiffLine } from "@/lib/promptDiff";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";

type Field = { key: string; label: string; before: unknown; after: unknown };

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          return (
            <span key={i} data-diff-match="true" className="rounded-sm bg-warning/30 px-0.5">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function DiffPane({ before, after, collapse, query }: { before: unknown; after: unknown; collapse: boolean; query: string }) {
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
                    <span className="whitespace-pre-wrap break-all">
                      <HighlightText text={line.left ?? ""} query={query} />
                    </span>
                  </td>
                  <td className={`w-1/2 px-3 py-0.5 ${cellClass(line, "right")}`}>
                    <span className="mr-2 select-none text-muted-foreground">{line.rightNumber ?? ""}</span>
                    <span className="whitespace-pre-wrap break-all">
                      <HighlightText text={line.right ?? ""} query={query} />
                    </span>
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
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [activeTab, setActiveTab] = useState(fields[0]?.key);

  useEffect(() => {
    if (!query) {
      setMatchCount(0);
      return;
    }
    const nodes = Array.from(document.querySelectorAll('[data-diff-match="true"]'));
    setMatchCount(nodes.length);
    if (nodes.length === 0) return;
    let idx = matchIndex % nodes.length;
    if (idx < 0) idx += nodes.length;
    nodes.forEach((node, i) => {
      node.classList.toggle("bg-warning/60", i === idx);
      node.classList.toggle("bg-warning/30", i !== idx);
    });
    nodes[idx].scrollIntoView({ behavior: "smooth", block: "center" });
  }, [query, matchIndex, activeTab, collapse]);

  const goToMatch = (delta: number) => {
    const nodes = Array.from(document.querySelectorAll('[data-diff-match="true"]'));
    if (nodes.length === 0) return;
    setMatchIndex((i) => (i + delta + nodes.length) % nodes.length);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch id="collapse-unchanged" checked={collapse} onCheckedChange={setCollapse} />
          <Label htmlFor="collapse-unchanged" className="text-xs font-normal text-muted-foreground">
            Collapse unchanged lines
          </Label>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Find in payload diff..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setMatchIndex(0); }}
              className="h-8 pl-8 text-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setMatchIndex(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {query && (
            <div className="flex items-center gap-1">
              <span className="min-w-[4.5rem] text-right text-xs text-muted-foreground">
                {matchCount > 0 ? `${matchIndex + 1} / ${matchCount}` : "0 matches"}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => goToMatch(-1)}
                disabled={matchCount === 0}
                aria-label="Previous match"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => goToMatch(1)}
                disabled={matchCount === 0}
                aria-label="Next match"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {fields.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
        {fields.map((f) => (
          <TabsContent key={f.key} value={f.key} className="mt-3">
            <DiffPane before={f.before} after={f.after} collapse={collapse} query={query} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
