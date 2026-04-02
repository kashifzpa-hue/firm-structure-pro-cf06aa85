import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection, PdfTable, PdfStyles } from "@/components/pdf/PdfLayout";
import { formatReportDate, formatDateTime } from "@/lib/report-helpers";

const localStyles = StyleSheet.create({
  companyName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 4 },
  bankName: { fontSize: 12, color: "#64748B", marginBottom: 12 },
  reportTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 8 },
  infoBox: { flexDirection: "row", marginBottom: 16, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 4, padding: 10 },
  infoCol: { width: "50%" },
  infoLabel: { fontSize: 8, color: "#64748B", marginBottom: 1 },
  infoValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1E293B", marginBottom: 6 },
  divider: { borderBottomWidth: 2, borderBottomColor: "#0F172A", marginBottom: 14 },
  groupHeader: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#CBD5E1" },
  sigBlock: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 4, padding: 10, marginBottom: 10, flexDirection: "row" },
  sigLeft: { width: "40%", paddingRight: 10 },
  sigRight: { width: "60%" },
  sigImage: { width: "100%", height: 80, objectFit: "contain", marginBottom: 4 },
  sigPlaceholder: { width: "100%", height: 80, borderWidth: 1, borderColor: "#CBD5E1", borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  sigCaption: { fontSize: 7, color: "#94A3B8", fontStyle: "italic" },
  sigName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1E293B", marginBottom: 2 },
  sigDetail: { fontSize: 8, color: "#1E293B", marginBottom: 2 },
  sigDetailLabel: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  sigDivider: { borderBottomWidth: 1, borderBottomColor: "#E2E8F0", marginVertical: 4 },
  statusDot: { fontSize: 8 },
  warningText: { fontSize: 8, color: "#DC2626", marginTop: 2 },
  matrixNote: { fontSize: 8, color: "#64748B", fontStyle: "italic", marginTop: 8 },
  declText: { fontSize: 9, color: "#1E293B", lineHeight: 1.6, marginBottom: 16 },
  sigBlockDecl: { width: "45%", marginTop: 20 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#1E293B", marginBottom: 4, marginTop: 30 },
  sigBlockLabel: { fontSize: 8, color: "#64748B", marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#64748B", marginBottom: 10 },
  noData: { fontSize: 9, color: "#94A3B8", fontStyle: "italic" },
});

interface BankSignatoryData {
  company: any;
  bankAccount: any;
  signatories: any[];
  groups: any[];
  matrixRules: any[];
  reportDate: Date;
  preparedBy: string;
  purpose: string;
  passportMap?: Record<string, any>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View>
      <Text style={localStyles.infoLabel}>{label}</Text>
      <Text style={localStyles.infoValue}>{value || "[Not recorded]"}</Text>
    </View>
  );
}

function formatAuthFor(arr: string[]): string {
  if (!arr || arr.length === 0) return "—";
  if (arr.includes("all")) return "All";
  const labels: Record<string, string> = {
    payments: "Payments", cheques: "Cheques", trade_finance: "Trade Finance",
    fx: "FX", online_admin: "Online Admin",
  };
  return arr.map(a => labels[a] || a).join(" · ");
}

function formatRuleSignatories(rule: any, groups: any[]): string {
  const groupA = groups.find((g: any) => g.id === rule.group_a_id);
  const groupB = groups.find((g: any) => g.id === rule.group_b_id);
  if (rule.rule_type === "solo") return `Any 1 from ${groupA?.group_label || "—"}`;
  if (rule.rule_type === "joint_same_group") return `Any ${rule.min_signatories_from_a} from ${groupA?.group_label || "—"}`;
  if (rule.rule_type === "joint_cross_group") return `${rule.min_signatories_from_a} from ${groupA?.group_label || "—"} + ${rule.min_signatories_from_b || 1} from ${groupB?.group_label || "—"}`;
  return "—";
}

function formatLimit(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "Unlimited";
  return `${currency} ${Number(amount).toLocaleString()}`;
}

export function BankSignatoryPdf({ data }: { data: BankSignatoryData }) {
  const genDate = formatDateTime(new Date());
  const ba = data.bankAccount;

  const groupMap: Record<string, any[]> = {};
  const ungrouped: any[] = [];
  data.signatories.forEach((s: any) => {
    if (s.signatory_group_id) {
      if (!groupMap[s.signatory_group_id]) groupMap[s.signatory_group_id] = [];
      groupMap[s.signatory_group_id].push(s);
    } else {
      ungrouped.push(s);
    }
  });

  const activeCount = data.signatories.filter((s: any) => s.status === "active").length;
  const groupCount = data.groups.length;

  return (
    <Document>
      <PdfPageWrapper reportTitle="Authorised Signatory Record" generationDate={genDate}>
        <Text style={localStyles.reportTitle}>AUTHORISED SIGNATORY RECORD</Text>
        <Text style={localStyles.companyName}>{data.company?.name}</Text>
        <Text style={localStyles.bankName}>{ba?.bank_name}</Text>

        <View style={localStyles.infoBox}>
          <View style={localStyles.infoCol}>
            <InfoRow label="Account Number" value={ba?.account_number} />
            <InfoRow label="IBAN" value={ba?.iban} />
            <InfoRow label="Account Type" value={ba?.account_type} />
            <InfoRow label="Currency" value={ba?.currency} />
          </View>
          <View style={localStyles.infoCol}>
            <InfoRow label="Branch" value={ba?.branch_name} />
            <InfoRow label="SWIFT" value={ba?.swift_code} />
            <InfoRow label="Report Date" value={formatReportDate(data.reportDate.toISOString().split("T")[0])} />
            <InfoRow label="Prepared By" value={data.preparedBy} />
          </View>
        </View>

        <View style={localStyles.divider} />

        {/* Company Details */}
        <PdfSection title="COMPANY DETAILS" />
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <View style={{ width: "50%" }}>
            <InfoRow label="Registration Number" value={data.company?.registration_number} />
            <InfoRow label="Jurisdiction" value={data.company?.nationality_or_jurisdiction} />
          </View>
          <View style={{ width: "50%" }}>
            <InfoRow label="Incorporation Date" value={formatReportDate(data.company?.date_of_birth_or_incorporation)} />
            <InfoRow label="Registered Address" value={data.company?.registered_address} />
          </View>
        </View>

        {/* Signatories */}
        <PdfSection title="AUTHORISED SIGNATORIES" />
        <Text style={localStyles.subtitle}>
          {activeCount} active signator{activeCount === 1 ? "y" : "ies"} across {groupCount} group{groupCount === 1 ? "" : "s"}
        </Text>

        {data.groups.map((group: any) => {
          const groupSigs = groupMap[group.id] || [];
          if (groupSigs.length === 0) return null;
          return (
            <View key={group.id}>
              <Text style={localStyles.groupHeader}>
                {group.group_label.toUpperCase()}{group.description ? ` — ${group.description}` : ""}
              </Text>
              {groupSigs.map((sig: any) => (
                <SignatoryBlock key={sig.id} sig={sig} passportMap={data.passportMap} />
              ))}
            </View>
          );
        })}

        {ungrouped.length > 0 && (
          <View>
            <Text style={localStyles.groupHeader}>UNASSIGNED</Text>
            {ungrouped.map((sig: any) => (
              <SignatoryBlock key={sig.id} sig={sig} passportMap={data.passportMap} />
            ))}
          </View>
        )}

        {/* Signing Matrix */}
        <PdfSection title="SIGNING MATRIX" />
        <Text style={localStyles.subtitle}>Valid signatory combinations and transaction authorities</Text>

        {data.matrixRules.length === 0 ? (
          <Text style={localStyles.noData}>No signing matrix rules recorded for this account.</Text>
        ) : (
          <>
            <PdfTable
              columns={[
                { label: "Rule", width: "20%" },
                { label: "Signatories Required", width: "25%" },
                { label: "Transaction Limit", width: "18%" },
                { label: "Daily Limit", width: "17%" },
                { label: "Applies To", width: "20%" },
              ]}
              rows={data.matrixRules.map((r: any) => [
                r.rule_name,
                formatRuleSignatories(r, data.groups),
                formatLimit(r.transaction_limit, r.limit_currency),
                formatLimit(r.daily_limit, r.limit_currency),
                formatAuthFor(r.applies_to),
              ])}
            />
            <Text style={localStyles.matrixNote}>
              The above matrix defines valid combinations of authorised signatories and their respective transaction limits. All signatories must act within the scope of their designated authority.
            </Text>
          </>
        )}

        {/* Declaration */}
        <PdfSection title="DECLARATION" />
        <Text style={localStyles.declText}>
          This document sets out the authorised signatories for {data.company?.name} with respect to account {ba?.account_number} at {ba?.bank_name}.
          {"\n\n"}
          This record is accurate as of {formatReportDate(data.reportDate.toISOString().split("T")[0])} and supersedes all previous signatory records for this account.
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={localStyles.sigBlockDecl}>
            <Text style={localStyles.sigBlockLabel}>Authorised Signatory:</Text>
            <View style={localStyles.sigLine} />
            <Text style={localStyles.sigBlockLabel}>Name (Print):</Text>
            <View style={localStyles.sigLine} />
            <Text style={localStyles.sigBlockLabel}>Title:</Text>
            <View style={{ ...localStyles.sigLine, marginTop: 20 }} />
            <Text style={localStyles.sigBlockLabel}>Date:</Text>
            <View style={{ ...localStyles.sigLine, marginTop: 20 }} />
          </View>
          <View style={localStyles.sigBlockDecl}>
            <Text style={localStyles.sigBlockLabel}>Authorised Signatory:</Text>
            <View style={localStyles.sigLine} />
            <Text style={localStyles.sigBlockLabel}>Name (Print):</Text>
            <View style={localStyles.sigLine} />
            <Text style={localStyles.sigBlockLabel}>Title:</Text>
            <View style={{ ...localStyles.sigLine, marginTop: 20 }} />
            <Text style={localStyles.sigBlockLabel}>Date:</Text>
            <View style={{ ...localStyles.sigLine, marginTop: 20 }} />
          </View>
        </View>
      </PdfPageWrapper>
    </Document>
  );
}

function SignatoryBlock({ sig, passportMap }: { sig: any; passportMap?: Record<string, any> }) {
  const passport = passportMap?.[sig.person_entity_id];
  const passportExpiry = passport?.expiry_date;
  let passportWarning = "";
  if (passportExpiry) {
    const diff = Math.ceil((new Date(passportExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) passportWarning = `⚠ Passport expired ${passportExpiry}`;
    else if (diff <= 90) passportWarning = `⚠ Passport expires ${passportExpiry}`;
  }

  return (
    <View style={localStyles.sigBlock} wrap={false}>
      <View style={localStyles.sigLeft}>
        {sig.signature_image_url ? (
          <>
            <Image src={sig.signature_image_url} style={localStyles.sigImage} />
            <Text style={localStyles.sigCaption}>Reproduced for identification purposes only</Text>
          </>
        ) : (
          <>
            <View style={localStyles.sigPlaceholder}>
              <Text style={{ fontSize: 8, color: "#94A3B8" }}>Signature not on record</Text>
            </View>
            <Text style={localStyles.sigCaption}>No signature uploaded</Text>
          </>
        )}
      </View>
      <View style={localStyles.sigRight}>
        <Text style={localStyles.sigName}>{sig.person_name || "Unknown"}</Text>
        {passportWarning ? <Text style={localStyles.warningText}>{passportWarning}</Text> : null}
        <Text style={localStyles.sigDetail}>{sig.designation}</Text>
        <View style={localStyles.sigDivider} />
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Individual Limit: </Text>
          {sig.individual_limit ? `${sig.individual_limit_currency || "AED"} ${Number(sig.individual_limit).toLocaleString()}` : "No solo limit"}
        </Text>
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Authorised For: </Text>
          {formatAuthFor(sig.authorised_for)}
        </Text>
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Effective Date: </Text>
          {formatReportDate(sig.effective_date)}
        </Text>
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Expiry Date: </Text>
          {sig.expiry_date ? formatReportDate(sig.expiry_date) : "No expiry"}
        </Text>
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Board Resolution: </Text>
          {sig.board_resolution_ref || "[Not recorded]"}
        </Text>
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Bank Acknowledged: </Text>
          {sig.bank_acknowledged_date ? formatReportDate(sig.bank_acknowledged_date) : "⏳ Pending"}
        </Text>
        <View style={localStyles.sigDivider} />
        <Text style={localStyles.sigDetail}>
          <Text style={localStyles.sigDetailLabel}>Status: </Text>● {sig.status === "active" ? "Active" : sig.status === "suspended" ? "Suspended" : "Revoked"}
        </Text>
      </View>
    </View>
  );
}
