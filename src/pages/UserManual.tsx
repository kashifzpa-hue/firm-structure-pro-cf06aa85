import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  LayoutDashboard, Building2, Link2, GitBranch, ScrollText, Shield, FileBarChart,
  FileText, Landmark, PenLine, Settings, ChevronLeft, ChevronRight, Printer,
  BookOpen, CheckCircle2, AlertTriangle, Users, Lock, Bell,
} from "lucide-react";

type Slide = {
  kicker: string;
  title: string;
  subtitle?: string;
  render: () => JSX.Element;
};

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-3 items-start">
    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
    <span className="text-muted-foreground leading-relaxed">{children}</span>
  </li>
);

const Tile = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <Card className="p-5 flex gap-4 items-start h-full">
    <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
    </div>
  </Card>
);

const Step = ({ n, title, desc }: { n: number; title: string; desc: string }) => (
  <div className="flex gap-4 items-start">
    <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold shrink-0">
      {n}
    </div>
    <div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const slides: Slide[] = [
  {
    kicker: "User Manual",
    title: "CorpSync",
    subtitle: "Corporate entity, ownership and compliance management — in one place.",
    render: () => (
      <div className="grid md:grid-cols-3 gap-4">
        <Tile icon={Building2} title="Entities" desc="Companies and people, with documents and KYC status tracked per record." />
        <Tile icon={Link2} title="Ownership" desc="Share classes, cap tables and a movement ledger that keeps history intact." />
        <Tile icon={Shield} title="Compliance" desc="Recursive UBO calculation, expiry alerts and audit-ready PDF reports." />
      </div>
    ),
  },
  {
    kicker: "Overview",
    title: "What the system does",
    subtitle: "A single source of truth for corporate structures.",
    render: () => (
      <ul className="space-y-4 max-w-3xl">
        <Bullet>Maintains a register of every company and individual in your structure, scoped to your workspace.</Bullet>
        <Bullet>Stores constitutional and KYC documents with expiry tracking and version history.</Bullet>
        <Bullet>Models share capital by class and records every ownership change as a dated movement.</Bullet>
        <Bullet>Calculates ultimate beneficial owners across unlimited layers, including indirect paths.</Bullet>
        <Bullet>Produces board-ready PDF reports: corporate profiles, cap tables, UBO declarations, KYC expiry.</Bullet>
        <Bullet>Optionally tracks bank accounts, signatories and approval matrices.</Bullet>
      </ul>
    ),
  },
  {
    kicker: "Navigation",
    title: "The modules",
    render: () => (
      <div className="grid md:grid-cols-2 gap-4">
        <Tile icon={LayoutDashboard} title="Dashboard" desc="Health of the structure: expiring documents, UBO alerts, draft movements." />
        <Tile icon={Building2} title="Entities" desc="Create companies and people; open a record for documents, board, cap table and UBO tabs." />
        <Tile icon={Link2} title="Ownership" desc="Direct shareholding links between entities with economic and voting percentages." />
        <Tile icon={GitBranch} title="Org Chart" desc="Interactive visual of the group, with capital badges and unallocated-share reporting." />
        <Tile icon={ScrollText} title="Ledger" desc="Chronological record of every share issuance, transfer and cancellation." />
        <Tile icon={Shield} title="UBO Registry" desc="All beneficial owners above threshold, filterable and exportable." />
        <Tile icon={FileBarChart} title="Reports" desc="Generate and preview PDF packs for regulators, banks and auditors." />
        <Tile icon={FileText} title="Documents" desc="Central document library with status badges and renewal workflow." />
      </div>
    ),
  },
  {
    kicker: "Getting started",
    title: "First 20 minutes",
    render: () => (
      <div className="space-y-6 max-w-3xl">
        <Step n={1} title="Create your workspace" desc="Name your firm or group. All data is isolated to this workspace." />
        <Step n={2} title="Add entities" desc="Add companies first, then individuals. Use the import tool for bulk onboarding." />
        <Step n={3} title="Define share classes" desc="On each company, set up ordinary, preference or voting classes and authorised capital." />
        <Step n={4} title="Build the cap table in Setup Mode" desc="Enter existing holdings directly. This is the historical starting position." />
        <Step n={5} title="Switch to Live Mode" desc="From here every change is a movement — the ledger becomes your audit trail." />
        <Step n={6} title="Upload documents" desc="Attach licences, passports and registers with issue and expiry dates." />
      </div>
    ),
  },
  {
    kicker: "Ownership",
    title: "Setup Mode vs Live Mode",
    subtitle: "The rule that protects your audit trail.",
    render: () => (
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="p-6">
          <Badge variant="secondary" className="mb-3">Setup Mode</Badge>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Edit shareholdings directly to reflect the position as it exists today. Use this only while
            onboarding a company. Nothing is written to the ledger.
          </p>
        </Card>
        <Card className="p-6 border-primary/40">
          <Badge className="mb-3">Live Mode</Badge>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Direct editing is locked. Every change runs through the Movement Wizard: details, parties,
            consideration, confirm. Each movement is dated, documented and reversible only by a new movement.
          </p>
        </Card>
        <div className="md:col-span-2 flex gap-3 items-start rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Switching to Live Mode is deliberate. Verify the cap table balances and all classes are allocated first.
          </p>
        </div>
      </div>
    ),
  },
  {
    kicker: "Compliance",
    title: "How UBO is calculated",
    render: () => (
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <ul className="space-y-4">
          <Bullet>Ownership links are traversed recursively through up to 10 layers of holding companies.</Bullet>
          <Bullet>Economic percentage uses all shares; voting percentage uses voting shares only.</Bullet>
          <Bullet>Multiple routes to the same person are summed — direct plus indirect.</Bullet>
          <Bullet>Circular ownership is detected and flagged rather than causing an error.</Bullet>
          <Bullet>25% is the compliance trigger; anyone at or above it appears in the UBO Registry.</Bullet>
        </ul>
        <Card className="p-6 space-y-3">
          <p className="text-sm font-semibold">Worked example</p>
          <div className="text-sm text-muted-foreground space-y-2 font-mono">
            <p>Person A → HoldCo (60%)</p>
            <p>HoldCo → OpCo (50%)</p>
            <p className="text-foreground">Person A in OpCo = 30% → UBO</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Chains are visualised on the UBO tab of each company.
          </p>
        </Card>
      </div>
    ),
  },
  {
    kicker: "Documents",
    title: "Status, alerts and renewals",
    render: () => (
      <div className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Valid
            </span>
            <p className="text-sm text-muted-foreground mt-2">Expiry date is comfortably in the future.</p>
          </Card>
          <Card className="p-5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Expiring Soon
            </span>
            <p className="text-sm text-muted-foreground mt-2">Inside the alert window — action required.</p>
          </Card>
          <Card className="p-5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Expired
            </span>
            <p className="text-sm text-muted-foreground mt-2">Past its expiry date; blocks clean compliance reporting.</p>
          </Card>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Tile icon={Bell} title="Automated alerts" desc="Scheduled checks raise notifications and email digests before documents lapse." />
          <Tile icon={FileText} title="Renewals keep history" desc="Renewing a document creates a new version — previous copies remain accessible." />
        </div>
      </div>
    ),
  },
  {
    kicker: "Banking",
    title: "Accounts and signatories",
    subtitle: "Available when the Banking module is enabled for your workspace.",
    render: () => (
      <div className="grid md:grid-cols-2 gap-4">
        <Tile icon={Landmark} title="Bank Accounts" desc="Record accounts per entity with currency, bank and status." />
        <Tile icon={PenLine} title="Signatory Register" desc="Who can sign, for which accounts, with mandate expiry tracking." />
        <Tile icon={Users} title="Approval matrix" desc="Define limits and combinations — e.g. any two signatories above a threshold." />
        <Tile icon={FileBarChart} title="Bank signatory report" desc="Export a signed-off PDF for relationship managers." />
      </div>
    ),
  },
  {
    kicker: "Administration",
    title: "Roles, access and security",
    render: () => (
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <p className="font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Admin</p>
            <p className="text-sm text-muted-foreground mt-1">Full create, edit and delete rights, plus workspace settings and user roles.</p>
          </Card>
          <Card className="p-5">
            <p className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Viewer</p>
            <p className="text-sm text-muted-foreground mt-1">Read-only across every module, including reports.</p>
          </Card>
        </div>
        <ul className="space-y-4">
          <Bullet>Every record is scoped to your workspace and enforced at database level.</Bullet>
          <Bullet>Sensitive documents are encrypted at rest.</Bullet>
          <Bullet>Notifications and alert rules are configurable in Settings.</Bullet>
          <Bullet>Demo accounts run read-only and are clearly banner-flagged.</Bullet>
        </ul>
      </div>
    ),
  },
  {
    kicker: "Reference",
    title: "Everyday workflows",
    render: () => (
      <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">
        <Step n={1} title="Transfer shares" desc="Ledger → New Movement → Transfer. Select seller, buyer, class and quantity, attach the SPA, confirm." />
        <Step n={2} title="Issue new shares" desc="Company → Cap Table → New Movement → Issuance. Authorised capital is validated automatically." />
        <Step n={3} title="Add a director" desc="Company → Board tab → Appointment. Record role and effective date." />
        <Step n={4} title="Produce a UBO declaration" desc="Reports → UBO Declaration → pick entity → preview → download PDF." />
        <Step n={5} title="Chase expiring KYC" desc="Dashboard → Expiring documents → open record → Renew." />
        <Step n={6} title="Review the structure" desc="Org Chart → expand layers, check unallocated shares, export the view." />
      </div>
    ),
  },
  {
    kicker: "Support",
    title: "Good practice",
    render: () => (
      <div className="space-y-6 max-w-3xl">
        <ul className="space-y-4">
          <Bullet>Complete Setup Mode fully before going live — retrofitting history is painful.</Bullet>
          <Bullet>Attach the underlying document to every movement; the ledger is only as strong as its evidence.</Bullet>
          <Bullet>Review the UBO Registry after any restructuring, not just annually.</Bullet>
          <Bullet>Keep passport and licence expiry dates accurate so alerts stay meaningful.</Bullet>
        </ul>
        <div className="flex gap-3 items-start rounded-lg border bg-muted/40 p-4">
          <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Need help or a walkthrough? Contact your workspace administrator, or reach the CorpSync team at{" "}
            <span className="text-foreground font-medium">info@holdingstructure.com</span>.
          </p>
        </div>
      </div>
    ),
  },
];

export default function UserManual() {
  const [i, setI] = useState(0);
  const total = slides.length;

  const next = useCallback(() => setI((v) => Math.min(v + 1, total - 1)), [total]);
  const prev = useCallback(() => setI((v) => Math.max(v - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const s = slides[i];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">User Manual</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="icon" onClick={prev} disabled={i === 0} aria-label="Previous slide">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums w-14 text-center">
            {i + 1} / {total}
          </span>
          <Button variant="outline" size="icon" onClick={next} disabled={i === total - 1} aria-label="Next slide">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((i + 1) / total) * 100}%` }}
          />
        </div>
        <div className="p-8 md:p-12 min-h-[520px] flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{s.kicker}</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">{s.title}</h2>
          {s.subtitle && <p className="mt-2 text-muted-foreground max-w-2xl">{s.subtitle}</p>}
          <div className="mt-8 flex-1">{s.render()}</div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {slides.map((sl, idx) => (
          <button
            key={sl.title}
            onClick={() => setI(idx)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              idx === i
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {sl.title}
          </button>
        ))}
      </div>
    </div>
  );
}
