import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const boardRoles = ["Chairman", "Vice Chairman", "Director", "Independent Director", "Managing Director", "Other"];
const managementRoles = [
  "Chief Executive Officer (CEO)",
  "Chief Financial Officer (CFO)",
  "Chief Operating Officer (COO)",
  "Chief Technology Officer (CTO)",
  "General Manager",
  "Company Secretary",
  "Legal Manager",
  "HR Manager",
  "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyEntityId: string;
  companyName: string;
  category: "board" | "management";
  editingAppointment?: any;
  onSaved: () => void;
}

export function AppointmentFormModal({ open, onOpenChange, companyEntityId, companyName, category, editingAppointment, onSaved }: Props) {
  const { workspaceId } = useAuth();
  const [persons, setPersons] = useState<any[]>([]);
  const [personId, setPersonId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
  const [passportStatus, setPassportStatus] = useState<{ type: string; expiry: string | null } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  const rolePresets = category === "board" ? boardRoles : managementRoles;

  useEffect(() => {
    if (!workspaceId || !open) return;
    supabase.from("entities").select("id, name").eq("workspace_id", workspaceId).eq("type", "person").order("name")
      .then(({ data }) => setPersons(data || []));
  }, [workspaceId, open]);

  useEffect(() => {
    if (editingAppointment) {
      setPersonId(editingAppointment.person_entity_id);
      const isPreset = rolePresets.filter(r => r !== "Other").includes(editingAppointment.role_title);
      setRoleTitle(isPreset ? editingAppointment.role_title : "Other");
      setCustomRole(isPreset ? "" : editingAppointment.role_title);
      setAppointmentDate(editingAppointment.appointment_date);
      setNotes(editingAppointment.notes || "");
    } else {
      setPersonId("");
      setRoleTitle("");
      setCustomRole("");
      setAppointmentDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      setPassportStatus(null);
      setDuplicateWarning("");
    }
  }, [editingAppointment, open]);

  // Fetch passport status when person selected
  useEffect(() => {
    if (!personId) { setPassportStatus(null); return; }
    supabase.from("documents").select("document_type, expiry_date")
      .eq("entity_id", personId)
      .in("document_type", ["Passport", "National ID"])
      .order("expiry_date", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPassportStatus({ type: data[0].document_type, expiry: data[0].expiry_date });
        } else {
          setPassportStatus(null);
        }
      });
  }, [personId]);

  // Check for duplicate key roles (CEO, Chairman)
  useEffect(() => {
    const resolvedRole = roleTitle === "Other" ? customRole : roleTitle;
    if (!resolvedRole || !companyEntityId || !workspaceId) { setDuplicateWarning(""); return; }
    const keyRoles = ["Chairman", "Chief Executive Officer (CEO)"];
    if (!keyRoles.includes(resolvedRole)) { setDuplicateWarning(""); return; }

    supabase.from("appointments").select("id")
      .eq("company_entity_id", companyEntityId)
      .eq("workspace_id", workspaceId)
      .eq("role_title", resolvedRole)
      .is("resignation_date", null)
      .then(({ data }) => {
        const existing = data?.filter(a => a.id !== editingAppointment?.id) || [];
        if (existing.length > 0) {
          setDuplicateWarning(`This company already has an active ${resolvedRole}. Are you sure you want to add another?`);
        } else {
          setDuplicateWarning("");
        }
      });
  }, [roleTitle, customRole, companyEntityId, workspaceId, editingAppointment]);

  const handleSave = async () => {
    if (!workspaceId || !personId || !appointmentDate) return;
    const resolvedRole = roleTitle === "Other" ? customRole : roleTitle;
    if (!resolvedRole) { toast.error("Please select a role"); return; }

    setSaving(true);
    const data = {
      workspace_id: workspaceId,
      company_entity_id: companyEntityId,
      person_entity_id: personId,
      role_title: resolvedRole,
      role_category: category as any,
      appointment_date: appointmentDate,
      notes: notes || null,
    };

    if (editingAppointment) {
      const { error } = await supabase.from("appointments").update(data).eq("id", editingAppointment.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Appointment updated");
    } else {
      const { error } = await supabase.from("appointments").insert(data);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Appointment added");
    }
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  const filteredPersons = persons.filter(p =>
    p.name.toLowerCase().includes(personSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingAppointment ? "Edit" : "Add"} {category === "board" ? "Director" : "Management"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Select person..." /></SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <Input
                    placeholder="Search by name..."
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                {filteredPersons.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {personId && passportStatus && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{passportStatus.type}</span>
                <span className="text-muted-foreground">·</span>
                {passportStatus.expiry ? (
                  <>
                    <span className="text-muted-foreground">Exp {format(new Date(passportStatus.expiry), "dd MMM yyyy")}</span>
                    <span className="text-muted-foreground">·</span>
                    <StatusBadge expiryDate={passportStatus.expiry} />
                  </>
                ) : (
                  <span className="text-muted-foreground">No expiry</span>
                )}
              </div>
            )}
            {personId && !passportStatus && (
              <p className="text-xs text-muted-foreground">No passport/ID document found</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role Title</Label>
            <Select value={roleTitle} onValueChange={setRoleTitle}>
              <SelectTrigger><SelectValue placeholder="Select role..." /></SelectTrigger>
              <SelectContent>
                {rolePresets.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {roleTitle === "Other" && (
            <div className="space-y-2">
              <Label>Custom Role Title</Label>
              <Input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Enter role title" />
            </div>
          )}

          {duplicateWarning && (
            <Alert className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">{duplicateWarning}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Appointment Date</Label>
            <Input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !personId || !roleTitle}>
            {saving ? "Saving..." : editingAppointment ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
