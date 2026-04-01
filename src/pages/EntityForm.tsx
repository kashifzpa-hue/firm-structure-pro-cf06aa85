import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { countries } from "@/lib/countries";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

const personDocTypes = ["Passport", "Emirates ID", "Residency Visa", "Other"];
const companyDocTypes = ["Trade License", "Certificate of Incorporation", "Memorandum of Association", "Articles of Association", "Tax Registration Certificate", "Power of Attorney", "Other"];
const companyTypes = ["LLC", "Free Zone LLC", "Holding Company", "Offshore", "Joint Stock", "Other"];

interface DocRow {
  id?: string;
  document_type: string;
  document_number: string;
  issue_date: string;
  expiry_date: string;
  file: File | null;
  file_url: string;
}

const emptyDoc = (): DocRow => ({
  document_type: "",
  document_number: "",
  issue_date: "",
  expiry_date: "",
  file: null,
  file_url: "",
});

export default function EntityForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== "new";
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<"person" | "company">("person");
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [dob, setDob] = useState<Date | undefined>();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [docs, setDocs] = useState<DocRow[]>([emptyDoc()]);

  useEffect(() => {
    if (!isEdit || !workspaceId) return;
    const fetch = async () => {
      const { data: entity } = await supabase.from("entities").select("*").eq("id", id).single();
      if (!entity) { navigate("/entities"); return; }
      setEntityType(entity.type as "person" | "company");
      setName(entity.name);
      setNationality(entity.nationality_or_jurisdiction || "");
      setDob(entity.date_of_birth_or_incorporation ? new Date(entity.date_of_birth_or_incorporation) : undefined);
      setEmail(entity.email || "");
      setPhone(entity.phone || "");
      setCompanyType(entity.company_type || "");
      setRegNumber(entity.registration_number || "");
      setRegAddress(entity.registered_address || "");
      setContactName(entity.primary_contact_name || "");
      setContactEmail(entity.primary_contact_email || "");
      setNotes(entity.notes || "");

      const { data: existingDocs } = await supabase.from("documents").select("*").eq("entity_id", id);
      if (existingDocs && existingDocs.length > 0) {
        setDocs(existingDocs.map((d) => ({
          id: d.id,
          document_type: d.document_type,
          document_number: d.document_number || "",
          issue_date: d.issue_date || "",
          expiry_date: d.expiry_date || "",
          file: null,
          file_url: d.file_url || "",
        })));
      }
    };
    fetch();
  }, [id, isEdit, workspaceId, navigate]);

  const addDoc = () => setDocs([...docs, emptyDoc()]);
  const removeDoc = (i: number) => setDocs(docs.filter((_, idx) => idx !== i));
  const updateDoc = (i: number, field: keyof DocRow, value: any) => {
    const updated = [...docs];
    (updated[i] as any)[field] = value;
    setDocs(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setLoading(true);

    const entityData = {
      workspace_id: workspaceId,
      type: entityType as any,
      name,
      nationality_or_jurisdiction: nationality || null,
      date_of_birth_or_incorporation: dob ? format(dob, "yyyy-MM-dd") : null,
      email: email || null,
      phone: phone || null,
      company_type: entityType === "company" ? companyType || null : null,
      registration_number: entityType === "company" ? regNumber || null : null,
      registered_address: entityType === "company" ? regAddress || null : null,
      primary_contact_name: entityType === "company" ? contactName || null : null,
      primary_contact_email: entityType === "company" ? contactEmail || null : null,
      notes: notes || null,
    };

    let entityId = id;
    if (isEdit) {
      const { error } = await supabase.from("entities").update(entityData).eq("id", id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from("entities").insert(entityData).select().single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      entityId = data.id;
    }

    // Handle documents
    for (const doc of docs) {
      let fileUrl = doc.file_url;
      if (doc.file) {
        const filePath = `${workspaceId}/${entityId}/${Date.now()}_${doc.file.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, doc.file);
        if (uploadError) { toast.error("File upload failed: " + uploadError.message); continue; }
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      const docData = {
        entity_id: entityId!,
        workspace_id: workspaceId,
        document_type: doc.document_type,
        document_number: doc.document_number || null,
        issue_date: doc.issue_date || null,
        expiry_date: doc.expiry_date || null,
        file_url: fileUrl || null,
      };

      if (doc.id) {
        await supabase.from("documents").update(docData).eq("id", doc.id);
      } else if (doc.document_type) {
        await supabase.from("documents").insert(docData);
      }
    }

    toast.success(isEdit ? "Entity updated!" : "Entity created!");
    navigate(`/entities/${entityId}`);
    setLoading(false);
  };

  const docTypeOptions = entityType === "person" ? personDocTypes : companyDocTypes;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Entity" : "Add Entity"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isEdit && (
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Entity Type</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button type="button" variant={entityType === "person" ? "default" : "outline"} onClick={() => setEntityType("person")} className="flex-1">Individual (Person)</Button>
                <Button type="button" variant={entityType === "company" ? "default" : "outline"} onClick={() => setEntityType("company")} className="flex-1">Corporate (Company)</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">{entityType === "person" ? "Personal Information" : "Company Information"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{entityType === "person" ? "Full Legal Name" : "Company Legal Name"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{entityType === "person" ? "Nationality" : "Jurisdiction / Country"}</Label>
                <Select value={nationality} onValueChange={setNationality}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{entityType === "person" ? "Date of Birth" : "Date of Incorporation"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dob ? format(dob, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dob} onSelect={setDob} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {entityType === "person" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Type</Label>
                    <Select value={companyType} onValueChange={setCompanyType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {companyTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Number</Label>
                    <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Registered Address</Label>
                  <Textarea value={regAddress} onChange={(e) => setRegAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Contact Name</Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Contact Email</Label>
                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Documents</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addDoc}>
              <Plus className="mr-1 h-4 w-4" /> Add Document
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {docs.map((doc, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Document {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {doc.expiry_date && <StatusBadge expiryDate={doc.expiry_date} />}
                    {docs.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(i)} className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={doc.document_type} onValueChange={(v) => updateDoc(i, "document_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {docTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Document Number</Label>
                    <Input value={doc.document_number} onChange={(e) => updateDoc(i, "document_number", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input type="date" value={doc.issue_date} onChange={(e) => updateDoc(i, "issue_date", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input type="date" value={doc.expiry_date} onChange={(e) => updateDoc(i, "expiry_date", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Upload File (PDF or Image)</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif" onChange={(e) => updateDoc(i, "file", e.target.files?.[0] || null)} />
                  {doc.file_url && !doc.file && <p className="text-xs text-muted-foreground">Existing file attached</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Saving..." : isEdit ? "Update Entity" : "Create Entity"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
        </div>
      </form>
    </div>
  );
}
