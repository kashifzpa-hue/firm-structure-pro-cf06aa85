import { Link } from "react-router-dom";
import { Building2, CreditCard, Landmark, PenLine, FileText, Users } from "lucide-react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

type Source = {
  key: string;
  kind: string;
  label: string;
  detail?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const nested = (row: Row, key: string): Row | undefined => (isRow(row[key]) ? (row[key] as Row) : undefined);

function bankLabel(row: Row) {
  return str(row.bank_name_custom) || str(row.bank_name) || "Bank";
}

function collect(output: unknown, push: (s: Source) => void) {
  if (!isRow(output)) return;

  const accounts = output.bank_accounts;
  if (Array.isArray(accounts)) {
    for (const a of accounts) {
      if (!isRow(a)) continue;
      const id = str(a.id);
      push({
        key: `account:${id}`,
        kind: "Bank account",
        label: `${bankLabel(a)} · ${str(a.account_number) ?? "—"}`,
        detail: [str(a.currency), str(nested(a, "company")?.name as string)].filter(Boolean).join(" · "),
        href: id ? `/bank-accounts/${id}` : undefined,
        icon: CreditCard,
      });
    }
  }

  const cifs = output.bank_relationships;
  if (Array.isArray(cifs)) {
    for (const c of cifs) {
      if (!isRow(c)) continue;
      const id = str(c.id);
      push({
        key: `cif:${id}`,
        kind: "CIF",
        label: `${bankLabel(c)} · CIF ${str(c.cif_number) ?? "—"}`,
        detail: str(nested(c, "company")?.name as string),
        href: id ? `/bank-relationships/${id}` : undefined,
        icon: Landmark,
      });
    }
  }

  const signatories = output.signatories;
  if (Array.isArray(signatories)) {
    for (const s of signatories) {
      if (!isRow(s)) continue;
      const account = nested(s, "account");
      push({
        key: `signatory:${str(s.id)}`,
        kind: "Signatory",
        label: str(nested(s, "person")?.name as string) ?? "Signatory",
        detail: [
          str(s.designation),
          account ? `${bankLabel(account)} · ${str(account.account_number) ?? "—"}` : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        href: account && str(account.id) ? `/bank-accounts/${str(account.id)}` : "/signatory-register",
        icon: PenLine,
      });
    }
  }

  const rules = output.rules;
  if (Array.isArray(rules)) {
    for (const r of rules) {
      if (!isRow(r)) continue;
      const account = nested(r, "account");
      push({
        key: `rule:${str(r.id)}`,
        kind: "Signing rule",
        label: str(r.rule_name) ?? "Signing rule",
        detail: account ? `${bankLabel(account)} · ${str(account.account_number) ?? "—"}` : undefined,
        href: account && str(account.id) ? `/bank-accounts/${str(account.id)}` : undefined,
        icon: PenLine,
      });
    }
  }

  const facilities = output.bank_facilities ?? output.facilities;
  if (Array.isArray(facilities)) {
    for (const f of facilities) {
      if (!isRow(f)) continue;
      const cif = nested(f, "cif");
      push({
        key: `facility:${str(f.id)}`,
        kind: "Facility",
        label: (str(f.facility_type) ?? "facility").replace(/_/g, " "),
        detail: cif ? `${bankLabel(cif)} · CIF ${str(cif.cif_number) ?? "—"}` : undefined,
        href: cif && str(cif.id) ? `/bank-relationships/${str(cif.id)}` : undefined,
        icon: Landmark,
      });
    }
  }

  const limits = output.credit_limits;
  if (Array.isArray(limits)) {
    for (const l of limits) {
      if (!isRow(l)) continue;
      const cif = nested(l, "cif");
      push({
        key: `limit:${str(l.id)}`,
        kind: "Credit limit",
        label: (str(l.limit_type) ?? "limit").replace(/_/g, " "),
        detail: cif ? `${bankLabel(cif)} · CIF ${str(cif.cif_number) ?? "—"}` : undefined,
        href: cif && str(cif.id) ? `/bank-relationships/${str(cif.id)}` : undefined,
        icon: Landmark,
      });
    }
  }

  const requests = output.bank_service_requests ?? output.service_requests;
  if (Array.isArray(requests)) {
    for (const r of requests) {
      if (!isRow(r)) continue;
      const cif = nested(r, "cif");
      push({
        key: `request:${str(r.id)}`,
        kind: "Bank request",
        label: str(r.subject) ?? (str(r.request_type) ?? "request").replace(/_/g, " "),
        detail: cif ? `${bankLabel(cif)} · CIF ${str(cif.cif_number) ?? "—"}` : undefined,
        href: cif && str(cif.id) ? `/bank-relationships/${str(cif.id)}` : undefined,
        icon: Landmark,
      });
    }
  }

  const entities = output.entities;
  if (Array.isArray(entities)) {
    for (const e of entities) {
      if (!isRow(e)) continue;
      const id = str(e.id);
      push({
        key: `entity:${id}`,
        kind: str(e.type) === "person" ? "Person" : "Entity",
        label: str(e.name) ?? "Entity",
        detail: str(e.nationality_or_jurisdiction),
        href: id ? `/entities/${id}` : undefined,
        icon: Building2,
      });
    }
  }

  const documents = output.documents;
  if (Array.isArray(documents)) {
    for (const d of documents) {
      if (!isRow(d)) continue;
      const entity = nested(d, "entity");
      push({
        key: `document:${str(d.id)}`,
        kind: "Document",
        label: str(d.document_type) ?? "Document",
        detail: [str(entity?.name as string), str(d.expiry_date) && `expires ${str(d.expiry_date)}`]
          .filter(Boolean)
          .join(" · "),
        href: entity && str(entity.id) ? `/entities/${str(entity.id)}` : "/documents",
        icon: FileText,
      });
    }
  }

  const appointments = output.appointments;
  if (Array.isArray(appointments)) {
    for (const a of appointments) {
      if (!isRow(a)) continue;
      const company = nested(a, "company");
      push({
        key: `appointment:${str(a.id)}`,
        kind: "Appointment",
        label: str(nested(a, "person")?.name as string) ?? "Appointment",
        detail: [str(a.role_title), str(company?.name as string)].filter(Boolean).join(" · "),
        href: company && str(company.id) ? `/entities/${str(company.id)}` : undefined,
        icon: Users,
      });
    }
  }
}

export function MessageSources({ message, className }: { message: UIMessage; className?: string }) {
  const sources: Source[] = [];
  const seen = new Set<string>();

  for (const part of message.parts ?? []) {
    if (!part.type?.startsWith("tool-")) continue;
    const output = (part as unknown as { output?: unknown }).output;
    collect(output, (s) => {
      if (seen.has(s.key)) return;
      seen.add(s.key);
      sources.push(s);
    });
  }

  if (sources.length === 0) return null;

  const shown = sources.slice(0, 24);

  return (
    <div className={cn("mt-3 rounded-lg border bg-muted/40 p-3", className)}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sources · {sources.length} record{sources.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((s) => {
          const Icon = s.icon;
          const body = (
            <>
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{s.kind}</span>
              {s.detail && <span className="hidden text-muted-foreground sm:inline">· {s.detail}</span>}
            </>
          );
          const base =
            "flex max-w-full items-center gap-1.5 truncate rounded-md border bg-background px-2 py-1 text-xs";
          return s.href ? (
            <Link key={s.key} to={s.href} className={cn(base, "transition-colors hover:bg-muted")} title={s.detail}>
              {body}
            </Link>
          ) : (
            <span key={s.key} className={base} title={s.detail}>
              {body}
            </span>
          );
        })}
        {sources.length > shown.length && (
          <span className="px-2 py-1 text-xs text-muted-foreground">+{sources.length - shown.length} more</span>
        )}
      </div>
    </div>
  );
}
