import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection, PdfTable, PdfStyles } from "@/components/pdf/PdfLayout";
import { formatReportDate, formatDateTime, buildOwnershipChainLabel, getDocStatusLabel } from "@/lib/report-helpers";

interface CircularDisclosure {
  ownerName: string;
  ownedName: string;
  exceptionType: string;
  jurisdiction: string;
  disposalRequired: boolean;
  disposalDeadline: string | null;
  notes: string | null;
  percentage: number;
}

interface CorporateProfileData {
  company: any;
  shareClasses: any[];
  shareholders: any[];
  boardMembers: any[];
  management: any[];
  ubos: any[];
  documents: any[];
  asOfDate: Date;
  generatedBy: string;
  circularDisclosures?: CircularDisclosure[];
  sections: {
    shareCapital: boolean;
    shareholders: boolean;
    board: boolean;
    management: boolean;
    ubo: boolean;
    documents: boolean;
  };
}

export function CorporateProfilePdf({ data }: { data: CorporateProfileData }) {
  const genDate = formatDateTime(new Date());
  const isHistorical = data.asOfDate.toDateString() !== new Date().toDateString();
  const reportTitle = "Corporate Profile Report";

  return (
    <Document>
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate} isHistorical={isHistorical}>
        {/* Company Header */}
        <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 12 }}>
          {data.company.name}
        </Text>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <View style={{ width: "50%" }}>
            <InfoRow label="Registration Number" value={data.company.registration_number} />
            <InfoRow label="Company Type" value={data.company.company_type} />
            <InfoRow label="Date of Incorporation" value={formatReportDate(data.company.date_of_birth_or_incorporation)} />
            <InfoRow label="Jurisdiction" value={data.company.nationality_or_jurisdiction} />
          </View>
          <View style={{ width: "50%" }}>
            <InfoRow label="Registered Address" value={data.company.registered_address} />
            <InfoRow label="Primary Contact" value={data.company.primary_contact_name} />
            <InfoRow label="Contact Email" value={data.company.primary_contact_email} />
            <InfoRow label="Report Date" value={formatReportDate(data.asOfDate.toISOString().split("T")[0])} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#F8FAFC", borderRadius: 4 }}>
          <Text style={{ fontSize: 8, color: "#64748B" }}>
            Cap Table Status: {data.company.captable_status === "live" ? "Live Mode" : "Setup Mode"}
          </Text>
        </View>

        {/* Section 1: Share Capital */}
        {data.sections.shareCapital && (
          <>
            <PdfSection title="SHARE CAPITAL STRUCTURE" />
            <PdfTable
              columns={[
                { label: "Share Class", width: "18%" },
                { label: "Total Shares", width: "13%" },
                { label: "Par Value", width: "12%" },
                { label: "Currency", width: "10%" },
                { label: "Total Value", width: "15%" },
                { label: "Voting", width: "10%" },
                { label: "Allocated", width: "11%" },
                { label: "Unallocated", width: "11%" },
              ]}
              rows={data.shareClasses.map((sc) => {
                const allocated = data.shareholders
                  .filter((s) => s.share_class_id === sc.id)
                  .reduce((sum: number, s: any) => sum + (s.shares_owned || 0), 0);
                return [
                  sc.class_name,
                  sc.total_shares_issued?.toLocaleString(),
                  sc.par_value_per_share?.toString(),
                  sc.currency || "AED",
                  (sc.total_shares_issued * sc.par_value_per_share).toLocaleString() + " " + (sc.currency || "AED"),
                  sc.voting_rights ? "Yes" : "No",
                  allocated.toLocaleString(),
                  (sc.total_shares_issued - allocated).toLocaleString(),
                ];
              })}
            />
          </>
        )}

        {/* Section 2: Shareholders */}
        {data.sections.shareholders && (
          <>
            <PdfSection title="CURRENT SHAREHOLDERS" />
            <Text style={{ fontSize: 8, color: "#64748B", marginBottom: 6 }}>
              As of {formatReportDate(data.asOfDate.toISOString().split("T")[0])}
            </Text>
            <PdfTable
              columns={[
                { label: "Shareholder", width: "22%" },
                { label: "Type", width: "10%" },
                { label: "Share Class", width: "16%" },
                { label: "Shares", width: "12%" },
                { label: "Economic %", width: "12%" },
                { label: "Voting %", width: "12%" },
                { label: "Since", width: "16%" },
              ]}
              rows={data.shareholders.map((s) => [
                s.owner_name,
                s.owner_type === "person" ? "Person" : "Company",
                s.share_class_name || "—",
                s.shares_owned?.toLocaleString() || "—",
                (s.economic_pct ?? s.percentage ?? 0).toFixed(2) + "%",
                (s.voting_pct ?? s.percentage ?? 0).toFixed(2) + "%",
                formatReportDate(s.effective_date),
              ])}
            />
          </>
        )}

        {/* Section 3: Board */}
        {data.sections.board && (
          <>
            <PdfSection title="BOARD OF DIRECTORS" />
            {data.boardMembers.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#94A3B8", fontStyle: "italic", marginTop: 4 }}>
                No board members recorded.
              </Text>
            ) : (
              data.boardMembers.map((b: any, i: number) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 8, padding: 8, backgroundColor: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF", borderRadius: 4 }}>
                  <View style={{ width: "100%" }}>
                    <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1E293B", marginBottom: 2 }}>{b.person_name}</Text>
                    <Text style={{ fontSize: 9, color: "#64748B" }}>{b.role_title} · {b.nationality || "[Not recorded]"}</Text>
                    <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>Appointed: {formatReportDate(b.appointment_date)}</Text>
                    {b.qualifications && <Text style={{ fontSize: 8, color: "#64748B", marginTop: 2 }}>{b.qualifications}</Text>}
                    {b.languages_spoken?.length > 0 && <Text style={{ fontSize: 8, color: "#64748B" }}>Languages: {b.languages_spoken.join(", ")}</Text>}
                    {b.professional_bio && <Text style={{ fontSize: 8, color: "#64748B", marginTop: 2 }}>Background: {b.professional_bio}</Text>}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Section 4: Management */}
        {data.sections.management && (
          <>
            <PdfSection title="KEY MANAGEMENT PERSONNEL" />
            {data.management.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#94A3B8", fontStyle: "italic", marginTop: 4 }}>
                No management personnel recorded.
              </Text>
            ) : (
              data.management.map((m: any, i: number) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 8, padding: 8, backgroundColor: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF", borderRadius: 4 }}>
                  <View style={{ width: "100%" }}>
                    <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1E293B", marginBottom: 2 }}>{m.person_name}</Text>
                    <Text style={{ fontSize: 9, color: "#64748B" }}>{m.role_title} · {m.nationality || "[Not recorded]"}</Text>
                    <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>Appointed: {formatReportDate(m.appointment_date)}</Text>
                    {m.qualifications && <Text style={{ fontSize: 8, color: "#64748B", marginTop: 2 }}>{m.qualifications}</Text>}
                    {m.languages_spoken?.length > 0 && <Text style={{ fontSize: 8, color: "#64748B" }}>Languages: {m.languages_spoken.join(", ")}</Text>}
                    {m.professional_bio && <Text style={{ fontSize: 8, color: "#64748B", marginTop: 2 }}>Background: {m.professional_bio}</Text>}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Section 5: UBO */}
        {data.sections.ubo && (
          <>
            <PdfSection title="ULTIMATE BENEFICIAL OWNERS" />
            <Text style={{ fontSize: 8, color: "#94A3B8", fontStyle: "italic", marginBottom: 6 }}>
              The following natural persons have been identified as Ultimate Beneficial Owners with an effective ownership interest of 25% or more, in accordance with UAE Federal Decree-Law No. 13 of 2023.
            </Text>
            {data.ubos.filter((u) => u.is_above_threshold).length === 0 ? (
              <Text style={{ fontSize: 9, color: "#94A3B8", fontStyle: "italic", marginTop: 4 }}>
                No persons with ownership above the 25% regulatory threshold have been identified.
              </Text>
            ) : (
              <PdfTable
                columns={[
                  { label: "Full Name", width: "20%" },
                  { label: "Nationality", width: "14%" },
                  { label: "Date of Birth", width: "14%" },
                  { label: "Economic %", width: "12%" },
                  { label: "Voting %", width: "12%" },
                  { label: "Ownership Chain", width: "28%" },
                ]}
                rows={data.ubos
                  .filter((u) => u.is_above_threshold)
                  .map((u) => [
                    u.person_name || "[Not recorded]",
                    u.nationality || "[Not recorded]",
                    formatReportDate(u.date_of_birth),
                    u.effective_economic_pct?.toFixed(2) + "%",
                    u.effective_voting_pct?.toFixed(2) + "%",
                    buildOwnershipChainLabel(u.ownership_chain),
                  ])}
              />
            )}
          </>
        )}

        {/* Section 6: Documents */}
        {data.sections.documents && (
          <>
            <PdfSection title="DOCUMENT STATUS SUMMARY" />
            <PdfTable
              columns={[
                { label: "Document Type", width: "22%" },
                { label: "Document Number", width: "20%" },
                { label: "Issue Date", width: "18%" },
                { label: "Expiry Date", width: "18%" },
                { label: "Status", width: "22%" },
              ]}
              rows={data.documents.map((d) => [
                d.document_type,
                d.document_number || "[Not recorded]",
                formatReportDate(d.issue_date),
                formatReportDate(d.expiry_date),
                getDocStatusLabel(d.expiry_date),
              ])}
            />
          </>
        )}
        {/* Circular Ownership Disclosure */}
        {data.circularDisclosures && data.circularDisclosures.length > 0 && (
          <>
            <PdfSection title="CIRCULAR OWNERSHIP DISCLOSURE" />
            <Text style={{ fontSize: 8, color: "#94A3B8", fontStyle: "italic", marginBottom: 6 }}>
              The following circular ownership arrangements exist within this structure:
            </Text>
            {data.circularDisclosures.map((cd, i) => (
              <View key={i} style={{ marginBottom: 8, padding: 8, backgroundColor: "#FFFBEB", borderRadius: 4, borderWidth: 1, borderColor: "#FDE68A" }}>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#92400E", marginBottom: 4 }}>
                  {cd.ownerName} → {cd.ownedName} ({cd.percentage?.toFixed(2)}%)
                </Text>
                <Text style={{ fontSize: 8, color: "#78716C" }}>Exception Type: {cd.exceptionType}</Text>
                <Text style={{ fontSize: 8, color: "#78716C" }}>Jurisdiction: {cd.jurisdiction}</Text>
                <Text style={{ fontSize: 8, color: "#78716C" }}>
                  Disposal Required: {cd.disposalRequired ? `Yes — by ${formatReportDate(cd.disposalDeadline)}` : "No"}
                </Text>
                {cd.notes && <Text style={{ fontSize: 8, color: "#78716C", marginTop: 2 }}>Legal Notes: {cd.notes}</Text>}
              </View>
            ))}
            <Text style={{ fontSize: 8, color: "#64748B", marginTop: 4 }}>
              Declaration: These circular ownership arrangements have been reviewed and are maintained in accordance with applicable law.
            </Text>
          </>
        )}
      </PdfPageWrapper>

      {/* Declaration Footer Page */}
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate} isHistorical={isHistorical}>
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 9, color: "#64748B", lineHeight: 1.6 }}>
            This report was generated on {formatDateTime(new Date())} by {data.generatedBy} using CorpSync Entity Management System. The information contained herein reflects records as of {formatReportDate(data.asOfDate.toISOString().split("T")[0])} and is subject to the accuracy of data entered into the system.
          </Text>
          <View style={{ marginTop: 40 }}>
            <Text style={{ fontSize: 9, marginBottom: 20 }}>Prepared by: _______________________</Text>
            <Text style={{ fontSize: 9 }}>Date: _______________________</Text>
          </View>
        </View>
      </PdfPageWrapper>
    </Document>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }}>
      <Text style={{ fontSize: 8, color: "#64748B", width: "45%" }}>{label}:</Text>
      <Text style={{ fontSize: 9, fontFamily: value ? "Helvetica" : "Helvetica-Oblique", color: value ? "#1E293B" : "#94A3B8" }}>
        {value || "[Not recorded]"}
      </Text>
    </View>
  );
}
