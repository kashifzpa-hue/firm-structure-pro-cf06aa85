import { Document, View, Text } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection, PdfTable } from "@/components/pdf/PdfLayout";
import { formatReportDate, formatDateTime, buildOwnershipChainLabel } from "@/lib/report-helpers";

interface CapTableData {
  company: any;
  shareClasses: any[];
  shareholders: any[];
  movements: any[];
  asOfDate: Date;
  showClassBreakdown: boolean;
  showMovementHistory: boolean;
}

export function CapTablePdf({ data }: { data: CapTableData }) {
  const genDate = formatDateTime(new Date());
  const isHistorical = data.asOfDate.toDateString() !== new Date().toDateString();
  const reportTitle = "Cap Table Report";

  return (
    <Document>
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate} isHistorical={isHistorical}>
        <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 4 }}>
          {data.company.name}
        </Text>
        <Text style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
          Shareholding as of {formatReportDate(data.asOfDate.toISOString().split("T")[0])}
        </Text>

        {isHistorical && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 8, marginBottom: 12, borderRadius: 4 }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#92400E" }}>
              HISTORICAL SNAPSHOT — This cap table reflects ownership as reconstructed from the Movement Ledger as of {formatReportDate(data.asOfDate.toISOString().split("T")[0])}.
            </Text>
          </View>
        )}

        {/* Capital Summary */}
        <PdfSection title="CAPITAL SUMMARY" />
        <PdfTable
          columns={[
            { label: "Class Name", width: "22%" },
            { label: "Total Issued", width: "16%" },
            { label: "Par Value", width: "14%" },
            { label: "Currency", width: "12%" },
            { label: "Total Capital Value", width: "20%" },
            { label: "Voting", width: "16%" },
          ]}
          rows={data.shareClasses.map((sc) => [
            sc.class_name,
            sc.total_shares_issued?.toLocaleString(),
            sc.par_value_per_share?.toString(),
            sc.currency || "AED",
            ((sc.total_shares_issued || 0) * (sc.par_value_per_share || 0)).toLocaleString() + " " + (sc.currency || "AED"),
            sc.voting_rights ? "Yes" : "No",
          ])}
        />

        {/* Shareholder Register */}
        <PdfSection title="SHAREHOLDER REGISTER" />
        {data.showClassBreakdown ? (
          data.shareClasses.map((sc, scIdx) => {
            const classShareholders = data.shareholders.filter((s) => s.share_class_id === sc.id);
            return (
              <View key={scIdx} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 4 }}>
                  {sc.class_name} — {sc.total_shares_issued?.toLocaleString()} shares at {sc.currency || "AED"} {sc.par_value_per_share} per share
                </Text>
                <PdfTable
                  columns={[
                    { label: "#", width: "5%" },
                    { label: "Shareholder", width: "25%" },
                    { label: "Type", width: "10%" },
                    { label: "Shares", width: "15%" },
                    { label: "Economic %", width: "15%" },
                    { label: "Voting %", width: "15%" },
                    { label: "Since", width: "15%" },
                  ]}
                  rows={classShareholders.map((s, i) => [
                    (i + 1).toString(),
                    s.owner_name,
                    s.owner_type === "person" ? "Person" : "Company",
                    s.shares_owned?.toLocaleString() || "—",
                    (s.economic_pct ?? s.percentage ?? 0).toFixed(2) + "%",
                    (s.voting_pct ?? s.percentage ?? 0).toFixed(2) + "%",
                    formatReportDate(s.effective_date),
                  ])}
                />
              </View>
            );
          })
        ) : (
          <PdfTable
            columns={[
              { label: "#", width: "5%" },
              { label: "Shareholder", width: "20%" },
              { label: "Type", width: "10%" },
              { label: "Share Class", width: "15%" },
              { label: "Shares", width: "12%" },
              { label: "Economic %", width: "12%" },
              { label: "Voting %", width: "12%" },
              { label: "Since", width: "14%" },
            ]}
            rows={data.shareholders.map((s, i) => [
              (i + 1).toString(),
              s.owner_name,
              s.owner_type === "person" ? "Person" : "Company",
              s.share_class_name || "—",
              s.shares_owned?.toLocaleString() || "—",
              (s.economic_pct ?? s.percentage ?? 0).toFixed(2) + "%",
              (s.voting_pct ?? s.percentage ?? 0).toFixed(2) + "%",
              formatReportDate(s.effective_date),
            ])}
          />
        )}

        {/* Ownership Bar Chart */}
        <PdfSection title="OWNERSHIP CHART" />
        <View style={{ marginTop: 8 }}>
          {data.shareholders.map((s, i) => {
            const pct = Math.min(s.economic_pct ?? s.percentage ?? 0, 100);
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ fontSize: 8, width: "25%", color: "#1E293B" }}>{s.owner_name}</Text>
                <View style={{ width: "60%", height: 12, backgroundColor: "#E2E8F0", borderRadius: 2 }}>
                  <View style={{ width: `${Math.max(pct, 1)}%`, height: 12, backgroundColor: "#3B82F6", borderRadius: 2 }} />
                </View>
                <Text style={{ fontSize: 8, width: "15%", textAlign: "right", color: "#1E293B" }}>
                  {pct.toFixed(2)}%
                </Text>
              </View>
            );
          })}
        </View>
      </PdfPageWrapper>

      {/* Movement History */}
      {data.showMovementHistory && data.movements.length > 0 && (
        <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate} isHistorical={isHistorical}>
          <PdfSection title="MOVEMENT HISTORY" />
          <PdfTable
            columns={[
              { label: "Date", width: "12%" },
              { label: "Type", width: "14%" },
              { label: "From", width: "16%" },
              { label: "To", width: "16%" },
              { label: "Shares", width: "10%" },
              { label: "Share Class", width: "14%" },
              { label: "Consideration", width: "10%" },
              { label: "Reference", width: "8%" },
            ]}
            rows={data.movements.map((m) => [
              formatReportDate(m.movement_date),
              m.movement_type?.replace(/_/g, " "),
              m.from_name || "—",
              m.to_name || "—",
              m.shares_transferred?.toLocaleString(),
              m.share_class_name || "—",
              m.total_consideration ? m.total_consideration.toLocaleString() + " " + (m.currency || "") : "—",
              m.reference_number || "—",
            ])}
          />
        </PdfPageWrapper>
      )}
    </Document>
  );
}
