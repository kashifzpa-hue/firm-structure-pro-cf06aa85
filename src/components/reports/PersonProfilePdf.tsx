import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { PdfPageWrapper, PdfSection, PdfTable, PdfStyles } from "@/components/pdf/PdfLayout";
import { formatDateTime } from "@/lib/report-helpers";

const s = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "35%", fontSize: 9, color: "#64748B", fontFamily: "Helvetica-Bold" },
  value: { width: "65%", fontSize: 9, color: "#1E293B" },
  bio: { fontSize: 9, color: "#1E293B", lineHeight: 1.5, marginTop: 4 },
  posBlock: { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  posTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1E293B" },
  posSub: { fontSize: 8, color: "#64748B", marginTop: 2 },
  langBadge: { fontSize: 8, backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4, marginBottom: 4, color: "#334155" },
  langRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  headerRow: { flexDirection: "row", marginBottom: 12, paddingHorizontal: 8 },
  photo: { width: 80, height: 80, borderRadius: 40, marginRight: 12 },
  initialsCircle: { width: 80, height: 80, borderRadius: 40, marginRight: 12, backgroundColor: "#1E40AF", justifyContent: "center", alignItems: "center" },
  initials: { fontSize: 24, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  headerDetails: { flex: 1, justifyContent: "center" },
  headerName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#1E293B", marginBottom: 4 },
  headerSub: { fontSize: 9, color: "#64748B", marginBottom: 2 },
});

interface PersonProfileData {
  entity: any;
  positions: any[];
  appointments: any[];
  documents: any[];
  shareholdings: any[];
}

export function PersonProfilePdf({ data }: { data: PersonProfileData }) {
  const { entity, positions, appointments, documents, shareholdings } = data;
  const genDate = formatDateTime(new Date());

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <Document>
      <PdfPageWrapper reportTitle="Person Profile" generationDate={genDate}>
        {/* Header with Photo */}
        <View style={s.headerRow}>
          {entity.profile_photo_url ? (
            <Image src={entity.profile_photo_url} style={s.photo} />
          ) : (
            <View style={s.initialsCircle}>
              <Text style={s.initials}>{getInitials(entity.name)}</Text>
            </View>
          )}
          <View style={s.headerDetails}>
            <Text style={s.headerName}>{entity.name}</Text>
            <Text style={s.headerSub}>{entity.nationality_or_jurisdiction || ""}{entity.nationality_or_jurisdiction && entity.date_of_birth_or_incorporation ? " · " : ""}{entity.date_of_birth_or_incorporation ? `DOB: ${formatDate(entity.date_of_birth_or_incorporation)}` : ""}</Text>
            {entity.email && <Text style={s.headerSub}>{entity.email}{entity.phone ? ` · ${entity.phone}` : ""}</Text>}
            {entity.linkedin_url && <Text style={s.headerSub}>{entity.linkedin_url}</Text>}
          </View>
        </View>

        {/* Personal Details */}
        <PdfSection title="Personal Details" />
        <View style={{ paddingHorizontal: 8 }}>
          <View style={s.row}><Text style={s.label}>Full Name</Text><Text style={s.value}>{entity.name}</Text></View>
          <View style={s.row}><Text style={s.label}>Nationality</Text><Text style={s.value}>{entity.nationality_or_jurisdiction || "—"}</Text></View>
          <View style={s.row}><Text style={s.label}>Date of Birth</Text><Text style={s.value}>{formatDate(entity.date_of_birth_or_incorporation)}</Text></View>
          <View style={s.row}><Text style={s.label}>Email</Text><Text style={s.value}>{entity.email || "—"}</Text></View>
          <View style={s.row}><Text style={s.label}>Phone</Text><Text style={s.value}>{entity.phone || "—"}</Text></View>
          {entity.linkedin_url && (
            <View style={s.row}><Text style={s.label}>LinkedIn</Text><Text style={s.value}>{entity.linkedin_url}</Text></View>
          )}
        </View>

        {/* Professional Background */}
        {(entity.professional_bio || entity.qualifications || (entity.languages_spoken && entity.languages_spoken.length > 0)) && (
          <>
            <PdfSection title="Professional Background" />
            <View style={{ paddingHorizontal: 8 }}>
              {entity.qualifications && (
                <View style={s.row}><Text style={s.label}>Qualifications</Text><Text style={s.value}>{entity.qualifications}</Text></View>
              )}
              {entity.languages_spoken && entity.languages_spoken.length > 0 && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={[s.label, { marginBottom: 2 }]}>Languages</Text>
                  <View style={s.langRow}>
                    {entity.languages_spoken.map((l: string, i: number) => (
                      <Text key={i} style={s.langBadge}>{l}</Text>
                    ))}
                  </View>
                </View>
              )}
              {entity.professional_bio && (
                <View>
                  <Text style={s.label}>Professional Bio</Text>
                  <Text style={s.bio}>{entity.professional_bio}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Career History */}
        {positions.length > 0 && (
          <>
            <PdfSection title="Career History" />
            <View style={{ paddingHorizontal: 8 }}>
              {positions.map((p, i) => (
                <View key={i} style={s.posBlock}>
                  <Text style={s.posTitle}>{p.role_title} — {p.company_name}</Text>
                  <Text style={s.posSub}>
                    {formatDate(p.from_date)} — {p.is_current ? "Present" : formatDate(p.to_date)}
                  </Text>
                  {p.notes && <Text style={[s.posSub, { marginTop: 2 }]}>{p.notes}</Text>}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Board & Management Appointments */}
        {appointments.length > 0 && (
          <>
            <PdfSection title="Current Appointments" />
            <PdfTable
              columns={[
                { label: "Company", width: "35%" },
                { label: "Role", width: "25%" },
                { label: "Category", width: "15%" },
                { label: "Appointed", width: "25%" },
              ]}
              rows={appointments.map(a => [
                a.company_name || "—",
                a.role_title,
                a.role_category === "board" ? "Board" : "Management",
                formatDate(a.appointment_date),
              ])}
            />
          </>
        )}

        {/* Shareholdings */}
        {shareholdings.length > 0 && (
          <>
            <PdfSection title="Shareholdings" />
            <PdfTable
              columns={[
                { label: "Company", width: "35%" },
                { label: "Share Class", width: "25%" },
                { label: "Shares", width: "20%" },
                { label: "Percentage", width: "20%" },
              ]}
              rows={shareholdings.map(s => [
                s.company_name || "—",
                s.share_class_name || "—",
                s.shares_owned?.toLocaleString() || "—",
                s.percentage != null ? `${Number(s.percentage).toFixed(2)}%` : "—",
              ])}
            />
          </>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <>
            <PdfSection title="Documents" />
            <PdfTable
              columns={[
                { label: "Type", width: "30%" },
                { label: "Number", width: "25%" },
                { label: "Issue Date", width: "20%" },
                { label: "Expiry Date", width: "25%" },
              ]}
              rows={documents.map(d => [
                d.document_type,
                d.document_number || "—",
                formatDate(d.issue_date),
                formatDate(d.expiry_date),
              ])}
            />
          </>
        )}
      </PdfPageWrapper>
    </Document>
  );
}
