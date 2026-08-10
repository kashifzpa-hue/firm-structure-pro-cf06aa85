import type { UIMessage } from "ai";
import { Check, CircleSlash, TriangleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  list_entities: "Entities register",
  get_entity: "Entity record",
  list_documents: "Document register",
  list_ownership: "Ownership links",
  list_ubos: "UBO register",
  list_bank_accounts: "Bank accounts",
  list_bank_relationships: "Bank relationships (CIFs)",
  list_signatories: "Bank signatories",
  list_signing_rules: "Signing matrix rules",
  list_bank_facilities: "Bank facilities",
  list_credit_limits: "Credit limits",
  list_bank_service_requests: "Bank service requests",
  list_appointments: "Board & management appointments",
  workspace_overview: "Workspace overview",
};

type Check = {
  key: string;
  label: string;
  state: "found" | "empty" | "error" | "running";
  note?: string;
};

function rowCount(output: unknown): number | null {
  if (typeof output !== "object" || output === null) return null;
  const o = output as Record<string, unknown>;
  if (typeof o.count === "number") return o.count;
  let total: number | null = null;
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) total = (total ?? 0) + v.length;
  }
  return total;
}

export function MessageChecklist({ message, className }: { message: UIMessage; className?: string }) {
  const checks: Check[] = [];

  (message.parts ?? []).forEach((part, i) => {
    if (!part.type?.startsWith("tool-")) return;
    const name = part.type.slice("tool-".length);
    if (!(name in TOOL_LABELS)) return;
    const p = part as unknown as { state?: string; output?: unknown; errorText?: string };
    const output = p.output as Record<string, unknown> | undefined;
    const errorText =
      p.errorText ?? (output && typeof output.error === "string" ? (output.error as string) : undefined);

    let state: Check["state"] = "running";
    let note: string | undefined;

    if (errorText) {
      state = "error";
      note = errorText;
    } else if (p.state === "output-available" || output !== undefined) {
      const count = rowCount(output);
      if (count === null) {
        state = "found";
      } else if (count === 0) {
        state = "empty";
        note = "no matching records";
      } else {
        state = "found";
        note = `${count} record${count === 1 ? "" : "s"}`;
      }
    }

    checks.push({ key: `${name}-${i}`, label: TOOL_LABELS[name], state, note });
  });

  if (checks.length === 0) return null;

  const hasError = checks.some((c) => c.state === "error");

  return (
    <div className={cn("mt-3 rounded-lg border bg-muted/40 p-3", className)}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What I checked
      </p>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-xs">
            {c.state === "found" && <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />}
            {c.state === "empty" && <CircleSlash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {c.state === "error" && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />}
            {c.state === "running" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
            <span className="font-medium">{c.label}</span>
            {c.note && (
              <span className={cn("truncate", c.state === "error" ? "text-destructive" : "text-muted-foreground")}>
                — {c.note}
              </span>
            )}
          </li>
        ))}
      </ul>
      {hasError && (
        <p className="mt-2 text-xs text-destructive">
          Some records could not be read (access or permission issue) — this is not the same as "no records exist".
        </p>
      )}
    </div>
  );
}
