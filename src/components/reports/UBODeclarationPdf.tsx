import { Document, View, Text } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection } from "@/components/pdf/PdfLayout";
import { formatReportDate, formatDateTime, buildOwnershipChainLabel, getDocStatusLabel } from "@/lib/report-helpers";

interface UBODeclarationData {
  company: any;
  ubos: any[];
  declarationDate: Date;
  preparedBy: string;
  includePassport: boolean;
}

export function UBODeclarationPdf({ data }: { data: UBODeclarationData }) {
  const genDate = formatDateTime(new Date());
  const reportTitle = "UBO Declaration";

  return (
    <Document>
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate}>
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: "#0F172A", textAlign: "center", marginBottom: 4 }}>
          ULTIMATE BENEFICIAL OWNER DECLARATION
        </Text>
        <Text style={{ fontSize: 10, textAlign: "center", color: "#0F172A", marginBottom: 2 }}>
          {data.company.name}
        </Text>
        {data.company.registration_number && (
          <Text style={{ fontSize: 9, textAlign: "center", color: "#64748B", marginBottom: 8 }}>
            Registration No: {data.company.registration_number}
          </Text>
        )}
        <Text style={{ fontSize: 8, textAlign: "center", color: "#64748B", fontStyle: "italic", marginBottom: 16 }}>
          Prepared pursuant to UAE Federal Decree-Law No. 13 of 2023 on the Regulation of the Real Beneficiary
        </Text>

        {/* Company Details */}
        <PdfSection title="COMPANY DETAILS" />
        <View style={{ marginBottom: 8 }}>
          <InfoLine label="Name" value={data.company.name} />
          <InfoLine label="Registration Number" value={data.company.registration_number} />
          <InfoLine label="Jurisdiction" value={data.company.nationality_or_jurisdiction} />
          <InfoLine label="Incorporation Date" value={formatReportDate(data.company.date_of_birth_or_incorporation)} />
          <InfoLine label="Registered Address" value={data.company.registered_address} />
        </View>

        {/* UBO Register */}
        <PdfSection title="UBO REGISTER" />
        {data.ubos.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#94A3B8", fontStyle: "italic", marginTop: 8 }}>
            No Ultimate Beneficial Owners identified.
          </Text>
        ) : (
          data.ubos.map((u, i) => (
            <View key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 4, padding: 10, marginBottom: 10 }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0F172A", marginBottom: 6 }}>
                UBO #{i + 1}
              </Text>
              <InfoLine label="Full Legal Name" value={u.person_name} />
              <InfoLine label="Nationality" value={u.nationality} />
              <InfoLine label="Date of Birth" value={formatReportDate(u.date_of_birth)} />
              {data.includePassport && (
                <>
                  <InfoLine label="Passport Number" value={u.passport_number} />
                  <View style={{ flexDirection: "row", marginBottom: 3 }}>
                    <Text style={{ fontSize: 8, color: "#64748B", width: "35%" }}>Passport Expiry:</Text>
                    <Text style={{ fontSize: 9, color: "#1E293B" }}>
                      {formatReportDate(u.passport_expiry)}
                      {u.passport_expiry && getDocStatusLabel(u.passport_expiry) === "[EXPIRED]" ? " [EXPIRED — RENEWAL REQUIRED]" : ""}
                    </Text>
                  </View>
                </>
              )}
              <InfoLine label="Economic Ownership" value={u.effective_economic_pct?.toFixed(2) + "%"} />
              <InfoLine label="Voting Control" value={u.effective_voting_pct?.toFixed(2) + "%"} />
              <InfoLine label="Above 25% Threshold" value={u.is_above_threshold ? "YES" : "NO"} />
              <InfoLine label="Ownership Chain" value={buildOwnershipChainLabel(u.ownership_chain)} />
            </View>
          ))
        )}
      </PdfPageWrapper>

      {/* Declaration Page */}
      <PdfPageWrapper reportTitle={reportTitle} generationDate={genDate}>
        <PdfSection title="DECLARATION" />
        <Text style={{ fontSize: 9, color: "#1E293B", lineHeight: 1.6, marginTop: 8 }}>
          I/We hereby declare that the information provided above is true, accurate and complete to the best of my/our knowledge as of {formatReportDate(data.declarationDate.toISOString().split("T")[0])}.
        </Text>
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Authorised Signatory: ___________________</Text>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Name (Print): ___________________</Text>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Title: ___________________</Text>
          <Text style={{ fontSize: 9 }}>Date: ___________________</Text>
        </View>
        <View style={{ marginTop: 40 }}>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Authorised Signatory: ___________________</Text>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Name (Print): ___________________</Text>
          <Text style={{ fontSize: 9, marginBottom: 20 }}>Title: ___________________</Text>
          <Text style={{ fontSize: 9 }}>Date: ___________________</Text>
        </View>
      </PdfPageWrapper>
    </Document>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ fontSize: 8, color: "#64748B", width: "35%" }}>{label}:</Text>
      <Text style={{ fontSize: 9, color: value ? "#1E293B" : "#94A3B8", fontStyle: value ? "normal" : "italic" }}>
        {value || "[Not recorded]"}
      </Text>
    </View>
  );
}
