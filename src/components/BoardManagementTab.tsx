import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppointmentFormModal } from "@/components/AppointmentFormModal";
import { Edit, Plus, Trash2, UserMinus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface Props {
  companyEntityId: string;
  companyName: string;
}

export function BoardManagementTab({ companyEntityId, companyName }: Props) {
  const { workspaceId, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResigned, setShowResigned] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formCategory, setFormCategory] = useState<"board" | "management">("board");
  const [editing, setEditing] = useState<any>(null);
  const [resignOpen, setResignOpen] = useState(false);
  const [resignTarget, setResignTarget] = useState<any>(null);
  const [resignDate, setResignDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchAppointments = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("appointments")
      .select("*, person:entities!appointments_person_entity_id_fkey(id, name)")
      .eq("company_entity_id", companyEntityId)
      .eq("workspace_id", workspaceId)
      .order("appointment_date", { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, [companyEntityId, workspaceId]);

  const boardAppts = appointments.filter(a => a.role_category === "board" && (showResigned || !a.resignation_date));
  const mgmtAppts = appointments.filter(a => a.role_category === "management" && (showResigned || !a.resignation_date));

  const handleResign = async () => {
    if (!resignTarget) return;
    const { error } = await supabase.from("appointments").update({ resignation_date: resignDate }).eq("id", resignTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment marked as resigned");
    setResignOpen(false);
    fetchAppointments();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("appointments").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Appointment deleted");
    setDeleteOpen(false);
    fetchAppointments();
  };

  const isToday = (dateStr: string) => dateStr === format(new Date(), "yyyy-MM-dd");

  const renderTable = (items: any[], category: "board" | "management") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Full Name</TableHead>
          <TableHead>Role Title</TableHead>
          <TableHead>Appointment Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              No {category === "board" ? "board members" : "management personnel"} found.
            </TableCell>
          </TableRow>
        ) : (
          items.map((appt) => (
            <TableRow key={appt.id}>
              <TableCell>
                <button
                  className="font-medium text-primary hover:underline"
                  onClick={() => navigate(`/entities/${appt.person_entity_id}`)}
                >
                  {appt.person?.name}
                </button>
              </TableCell>
              <TableCell>{appt.role_title}</TableCell>
              <TableCell>{format(parseISO(appt.appointment_date), "MMM dd, yyyy")}</TableCell>
              <TableCell>
                {appt.resignation_date ? (
                  <Badge variant="secondary">Resigned</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {!appt.resignation_date && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(appt); setFormCategory(category); setFormOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setResignTarget(appt); setResignDate(format(new Date(), "yyyy-MM-dd")); setResignOpen(true); }}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {isToday(appt.appointment_date) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteTarget(appt); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (loading) return <div className="text-muted-foreground text-center py-8">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={showResigned} onCheckedChange={setShowResigned} id="show-resigned" />
          <Label htmlFor="show-resigned" className="text-sm">Show Resigned / Historical</Label>
        </div>
      </div>

      {/* Board of Directors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">Board of Directors</h3>
          <Button size="sm" onClick={() => { setEditing(null); setFormCategory("board"); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Director
          </Button>
        </div>
        {renderTable(boardAppts, "board")}
      </div>

      {/* Key Management Personnel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-base font-semibold">Key Management Personnel</h3>
          <Button size="sm" onClick={() => { setEditing(null); setFormCategory("management"); setFormOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add Management
          </Button>
        </div>
        {renderTable(mgmtAppts, "management")}
      </div>

      <AppointmentFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        companyEntityId={companyEntityId}
        companyName={companyName}
        category={formCategory}
        editingAppointment={editing}
        onSaved={fetchAppointments}
      />

      {/* Resign Modal */}
      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resign Appointment</DialogTitle>
            <DialogDescription>Set the resignation date for {resignTarget?.person?.name} as {resignTarget?.role_title}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Resignation Date</Label>
            <Input type="date" value={resignDate} onChange={(e) => setResignDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignOpen(false)}>Cancel</Button>
            <Button onClick={handleResign}>Confirm Resignation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Appointment</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
