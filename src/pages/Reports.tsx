import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, PieChart, Shield, AlertTriangle, CalendarIcon, Loader2 } from "lucide-react";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PdfPreviewModal } from "@/components/reports/PdfPreviewModal";
import { CorporateProfilePdf } from "@/components/reports/CorporateProfilePdf";
import { CapTablePdf } from "@/components/reports/CapTablePdf";
import { UBODeclarationPdf } from "@/components/reports/UBODeclarationPdf";
import { KYCExpiryPdf } from "@/components/reports/KYCExpiryPdf";
import { sanitizeFilename, formatDateForFilename } from "@/lib/report-helpers";

import { BankSignatoryPdf } from "@/components/reports/BankSignatoryPdf";
import { useBankingEnabled } from "@/hooks/use-banking-enabled";
import { PenLine } from "lucide-react";

const reportCards = [
  { key: "corporate", title: "Corporate Profile Report", icon: Building2, desc: "Complete company overview including shareholders, board, management and UBO declaration" },
  { key: "captable", title: "Cap Table Report", icon: PieChart, desc: "Full shareholder register with share classes, percentages and historical snapshot option" },
  { key: "ubo", title: "UBO Declaration Report", icon: Shield, desc: "Regulatory UBO disclosure formatted for UAE compliance submission" },
  { key: "kyc", title: "KYC Expiry Report", icon: AlertTriangle, desc: "All expiring and expired documents across selected entities or entire workspace" },
];

export default function Reports() {
  const { workspaceId } = useAuth();
  const { bankingEnabled } = useBankingEnabled();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<any[]>([]);
  const [allEntities, setAllEntities] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<React.ReactElement | null>(null);
  const [previewFilename, setPreviewFilename] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Corporate config
  const [corpCompanyId, setCorpCompanyId] = useState("");
  const [corpAsOfDate, setCorpAsOfDate] = useState<Date>(new Date());
  const [corpSections, setCorpSections] = useState({
    shareCapital: true, shareholders: true, board: true, management: true, ubo: true, documents: true,
  });

  // CapTable config
  const [capCompanyId, setCapCompanyId] = useState("");
  const [capAsOfDate, setCapAsOfDate] = useState<Date>(new Date());
  const [capShowClassBreakdown, setCapShowClassBreakdown] = useState(true);
  const [capShowMovements, setCapShowMovements] = useState(false);

  // UBO config
  const [uboCompanyId, setUboCompanyId] = useState("");
  const [uboDeclarationDate, setUboDeclarationDate] = useState<Date>(new Date());
  const [uboPreparedBy, setUboPreparedBy] = useState("");
  const [uboIncludePassport, setUboIncludePassport] = useState(true);

  // KYC config
  const [kycScope, setKycScope] = useState("workspace");
  const [kycCompanyId, setKycCompanyId] = useState("");
  const [kycEntityId, setKycEntityId] = useState("");
  const [kycWindow, setKycWindow] = useState("all");
  const [kycIncludeUbo, setKycIncludeUbo] = useState(true);

  // Bank Signatory config
  const [bsCompanyId, setBsCompanyId] = useState("");
  const [bsBankAccountId, setBsBankAccountId] = useState("");
  const [bsPurpose, setBsPurpose] = useState("Internal Reference");
  const [bsPreparedBy, setBsPreparedBy] = useState("");
  const [bsReportDate, setBsReportDate] = useState<Date>(new Date());
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    const load = async () => {
      const [compRes, entRes, profileRes] = await Promise.all([
        supabase.from("entities").select("id, name, type, captable_status, registration_number, company_type, date_of_birth_or_incorporation, nationality_or_jurisdiction, registered_address, primary_contact_name, primary_contact_email, email, entity_status").eq("workspace_id", workspaceId).eq("type", "company").eq("entity_status", "active").order("name"),
        supabase.from("entities").select("id, name, type, entity_status").eq("workspace_id", workspaceId).eq("entity_status", "active").order("name"),
        supabase.from("profiles").select("full_name").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single(),
      ]);
      setCompanies(compRes.data || []);
      setAllEntities(entRes.data || []);
      setUboPreparedBy(profileRes.data?.full_name || "");
      setBsPreparedBy(profileRes.data?.full_name || "");
    };
    load();
  }, [workspaceId]);

  // Auto-open modal from URL params (e.g. from EntityDetail quick reports)
  useEffect(() => {
    const type = searchParams.get("type");
    const company = searchParams.get("company");
    if (type && companies.length > 0) {
      if (company) {
        setCorpCompanyId(company);
        setCapCompanyId(company);
        setUboCompanyId(company);
        setKycCompanyId(company);
        setKycScope("company");
      }
      setOpenModal(type);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, companies]);

  const openReport = (key: string, preselectedCompanyId?: string) => {
    if (preselectedCompanyId) {
      setCorpCompanyId(preselectedCompanyId);
      setCapCompanyId(preselectedCompanyId);
      setUboCompanyId(preselectedCompanyId);
      setKycCompanyId(preselectedCompanyId);
      setKycScope("company");
    }
    setOpenModal(key);
  };

  // ========== CORPORATE PROFILE ==========
  const generateCorporateProfile = async () => {
    if (!corpCompanyId || !workspaceId) return;
    setGenerating(true);
    try {
      const company = companies.find((c) => c.id === corpCompanyId);
      const [scRes, elRes, apptsRes, docsRes, uboRes, entRes] = await Promise.all([
        supabase.from("share_classes").select("*").eq("company_entity_id", corpCompanyId).eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("*, owner:entities!equity_links_owner_entity_id_fkey(id, name, type, nationality_or_jurisdiction, date_of_birth_or_incorporation), share_class:share_classes(class_name)").eq("owned_entity_id", corpCompanyId).eq("workspace_id", workspaceId).is("end_date", null),
        supabase.from("appointments").select("*, person:entities!appointments_person_entity_id_fkey(id, name, nationality_or_jurisdiction, professional_bio, qualifications, languages_spoken)").eq("company_entity_id", corpCompanyId).eq("workspace_id", workspaceId).is("resignation_date", null),
        supabase.from("documents").select("*").eq("entity_id", corpCompanyId).eq("workspace_id", workspaceId),
        supabase.from("ubo_snapshots").select("*").eq("company_entity_id", corpCompanyId).eq("workspace_id", workspaceId).eq("snapshot_type", "live"),
        supabase.from("entities").select("id, name, nationality_or_jurisdiction, date_of_birth_or_incorporation").eq("workspace_id", workspaceId),
      ]);

      const entityMap = Object.fromEntries((entRes.data || []).map((e: any) => [e.id, e]));

      // Get passport info for UBOs
      const uboPersonIds = (uboRes.data || []).filter((u: any) => u.person_entity_id).map((u: any) => u.person_entity_id);
      let passportMap: Record<string, any> = {};
      if (uboPersonIds.length > 0) {
        const { data: passports } = await supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("entity_id", uboPersonIds).eq("document_type", "Passport");
        (passports || []).forEach((p: any) => { passportMap[p.entity_id] = p; });
      }

      const shareholders = (elRes.data || []).map((el: any) => ({
        owner_name: el.owner?.name,
        owner_type: el.owner?.type,
        share_class_id: el.share_class_id,
        share_class_name: el.share_class?.class_name,
        shares_owned: el.shares_owned,
        percentage: el.percentage,
        economic_pct: el.percentage,
        voting_pct: el.percentage,
        effective_date: el.effective_date,
      }));

      const boardMembers = (apptsRes.data || []).filter((a: any) => a.role_category === "board").map((a: any) => ({
        person_name: a.person?.name,
        role_title: a.role_title,
        nationality: a.person?.nationality_or_jurisdiction,
        appointment_date: a.appointment_date,
        professional_bio: a.person?.professional_bio,
        qualifications: a.person?.qualifications,
        languages_spoken: a.person?.languages_spoken,
      }));

      const management = (apptsRes.data || []).filter((a: any) => a.role_category === "management").map((a: any) => ({
        person_name: a.person?.name,
        role_title: a.role_title,
        nationality: a.person?.nationality_or_jurisdiction,
        appointment_date: a.appointment_date,
        professional_bio: a.person?.professional_bio,
        qualifications: a.person?.qualifications,
        languages_spoken: a.person?.languages_spoken,
      }));

      const ubos = (uboRes.data || []).filter((u: any) => u.person_entity_id && !u.calculation_error).map((u: any) => ({
        person_name: entityMap[u.person_entity_id]?.name,
        nationality: entityMap[u.person_entity_id]?.nationality_or_jurisdiction,
        date_of_birth: entityMap[u.person_entity_id]?.date_of_birth_or_incorporation,
        effective_economic_pct: Number(u.effective_economic_pct),
        effective_voting_pct: Number(u.effective_voting_pct),
        is_above_threshold: u.is_above_threshold,
        ownership_chain: u.ownership_chain,
      }));

      const profileRes = await supabase.from("profiles").select("full_name").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();

      // Fetch circular ownership equity links for this company
      const { data: circularLinks } = await supabase.from("equity_links")
        .select("owner_entity_id, owned_entity_id, circular_ownership_type, circular_ownership_notes, disposal_required, disposal_deadline, disposal_jurisdiction, percentage, shares_owned")
        .eq("workspace_id", workspaceId)
        .not("circular_ownership_type", "is", null)
        .is("end_date", null);
      
      const circularDisclosures = (circularLinks || [])
        .filter((l: any) => l.owned_entity_id === corpCompanyId || l.owner_entity_id === corpCompanyId)
        .map((l: any) => ({
          ownerName: entityMap[l.owner_entity_id]?.name || "Unknown",
          ownedName: entityMap[l.owned_entity_id]?.name || "Unknown",
          exceptionType: l.circular_ownership_type?.replace(/_/g, " ") || "Unknown",
          jurisdiction: l.disposal_jurisdiction || "—",
          disposalRequired: l.disposal_required,
          disposalDeadline: l.disposal_deadline,
          notes: l.circular_ownership_notes,
          percentage: l.percentage,
        }));

      const doc = (
        <CorporateProfilePdf
          data={{
            company,
            shareClasses: scRes.data || [],
            shareholders,
            boardMembers,
            management,
            ubos,
            documents: docsRes.data || [],
            asOfDate: corpAsOfDate,
            generatedBy: profileRes.data?.full_name || "Unknown",
            sections: corpSections,
            circularDisclosures,
          }}
        />
      );

      const filename = `CorporateProfile_${sanitizeFilename(company?.name || "Company")}_${formatDateForFilename(corpAsOfDate)}.pdf`;
      setPreviewDoc(doc);
      setPreviewFilename(filename);
      setPreviewOpen(true);
      setOpenModal(null);
    } catch (e: any) {
      toast.error("Failed to generate report: " + (e.message || "Unknown error"));
    }
    setGenerating(false);
  };

  // ========== CAP TABLE ==========
  const generateCapTable = async () => {
    if (!capCompanyId || !workspaceId) return;
    setGenerating(true);
    try {
      const company = companies.find((c) => c.id === capCompanyId);
      const isHistorical = capAsOfDate.toDateString() !== new Date().toDateString();
      const snapshotDateStr = capAsOfDate.toISOString().split("T")[0];

      const scRes = await supabase.from("share_classes").select("*").eq("company_entity_id", capCompanyId).eq("workspace_id", workspaceId);

      let shareholders: any[] = [];
      let movements: any[] = [];
      let reportShareClasses = scRes.data || [];

      if (isHistorical) {
        // Reconstruct shareholding from confirmed movements up to snapshot date
        const { data: confirmedMov } = await supabase.from("movements")
          .select("*, share_class:share_classes(class_name, total_shares_issued), to_entity:entities!movements_to_entity_id_fkey(id, name, type), from_entity:entities!movements_from_entity_id_fkey(id, name, type)")
          .eq("company_entity_id", capCompanyId)
          .eq("workspace_id", workspaceId)
          .eq("status", "confirmed")
          .lte("movement_date", snapshotDateStr)
          .order("movement_date", { ascending: true });

        const holdings: Record<string, { entityId: string; entityName: string; entityType: string; shareClassName: string; shares: number; shareClassId: string; firstDate: string }> = {};
        const totalIssued: Record<string, number> = {};

        // Initialize total issued from share classes
        (scRes.data || []).forEach((sc: any) => { totalIssued[sc.id] = sc.total_shares_issued; });

        (confirmedMov || []).forEach((m: any) => {
          const scId = m.share_class_id;
          const scName = m.share_class?.class_name || "Unknown";

          if (m.movement_type === "CAPITAL_INCREASE") {
            totalIssued[scId] = (totalIssued[scId] || 0) + m.shares_transferred;
          } else if (m.movement_type === "CAPITAL_DECREASE") {
            totalIssued[scId] = (totalIssued[scId] || 0) - m.shares_transferred;
          }

          if (m.from_entity_id) {
            const key = `${m.from_entity_id}_${scId}`;
            if (!holdings[key]) holdings[key] = { entityId: m.from_entity_id, entityName: m.from_entity?.name || "Unknown", entityType: m.from_entity?.type || "person", shareClassName: scName, shares: 0, shareClassId: scId, firstDate: m.movement_date };
            holdings[key].shares -= m.shares_transferred;
          }
          if (m.to_entity_id) {
            const key = `${m.to_entity_id}_${scId}`;
            if (!holdings[key]) holdings[key] = { entityId: m.to_entity_id, entityName: m.to_entity?.name || "Unknown", entityType: m.to_entity?.type || "person", shareClassName: scName, shares: 0, shareClassId: scId, firstDate: m.movement_date };
            holdings[key].shares += m.shares_transferred;
          }
        });

        // Reconstruct total issued per class from movements only
        const historicalTotals: Record<string, number> = {};
        (scRes.data || []).forEach((sc: any) => { historicalTotals[sc.id] = 0; });
        (confirmedMov || []).forEach((m: any) => {
          const scId = m.share_class_id;
          if (historicalTotals[scId] === undefined) historicalTotals[scId] = 0;
          // All movements that add shares to circulation
          if (["ISSUANCE", "CAPITAL_INCREASE"].includes(m.movement_type)) {
            historicalTotals[scId] += m.shares_transferred;
          } else if (["CANCELLATION", "CAPITAL_DECREASE"].includes(m.movement_type)) {
            historicalTotals[scId] -= m.shares_transferred;
          }
        });

        shareholders = Object.values(holdings)
          .filter(h => h.shares > 0)
          .map(h => {
            const total = historicalTotals[h.shareClassId] || 0;
            const pct = total > 0 ? (h.shares / total) * 100 : 0;
            return {
              owner_name: h.entityName,
              owner_type: h.entityType,
              share_class_id: h.shareClassId,
              share_class_name: h.shareClassName,
              shares_owned: h.shares,
              percentage: pct,
              economic_pct: pct,
              voting_pct: pct,
              effective_date: h.firstDate,
            };
          });

        // Override share class totals for display
        reportShareClasses = (scRes.data || []).map((sc: any) => ({
          ...sc,
          total_shares_issued: historicalTotals[sc.id] ?? sc.total_shares_issued,
        })).filter((sc: any) => sc.total_shares_issued > 0 || shareholders.some(s => s.share_class_id === sc.id));
      } else {
        // Current: use equity_links
        const elRes = await supabase.from("equity_links").select("*, owner:entities!equity_links_owner_entity_id_fkey(id, name, type), share_class:share_classes(class_name)").eq("owned_entity_id", capCompanyId).eq("workspace_id", workspaceId).is("end_date", null);
        shareholders = (elRes.data || []).map((el: any) => ({
          owner_name: el.owner?.name,
          owner_type: el.owner?.type,
          share_class_id: el.share_class_id,
          share_class_name: el.share_class?.class_name,
          shares_owned: el.shares_owned,
          percentage: el.percentage,
          economic_pct: el.percentage,
          voting_pct: el.percentage,
          effective_date: el.effective_date,
        }));
      }

      if (capShowMovements) {
        let movQuery = supabase.from("movements").select("*, from_entity:entities!movements_from_entity_id_fkey(name), to_entity:entities!movements_to_entity_id_fkey(name), share_class:share_classes!movements_share_class_id_fkey(class_name)").eq("company_entity_id", capCompanyId).eq("workspace_id", workspaceId).eq("status", "confirmed").order("movement_date");
        if (isHistorical) {
          movQuery = movQuery.lte("movement_date", snapshotDateStr);
        }
        const movRes = await movQuery;
        movements = (movRes.data || []).map((m: any) => ({
          ...m,
          from_name: m.from_entity?.name,
          to_name: m.to_entity?.name,
          share_class_name: m.share_class?.class_name,
        }));
      }

      const doc = (
        <CapTablePdf
          data={{
            company,
            shareClasses: reportShareClasses,
            shareholders,
            movements,
            asOfDate: capAsOfDate,
            showClassBreakdown: capShowClassBreakdown,
            showMovementHistory: capShowMovements,
          }}
        />
      );

      const filename = `CapTable_${sanitizeFilename(company?.name || "Company")}_${formatDateForFilename(capAsOfDate)}.pdf`;
      setPreviewDoc(doc);
      setPreviewFilename(filename);
      setPreviewOpen(true);
      setOpenModal(null);
    } catch (e: any) {
      toast.error("Failed to generate report: " + (e.message || "Unknown error"));
    }
    setGenerating(false);
  };

  // ========== UBO DECLARATION ==========
  const generateUboDeclaration = async () => {
    if (!uboCompanyId || !workspaceId) return;
    setGenerating(true);
    try {
      const company = companies.find((c) => c.id === uboCompanyId);
      const [uboRes, entRes] = await Promise.all([
        supabase.from("ubo_snapshots").select("*").eq("company_entity_id", uboCompanyId).eq("workspace_id", workspaceId).eq("snapshot_type", "live").eq("calculation_error", false),
        supabase.from("entities").select("id, name, nationality_or_jurisdiction, date_of_birth_or_incorporation").eq("workspace_id", workspaceId),
      ]);

      const entityMap = Object.fromEntries((entRes.data || []).map((e: any) => [e.id, e]));
      const personIds = (uboRes.data || []).filter((u: any) => u.person_entity_id).map((u: any) => u.person_entity_id);
      let passportMap: Record<string, any> = {};
      if (personIds.length > 0) {
        const { data: passports } = await supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("entity_id", personIds).eq("document_type", "Passport");
        (passports || []).forEach((p: any) => { passportMap[p.entity_id] = p; });
      }

      const ubos = (uboRes.data || []).filter((u: any) => u.person_entity_id).map((u: any) => ({
        person_name: entityMap[u.person_entity_id]?.name,
        nationality: entityMap[u.person_entity_id]?.nationality_or_jurisdiction,
        date_of_birth: entityMap[u.person_entity_id]?.date_of_birth_or_incorporation,
        passport_number: passportMap[u.person_entity_id]?.document_number,
        passport_expiry: passportMap[u.person_entity_id]?.expiry_date,
        effective_economic_pct: Number(u.effective_economic_pct),
        effective_voting_pct: Number(u.effective_voting_pct),
        is_above_threshold: u.is_above_threshold,
        ownership_chain: u.ownership_chain,
      }));

      const doc = (
        <UBODeclarationPdf
          data={{
            company,
            ubos,
            declarationDate: uboDeclarationDate,
            preparedBy: uboPreparedBy,
            includePassport: uboIncludePassport,
          }}
        />
      );

      const filename = `UBODeclaration_${sanitizeFilename(company?.name || "Company")}_${formatDateForFilename(uboDeclarationDate)}.pdf`;
      setPreviewDoc(doc);
      setPreviewFilename(filename);
      setPreviewOpen(true);
      setOpenModal(null);
    } catch (e: any) {
      toast.error("Failed to generate report: " + (e.message || "Unknown error"));
    }
    setGenerating(false);
  };

  // ========== KYC EXPIRY ==========
  const generateKycExpiry = async () => {
    if (!workspaceId) return;
    setGenerating(true);
    try {
      let query = supabase.from("documents").select("*, entities!inner(id, name, type)").eq("workspace_id", workspaceId);
      if (kycScope === "company" && kycCompanyId) {
        // Get all entity IDs linked to this company
        const { data: links } = await supabase.from("equity_links").select("owner_entity_id").eq("owned_entity_id", kycCompanyId).eq("workspace_id", workspaceId).is("end_date", null);
        const relatedIds = [kycCompanyId, ...(links || []).map((l: any) => l.owner_entity_id)];
        query = query.in("entity_id", relatedIds);
      } else if (kycScope === "entity" && kycEntityId) {
        query = query.eq("entity_id", kycEntityId);
      }

      const { data: docs } = await query;
      const allDocs = docs || [];

      // Get appointments for role info
      const { data: appointments } = await supabase.from("appointments").select("*, company:entities!appointments_company_entity_id_fkey(name)").eq("workspace_id", workspaceId).is("resignation_date", null);

      // Get UBO data
      const { data: uboData } = await supabase.from("ubo_snapshots").select("*").eq("workspace_id", workspaceId).eq("snapshot_type", "live").eq("calculation_error", false);
      const entityMap = Object.fromEntries(allEntities.map((e) => [e.id, e]));

      const getRole = (entityId: string, entityType: string) => {
        if (entityType === "company") return "Operating Entity";
        const roles = (appointments || []).filter((a: any) => a.person_entity_id === entityId);
        if (roles.length === 0) return "—";
        return roles.map((r: any) => `${r.role_title} — ${r.company?.name || "Unknown"}`).join(", ");
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filterByWindow = (doc: any) => {
        if (!doc.expiry_date) return kycWindow === "all";
        const d = parseISO(doc.expiry_date);
        if (!isValid(d)) return kycWindow === "all";
        const diff = differenceInDays(d, today);
        switch (kycWindow) {
          case "expired": return diff < 0;
          case "30": return diff <= 30;
          case "60": return diff <= 60;
          case "90": return diff <= 90;
          case "180": return diff <= 180;
          default: return true;
        }
      };

      const filtered = allDocs.filter(filterByWindow);

      const enrichDoc = (d: any) => ({
        entity_name: (d.entities as any)?.name || "—",
        entity_type: (d.entities as any)?.type || "—",
        role: getRole(d.entity_id, (d.entities as any)?.type || ""),
        document_type: d.document_type,
        document_number: d.document_number,
        expiry_date: d.expiry_date,
        issue_date: d.issue_date,
        entity_id: d.entity_id,
        renewal_cycle: d.renewal_frequency && d.renewal_frequency !== 'none'
          ? (d.renewal_frequency === 'custom' && d.renewal_months ? `Every ${d.renewal_months}m` : { annual: 'Annual', biennial: '2 years', triennial: '3 years', quinquennial: '5 years', decennial: '10 years' }[d.renewal_frequency as string] || d.renewal_frequency)
          : "—",
      });

      const expired = filtered.filter((d) => {
        if (!d.expiry_date) return false;
        const dt = parseISO(d.expiry_date);
        return isValid(dt) && differenceInDays(dt, today) < 0;
      }).map(enrichDoc);

      const expiringSoon = filtered.filter((d) => {
        if (!d.expiry_date) return false;
        const dt = parseISO(d.expiry_date);
        if (!isValid(dt)) return false;
        const diff = differenceInDays(dt, today);
        return diff >= 0;
      }).map(enrichDoc).sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

      // UBO-linked alerts
      const uboLinkedAlerts: any[] = [];
      if (kycIncludeUbo) {
        const uboPersonIds = new Set((uboData || []).filter((u: any) => u.person_entity_id).map((u: any) => u.person_entity_id));
        [...expired, ...expiringSoon].forEach((d) => {
          if (uboPersonIds.has(d.entity_id)) {
            const uboEntry = (uboData || []).find((u: any) => u.person_entity_id === d.entity_id);
            if (uboEntry) {
              uboLinkedAlerts.push({
                person_name: d.entity_name,
                company_name: entityMap[uboEntry.company_entity_id]?.name || "—",
                economic_pct: Number(uboEntry.effective_economic_pct),
                document_type: d.document_type,
                expiry_date: d.expiry_date,
              });
            }
          }
        });
      }

      // Summary counts
      const computeSummary = () => {
        let exp = 0, w30 = 0, w60 = 0, w90 = 0;
        allDocs.forEach((d) => {
          if (!d.expiry_date) return;
          const dt = parseISO(d.expiry_date);
          if (!isValid(dt)) return;
          const diff = differenceInDays(dt, today);
          if (diff < 0) exp++;
          else if (diff <= 30) w30++;
          else if (diff <= 60) w60++;
          else if (diff <= 90) w90++;
        });
        return { expired: exp, within30: w30, within60: w60, within90: w90 };
      };

      const scopeLabel = kycScope === "workspace" ? "Entire Workspace" : kycScope === "company" ? companies.find((c) => c.id === kycCompanyId)?.name || "Company" : allEntities.find((e) => e.id === kycEntityId)?.name || "Entity";
      const windowLabels: Record<string, string> = { expired: "Already Expired", "30": "Within 30 days", "60": "Within 60 days", "90": "Within 90 days", "180": "Within 180 days", all: "All documents" };

      const doc = (
        <KYCExpiryPdf
          data={{
            scope: scopeLabel,
            expiryWindow: windowLabels[kycWindow] || "All",
            includeUboAlerts: kycIncludeUbo,
            expired,
            expiringSoon,
            uboLinkedAlerts,
            summary: computeSummary(),
          }}
        />
      );

      const filename = `KYCExpiry_${sanitizeFilename(scopeLabel)}_${formatDateForFilename(new Date())}.pdf`;
      setPreviewDoc(doc);
      setPreviewFilename(filename);
      setPreviewOpen(true);
      setOpenModal(null);
    } catch (e: any) {
      toast.error("Failed to generate report: " + (e.message || "Unknown error"));
    }
    setGenerating(false);
  };

  // ========== BANK SIGNATORY ==========
  const loadBankAccounts = async (companyId: string) => {
    if (!workspaceId || !companyId) return;
    const { data } = await supabase.from("bank_accounts").select("id, bank_name, account_number").eq("company_entity_id", companyId).eq("workspace_id", workspaceId);
    setBankAccounts(data || []);
  };

  const generateBankSignatory = async () => {
    if (!bsBankAccountId || !workspaceId) return;
    setGenerating(true);
    try {
      const company = companies.find(c => c.id === bsCompanyId);
      const [baRes, groupsRes, sigsRes, rulesRes] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("id", bsBankAccountId).single(),
        supabase.from("signatory_groups").select("*").eq("bank_account_id", bsBankAccountId).eq("workspace_id", workspaceId).order("display_order"),
        supabase.from("signatories").select("*, person:entities!signatories_person_entity_id_fkey(name)").eq("bank_account_id", bsBankAccountId).eq("workspace_id", workspaceId).eq("status", "active"),
        supabase.from("signing_matrix_rules").select("*").eq("bank_account_id", bsBankAccountId).eq("workspace_id", workspaceId).order("display_order"),
      ]);
      const sigs = (sigsRes.data || []).map((s: any) => ({ ...s, person_name: s.person?.name }));
      const personIds = sigs.map((s: any) => s.person_entity_id).filter(Boolean);
      let passportMap: Record<string, any> = {};
      if (personIds.length > 0) {
        const { data: passports } = await supabase.from("documents").select("*").eq("workspace_id", workspaceId).in("entity_id", personIds).eq("document_type", "Passport");
        (passports || []).forEach((p: any) => { passportMap[p.entity_id] = p; });
      }
      const doc = (
        <BankSignatoryPdf data={{
          company, bankAccount: baRes.data, signatories: sigs,
          groups: groupsRes.data || [], matrixRules: rulesRes.data || [],
          reportDate: bsReportDate, preparedBy: bsPreparedBy, purpose: bsPurpose, passportMap,
        }} />
      );
      const ba = baRes.data;
      const filename = `BankSignatory_${sanitizeFilename(company?.name || "Company")}_${sanitizeFilename(ba?.bank_name || "Bank")}_${formatDateForFilename(bsReportDate)}.pdf`;
      setPreviewDoc(doc);
      setPreviewFilename(filename);
      setPreviewOpen(true);
      setOpenModal(null);
    } catch (e: any) {
      toast.error("Failed to generate report: " + (e.message || "Unknown error"));
    }
    setGenerating(false);
  };

  const DatePicker = ({ date, onChange }: { date: Date; onChange: (d: Date) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd MMM yyyy") : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onChange(d)} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {reportCards.map((card) => (
          <Card key={card.key} className="shadow-sm hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">{card.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{card.desc}</p>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={() => openReport(card.key)} className="w-full">Generate</Button>
            </CardContent>
          </Card>
        ))}

        {/* Bank Signatory Report - only if banking enabled */}
        {bankingEnabled && (
          <Card className="shadow-sm hover:border-primary/30 transition-colors">
            <CardHeader className="flex flex-row items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Bank Signatory Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Formatted signatory authority record for bank submission or internal reference</p>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={() => openReport("banksig")} className="w-full">Generate</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== CORPORATE PROFILE MODAL ===== */}
      <Dialog open={openModal === "corporate"} onOpenChange={(v) => !v && setOpenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Corporate Profile Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <Select value={corpCompanyId} onValueChange={setCorpCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>As of Date</Label>
              <DatePicker date={corpAsOfDate} onChange={setCorpAsOfDate} />
              <p className="text-xs text-muted-foreground mt-1">Shareholding data will reflect this date</p>
            </div>
            <div>
              <Label>Include Sections</Label>
              <div className="space-y-2 mt-2">
                {([["shareCapital", "Share Capital Summary"], ["shareholders", "Shareholders Table"], ["board", "Board of Directors"], ["management", "Key Management Personnel"], ["ubo", "UBO Declaration"], ["documents", "Document Status Summary"]] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox checked={corpSections[key]} onCheckedChange={(v) => setCorpSections((s) => ({ ...s, [key]: !!v }))} />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={generateCorporateProfile} disabled={!corpCompanyId || generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing report...</> : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CAP TABLE MODAL ===== */}
      <Dialog open={openModal === "captable"} onOpenChange={(v) => !v && setOpenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cap Table Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <Select value={capCompanyId} onValueChange={setCapCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>As of Date</Label>
              <DatePicker date={capAsOfDate} onChange={setCapAsOfDate} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Share Class Breakdown</Label>
              <Switch checked={capShowClassBreakdown} onCheckedChange={setCapShowClassBreakdown} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Movement History</Label>
              <Switch checked={capShowMovements} onCheckedChange={setCapShowMovements} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={generateCapTable} disabled={!capCompanyId || generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing report...</> : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== UBO DECLARATION MODAL ===== */}
      <Dialog open={openModal === "ubo"} onOpenChange={(v) => !v && setOpenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>UBO Declaration Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <Select value={uboCompanyId} onValueChange={setUboCompanyId}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Declaration Date</Label>
              <DatePicker date={uboDeclarationDate} onChange={setUboDeclarationDate} />
            </div>
            <div>
              <Label>Prepared By</Label>
              <Input value={uboPreparedBy} onChange={(e) => setUboPreparedBy(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Include passport details</Label>
              <Switch checked={uboIncludePassport} onCheckedChange={setUboIncludePassport} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={generateUboDeclaration} disabled={!uboCompanyId || generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing report...</> : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== KYC EXPIRY MODAL ===== */}
      <Dialog open={openModal === "kyc"} onOpenChange={(v) => !v && setOpenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>KYC Expiry Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Scope</Label>
              <RadioGroup value={kycScope} onValueChange={setKycScope} className="mt-2 space-y-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="workspace" id="scope-ws" /><label htmlFor="scope-ws" className="text-sm">Entire Workspace</label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="company" id="scope-co" /><label htmlFor="scope-co" className="text-sm">Specific Company</label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="entity" id="scope-en" /><label htmlFor="scope-en" className="text-sm">Specific Entity</label></div>
              </RadioGroup>
            </div>
            {kycScope === "company" && (
              <div>
                <Label>Company</Label>
                <Select value={kycCompanyId} onValueChange={setKycCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {kycScope === "entity" && (
              <div>
                <Label>Entity</Label>
                <Select value={kycEntityId} onValueChange={setKycEntityId}>
                  <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
                  <SelectContent>{allEntities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Expiry Window</Label>
              <Select value={kycWindow} onValueChange={setKycWindow}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expired">Already Expired</SelectItem>
                  <SelectItem value="30">Expiring within 30 days</SelectItem>
                  <SelectItem value="60">Expiring within 60 days</SelectItem>
                  <SelectItem value="90">Expiring within 90 days</SelectItem>
                  <SelectItem value="180">Expiring within 180 days</SelectItem>
                  <SelectItem value="all">All documents (no filter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Include UBO-linked alerts</Label>
              <Switch checked={kycIncludeUbo} onCheckedChange={setKycIncludeUbo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={generateKycExpiry} disabled={generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing report...</> : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== BANK SIGNATORY MODAL ===== */}
      <Dialog open={openModal === "banksig"} onOpenChange={(v) => !v && setOpenModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bank Signatory Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company</Label>
              <Select value={bsCompanyId} onValueChange={(v) => { setBsCompanyId(v); setBsBankAccountId(""); loadBankAccounts(v); }}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bank Account</Label>
              <Select value={bsBankAccountId} onValueChange={setBsBankAccountId}>
                <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent>{bankAccounts.map((ba) => <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} — ••••{ba.account_number.slice(-4)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Report Purpose</Label>
              <Select value={bsPurpose} onValueChange={setBsPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal Reference">Internal Reference</SelectItem>
                  <SelectItem value="Bank Submission">Bank Submission</SelectItem>
                  <SelectItem value="Audit Documentation">Audit Documentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Prepared By</Label><Input value={bsPreparedBy} onChange={(e) => setBsPreparedBy(e.target.value)} /></div>
            <div><Label>Report Date</Label><DatePicker date={bsReportDate} onChange={setBsReportDate} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={generateBankSignatory} disabled={!bsBankAccountId || generating}>
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing report...</> : "Generate PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {previewDoc && (
        <PdfPreviewModal
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewDoc(null); }}
          document={previewDoc}
          filename={previewFilename}
        />
      )}
    </div>
  );
}

// Export for use in EntityDetail quick reports
export { Reports as ReportsPage };
