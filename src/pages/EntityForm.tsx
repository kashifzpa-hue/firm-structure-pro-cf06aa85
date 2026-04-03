import { useEffect, useState } from "react";
import { encryptedUpload } from "@/lib/encryption";
import { BoardManagementTab } from "@/components/BoardManagementTab";
import { ShareCapitalSection } from "@/components/ShareCapitalSection";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { countries } from "@/lib/countries";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

const personDocTypes = ["National ID", "Passport", "Driving License", "Other"];
const companyDocTypes = ["Trade License", "Certificate of Incorporation", "Memorandum of Association", "Articles of Association", "Tax Registration Certificate", "Power of Attorney", "Other"];
const companyTypes = ["LLC", "Free Zone LLC", "Holding Company", "Offshore", "Joint Stock", "Other"];

import { RenewalFrequency, RENEWAL_OPTIONS, DOC_TYPE_PRESETS, calculateNextExpiry, getFrequencyLabel, getFrequencyMonths } from "@/lib/renewal-utils";
import { Switch } from "@/components/ui/switch";

interface DocRow {
  id?: string;
  document_type: string;
  custom_document_type: string;
  document_number: string;
  country_of_issue: string;
  issue_date: string;
  expiry_date: string;
  file: File | null;
  file_url: string;
  renewal_frequency: RenewalFrequency | "";
  renewal_months: number | "";
  auto_suggest_expiry: boolean;
}

const emptyDoc = (): DocRow => ({
  document_type: "",
  custom_document_type: "",
  document_number: "",
  country_of_issue: "",
  issue_date: "",
  expiry_date: "",
  file: null,
  file_url: "",
  renewal_frequency: "",
  renewal_months: "",
  auto_suggest_expiry: true,
});

export default function EntityForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== "new";
  const navigate = useNavigate();
  const { workspaceId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyStep, setCompanyStep] = useState(1);
  const [savedEntityId, setSavedEntityId] = useState<string | null>(null);
  const [savedEntityName, setSavedEntityName] = useState("");
  const [entityType, setEntityType] = useState<"person" | "company">("person");
  const [name, setName] = useState("");
  const [nationalities, setNationalities] = useState<string[]>([]);
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
  
  // Original values for field change tracking
  const [originalEntity, setOriginalEntity] = useState<any>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);

  useEffect(() => {
    if (!isEdit || !workspaceId) return;
    const fetch = async () => {
      const { data: entity } = await supabase.from("entities").select("*").eq("id", id).single();
      if (!entity) { navigate("/entities"); return; }
      setOriginalEntity(entity);
      setEntityType(entity.type as "person" | "company");
      setName(entity.name);
      if (entity.nationality_or_jurisdiction) {
        setNationalities(entity.nationality_or_jurisdiction.split(",").map((s: string) => s.trim()).filter(Boolean));
      }
      setDob(entity.date_of_birth_or_incorporation ? new Date(entity.date_of_birth_or_incorporation) : undefined);
      setEmail(entity.email || "");
      setPhone(entity.phone || "");
      setCompanyType(entity.company_type || "");
      setRegNumber(entity.registration_number || "");
      setRegAddress(entity.registered_address || "");
      setContactName(entity.primary_contact_name || "");
      setContactEmail(entity.primary_contact_email || "");
      setNotes(entity.notes || "");

      // Check if entity is linked
      const [linksOwner, linksOwned, appts] = await Promise.all([
        supabase.from("equity_links").select("id", { count: "exact", head: true }).eq("owner_entity_id", id).eq("workspace_id", workspaceId),
        supabase.from("equity_links").select("id", { count: "exact", head: true }).eq("owned_entity_id", id).eq("workspace_id", workspaceId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).or(`person_entity_id.eq.${id},company_entity_id.eq.${id}`),
      ]);
      setIsLinked(((linksOwner.count || 0) + (linksOwned.count || 0) + (appts.count || 0)) > 0);

      const { data: existingDocs } = await supabase.from("documents").select("*").eq("entity_id", id);
      if (existingDocs && existingDocs.length > 0) {
        setDocs(existingDocs.map((d: any) => {
          const isKnownType = [...personDocTypes, ...companyDocTypes].filter(t => t !== "Other").includes(d.document_type);
          return {
            id: d.id,
            document_type: isKnownType ? d.document_type : "Other",
            custom_document_type: isKnownType ? "" : d.document_type,
            document_number: d.document_number || "",
            country_of_issue: (d as any).country_of_issue || "",
            issue_date: d.issue_date || "",
            expiry_date: d.expiry_date || "",
            file: null,
            file_url: d.file_url || "",
            renewal_frequency: d.renewal_frequency || "",
            renewal_months: d.renewal_months || "",
            auto_suggest_expiry: d.auto_suggest_expiry ?? true,
          };
        }));
      }
    };
    fetch();
  }, [id, isEdit, workspaceId, navigate]);

  const addNationality = (country: string) => {
    if (!nationalities.includes(country)) setNationalities([...nationalities, country]);
  };
  const removeNationality = (country: string) => setNationalities(nationalities.filter((n) => n !== country));
  const addDoc = () => setDocs([...docs, emptyDoc()]);
  const removeDoc = (i: number) => setDocs(docs.filter((_, idx) => idx !== i));
  const updateDoc = (i: number, field: keyof DocRow, value: any) => {
    const updated = [...docs];
    (updated[i] as any)[field] = value;
    setDocs(updated);
  };

  // Identity fields that require versioning
  const identityFields = entityType === "person"
    ? { name: "name", nationality_or_jurisdiction: "nationality_or_jurisdiction", date_of_birth_or_incorporation: "date_of_birth_or_incorporation" }
    : { name: "name", nationality_or_jurisdiction: "nationality_or_jurisdiction", registration_number: "registration_number", company_type: "company_type", date_of_birth_or_incorporation: "date_of_birth_or_incorporation" };

  const getIdentityChanges = () => {
    if (!originalEntity) return [];
    const changes: { field: string; old_val: string; new_val: string }[] = [];
    const newNat = nationalities.length > 0 ? nationalities.join(", ") : null;
    const newDob = dob ? format(dob, "yyyy-MM-dd") : null;
    const fields: Record<string, { old: any; cur: any }> = {
      name: { old: originalEntity.name, cur: name },
      nationality_or_jurisdiction: { old: originalEntity.nationality_or_jurisdiction, cur: newNat },
      date_of_birth_or_incorporation: { old: originalEntity.date_of_birth_or_incorporation, cur: newDob },
      ...(entityType === "company" ? {
        company_type: { old: originalEntity.company_type, cur: companyType || null },
        registration_number: { old: originalEntity.registration_number, cur: regNumber || null },
      } : {}),
    };
    for (const [key, { old, cur }] of Object.entries(fields)) {
      if ((old || "") !== (cur || "")) changes.push({ field: key, old_val: old || "", new_val: cur || "" });
    }
    return changes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    // Check if identity fields changed on a linked entity — require reason
    if (isEdit && isLinked) {
      const changes = getIdentityChanges();
      if (changes.length > 0 && !changeReason.trim()) {
        setShowReasonPrompt(true);
        return;
      }
    }

    setLoading(true);

    const entityData = {
      workspace_id: workspaceId,
      type: entityType as any,
      name,
      nationality_or_jurisdiction: nationalities.length > 0 ? nationalities.join(", ") : null,
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

      // Record identity field changes
      const changes = getIdentityChanges();
      if (changes.length > 0) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").single();
        for (const ch of changes) {
          await supabase.from("entity_field_history").insert({
            entity_id: id!,
            workspace_id: workspaceId,
            field_name: ch.field,
            old_value: ch.old_val,
            new_value: ch.new_val,
            changed_by: profile?.id || null,
            change_reason: changeReason || null,
          });
        }
      }
    } else {
      const { data, error } = await supabase.from("entities").insert(entityData).select().single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      entityId = data.id;
    }

    // Handle documents
    for (const doc of docs) {
      let fileUrl = doc.file_url;
      let encryptionMeta: { iv?: string; is_encrypted?: boolean; encryption_version?: number } = {};
      if (doc.file) {
        const filePath = `${workspaceId}/${entityId}/${Date.now()}_${doc.file.name}`;
        try {
          const result = await encryptedUpload({ file: doc.file, storagePath: filePath });
          fileUrl = result.file_url;
          encryptionMeta = { iv: result.iv, is_encrypted: result.is_encrypted, encryption_version: result.encryption_version };
        } catch (uploadErr: any) {
          toast.error("File upload failed: " + uploadErr.message);
          continue;
        }
      }

      const resolvedDocType = doc.document_type === "Other" && doc.custom_document_type ? doc.custom_document_type : doc.document_type;
      const docData: any = {
        entity_id: entityId!,
        workspace_id: workspaceId,
        document_type: resolvedDocType,
        document_number: doc.document_number || null,
        country_of_issue: doc.country_of_issue || null,
        issue_date: doc.issue_date || null,
        expiry_date: doc.expiry_date || null,
        file_url: fileUrl || null,
        renewal_frequency: doc.renewal_frequency || null,
        renewal_months: doc.renewal_frequency === 'custom' && doc.renewal_months ? Number(doc.renewal_months) : null,
        auto_suggest_expiry: doc.auto_suggest_expiry,
      };

      if (doc.id) {
        await supabase.from("documents").update(docData).eq("id", doc.id);
      } else if (resolvedDocType) {
        await supabase.from("documents").insert(docData);
      }
    }

    toast.success(isEdit ? "Entity updated!" : "Entity created!");
    if (!isEdit && entityType === "company") {
      setSavedEntityId(entityId!);
      setSavedEntityName(name);
      setCompanyStep(2);
    } else {
      navigate(`/entities/${entityId}`);
    }
    setLoading(false);
  };

  const docTypeOptions = entityType === "person" ? personDocTypes : companyDocTypes;

  // Company creation steps
  const isCompanyCreationFlow = !isEdit && entityType === "company" && savedEntityId;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Entity" : "Add Entity"}</h1>
      </div>

      {/* Progress indicator for company creation */}
      {isCompanyCreationFlow && (
        <div className="flex items-center gap-2 text-sm">
          {[
            { step: 1, label: "Company Details" },
            { step: 2, label: "Share Capital" },
            { step: 3, label: "Board & Management" },
          ].map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${companyStep === s.step ? "bg-primary text-primary-foreground" : companyStep > s.step ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                {s.step}. {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Entity form */}
      {(!isCompanyCreationFlow || companyStep === 1) && (
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
                  {entityType === "person" ? (
                    <div className="space-y-2">
                      <Select value="" onValueChange={addNationality}>
                        <SelectTrigger><SelectValue placeholder="Add nationality" /></SelectTrigger>
                        <SelectContent>
                          {countries.filter((c) => !nationalities.includes(c)).map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {nationalities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {nationalities.map((n) => (
                            <Badge key={n} variant="secondary" className="gap-1 pr-1">
                              {n}
                              <button type="button" onClick={() => removeNationality(n)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Select value={nationalities[0] || ""} onValueChange={(v) => setNationalities([v])}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{entityType === "person" ? "Date of Birth" : "Date of Incorporation"}</Label>
                  <Input type="date" value={dob ? format(dob, "yyyy-MM-dd") : ""} onChange={(e) => setDob(e.target.value ? new Date(e.target.value + "T00:00:00") : undefined)} />
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
                      <Select value={doc.document_type} onValueChange={(v) => {
                        updateDoc(i, "document_type", v);
                        if (v !== "Other") updateDoc(i, "custom_document_type", "");
                        // Auto-populate renewal frequency from presets
                        const preset = DOC_TYPE_PRESETS[v];
                        if (preset) {
                          updateDoc(i, "renewal_frequency", preset.frequency);
                          if (preset.months) updateDoc(i, "renewal_months", preset.months);
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {docTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {doc.document_type === "Other" ? (
                      <div className="space-y-2">
                        <Label>Custom Document Type</Label>
                        <Input value={doc.custom_document_type} onChange={(e) => updateDoc(i, "custom_document_type", e.target.value)} placeholder="Enter document type" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Document Number</Label>
                        <Input value={doc.document_number} onChange={(e) => updateDoc(i, "document_number", e.target.value)} />
                      </div>
                    )}
                  </div>
                  {doc.document_type === "Other" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Document Number</Label>
                        <Input value={doc.document_number} onChange={(e) => updateDoc(i, "document_number", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Country of Issue</Label>
                        <Select value={doc.country_of_issue} onValueChange={(v) => updateDoc(i, "country_of_issue", v)}>
                          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {doc.document_type !== "Other" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Country of Issue</Label>
                        <Select value={doc.country_of_issue} onValueChange={(v) => updateDoc(i, "country_of_issue", v)}>
                          <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                          <SelectContent>
                            {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div />
                    </div>
                  )}
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
                  {/* Renewal Frequency Section */}
                  <div className="space-y-3 rounded-md border border-dashed p-3">
                    <Label className="text-sm font-medium">Renewal Frequency</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Select value={doc.renewal_frequency || "none"} onValueChange={(v) => updateDoc(i, "renewal_frequency", v as RenewalFrequency)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RENEWAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {doc.renewal_frequency === "custom" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Renews every</span>
                            <Input type="number" min={1} className="w-20" value={doc.renewal_months} onChange={(e) => updateDoc(i, "renewal_months", parseInt(e.target.value) || "")} />
                            <span className="text-sm text-muted-foreground">months</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={doc.auto_suggest_expiry} onCheckedChange={(v) => updateDoc(i, "auto_suggest_expiry", v)} id={`auto-suggest-${i}`} />
                      <Label htmlFor={`auto-suggest-${i}`} className="text-xs text-muted-foreground cursor-pointer">
                        Auto-suggest next expiry date when renewing
                      </Label>
                    </div>
                    {doc.expiry_date && doc.renewal_frequency && doc.renewal_frequency !== 'none' && (() => {
                      const nextExpiry = calculateNextExpiry(doc.expiry_date, doc.renewal_frequency as RenewalFrequency, typeof doc.renewal_months === 'number' ? doc.renewal_months : undefined);
                      return nextExpiry ? (
                        <p className="text-xs text-muted-foreground">
                          Next renewal due: <span className="font-medium">{format(parseISO(nextExpiry), "MMM dd, yyyy")}</span> ({getFrequencyLabel(doc.renewal_frequency as RenewalFrequency, typeof doc.renewal_months === 'number' ? doc.renewal_months : undefined)} from expiry date)
                        </p>
                      ) : null;
                    })()}
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

          {/* Reason prompt for identity field changes on linked entities */}
          {isEdit && isLinked && showReasonPrompt && (
            <Card className="shadow-sm border-warning/50">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium text-warning">Identity field(s) changed on a linked entity. Please provide a reason:</p>
                <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Company rebranded, Name correction..." />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={loading || (showReasonPrompt && !changeReason.trim())} className="flex-1">
              {loading ? "Saving..." : isEdit ? "Update Entity" : "Create Entity"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          </div>
        </form>
      )}

      {/* Step 2: Share Capital */}
      {isCompanyCreationFlow && companyStep === 2 && (
        <div className="space-y-4">
          <p className="text-muted-foreground">Set up the share capital structure for <strong>{savedEntityName}</strong>. You can always add or edit this later.</p>
          <ShareCapitalSection companyEntityId={savedEntityId} companyName={savedEntityName} />
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => setCompanyStep(3)}>Skip for Now</Button>
            <Button onClick={() => setCompanyStep(3)}>Next: Board & Management</Button>
          </div>
        </div>
      )}

      {/* Step 3: Board & Management */}
      {isCompanyCreationFlow && companyStep === 3 && (
        <div className="space-y-4">
          <BoardManagementTab companyEntityId={savedEntityId} companyName={savedEntityName} />
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate(`/entities/${savedEntityId}`)}>Skip for Now</Button>
            <Button onClick={() => navigate(`/entities/${savedEntityId}`)}>Done — View Entity</Button>
          </div>
        </div>
      )}
    </div>
  );
}
