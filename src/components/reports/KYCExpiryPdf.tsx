import { Document, View, Text } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection, PdfTable } from "@/components/pdf/PdfLayout";
import { formatReportDate, formatDateTime, getDaysInfo, getDocStatusLabel } from "@/lib/report-helpers";

interface KYCExpiryData {
  scope: string;
  expiryWindow: string;
  includeUboAlerts: boolean;
  expired: any[];
  expiringSoon: any[];
  uboLinkedAlerts: any[];
  summary: { expired: number; within30: number; within60: number; within90: number };
}

export function KYCExpiryPdf({ data }: { data: KYCExpiryData }) {
  const genDate = formatDateTime(new Date());
  const reportTitle = "KYC Document Expiry Report";

  return (
    <Document>
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate}>
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 4 }}>
          KYC DOCUMENT EXPIRY REPORT
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <Text style={{ fontSize: 9, color: "#64748B", marginRight: 20 }}>Scope: {data.scope}</Text>
          <Text style={{ fontSize: 9, color: "#64748B" }}>Window: {data.expiryWindow}</Text>
        </View>

        {/* Summary Box */}
        <View style={{ backgroundColor: "#F1F5F9", padding: 10, borderRadius: 4, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 6 }}>SUMMARY</Text>
          <Text style={{ fontSize: 9, color: "#1E293B", marginBottom: 2 }}>Already Expired: {data.summary.expired} documents</Text>
          <Text style={{ fontSize: 9, color: "#1E293B", marginBottom: 2 }}>Expiring within 30 days: {data.summary.within30}</Text>
          <Text style={{ fontSize: 9, color: "#1E293B", marginBottom: 2 }}>Expiring within 31-60 days: {data.summary.within60}</Text>
          <Text style={{ fontSize: 9, color: "#1E293B" }}>Expiring within 61-90 days: {data.summary.within90}</Text>
        </View>

        {/* Expired */}
        {data.expired.length > 0 && (
          <>
            <PdfSection title="CRITICAL: ALREADY EXPIRED" />
            <PdfTable
              columns={[
                { label: "Entity Name", width: "18%" },
                { label: "Role/Position", width: "18%" },
                { label: "Document Type", width: "14%" },
                { label: "Doc Number", width: "12%" },
                { label: "Expired On", width: "12%" },
                { label: "Days Overdue", width: "12%" },
                { label: "Renewal", width: "14%" },
              ]}
              rows={data.expired.map((d) => [
                d.entity_name,
                d.role || "—",
                d.document_type,
                d.document_number || "[N/A]",
                formatReportDate(d.expiry_date),
                getDaysInfo(d.expiry_date),
                d.renewal_cycle || "—",
              ])}
            />
          </>
        )}

        {/* Expiring Soon */}
        {data.expiringSoon.length > 0 && (
          <>
            <PdfSection title="EXPIRING SOON" />
            <PdfTable
              columns={[
                { label: "Entity Name", width: "20%" },
                { label: "Role/Position", width: "20%" },
                { label: "Document Type", width: "15%" },
                { label: "Document Number", width: "13%" },
                { label: "Expiry Date", width: "14%" },
                { label: "Days Remaining", width: "18%" },
              ]}
              rows={data.expiringSoon.map((d) => [
                d.entity_name,
                d.role || "—",
                d.document_type,
                d.document_number || "[Not recorded]",
                formatReportDate(d.expiry_date),
                getDaysInfo(d.expiry_date),
              ])}
            />
          </>
        )}

        {/* UBO Alerts */}
        {data.includeUboAlerts && data.uboLinkedAlerts.length > 0 && (
          <>
            <PdfSection title="UBO-LINKED ALERTS" />
            <Text style={{ fontSize: 8, color: "#94A3B8", fontStyle: "italic", marginBottom: 6 }}>
              The following expired or expiring documents belong to persons identified as Ultimate Beneficial Owners:
            </Text>
            <PdfTable
              columns={[
                { label: "Person Name", width: "18%" },
                { label: "UBO In", width: "18%" },
                { label: "Economic %", width: "12%" },
                { label: "Document Type", width: "16%" },
                { label: "Expiry", width: "16%" },
                { label: "Status", width: "20%" },
              ]}
              rows={data.uboLinkedAlerts.map((a) => [
                a.person_name,
                a.company_name,
                a.economic_pct?.toFixed(2) + "%",
                a.document_type,
                formatReportDate(a.expiry_date),
                getDocStatusLabel(a.expiry_date),
              ])}
            />
          </>
        )}

        {/* Action Required Footer */}
        <View style={{ marginTop: 20, padding: 10, backgroundColor: "#FEF2F2", borderRadius: 4 }}>
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#991B1B" }}>ACTION REQUIRED</Text>
          <Text style={{ fontSize: 8, color: "#991B1B", marginTop: 4 }}>
            Documents marked as expired may result in regulatory non-compliance, bank account freezes, or legal penalties. Immediate renewal is advised.
          </Text>
        </View>
      </PdfPageWrapper>
    </Document>
  );
}
