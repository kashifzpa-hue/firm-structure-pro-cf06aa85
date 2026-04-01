import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedEntity {
  name: string;
  type: "person" | "company";
  nationality_or_jurisdiction?: string;
  date_of_birth_or_incorporation?: string;
  email?: string;
  phone?: string;
  company_type?: string;
  registration_number?: string;
  registered_address?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  notes?: string;
  error?: string;
}

const TEMPLATE_COLUMNS = [
  "Name*", "Type* (person/company)", "Nationality / Jurisdiction", "Date of Birth / Incorporation (YYYY-MM-DD)",
  "Email", "Phone", "Company Type", "Registration Number", "Registered Address",
  "Primary Contact Name", "Primary Contact Email", "Notes",
];

export function EntityImportModal({ open, onOpenChange, onImported }: Props) {
  const { workspaceId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedEntity[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      ["John Doe", "person", "United Arab Emirates", "1990-05-15", "john@example.com", "+971501234567", "", "", "", "", "", "Sample person"],
      ["Gulf Holdings LLC", "company", "United Arab Emirates", "2015-03-01", "", "", "LLC", "123456", "Dubai, UAE", "Ahmed Ali", "ahmed@gulf.com", "Sample company"],
    ]);
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, "Entities");
    XLSX.writeFile(wb, "CorpSync_Entity_Template.xlsx");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          setErrors(["File is empty or has no data rows."]);
          return;
        }

        const header = rows[0].map((h: any) => String(h).toLowerCase().trim());
        const dataRows = rows.slice(1).filter(r => r.some(c => c != null && String(c).trim()));

        const entities: ParsedEntity[] = [];
        const rowErrors: string[] = [];

        dataRows.forEach((row, idx) => {
          const get = (colIdx: number) => row[colIdx] != null ? String(row[colIdx]).trim() : "";
          const name = get(0);
          const typeRaw = get(1).toLowerCase();

          if (!name) { rowErrors.push(`Row ${idx + 2}: Name is required`); return; }
          if (typeRaw !== "person" && typeRaw !== "company") {
            rowErrors.push(`Row ${idx + 2}: Type must be "person" or "company", got "${get(1)}"`);
            return;
          }

          const entity: ParsedEntity = {
            name,
            type: typeRaw as "person" | "company",
            nationality_or_jurisdiction: get(2) || undefined,
            date_of_birth_or_incorporation: get(3) || undefined,
            email: get(4) || undefined,
            phone: get(5) || undefined,
            company_type: typeRaw === "company" ? get(6) || undefined : undefined,
            registration_number: typeRaw === "company" ? get(7) || undefined : undefined,
            registered_address: typeRaw === "company" ? get(8) || undefined : undefined,
            primary_contact_name: typeRaw === "company" ? get(9) || undefined : undefined,
            primary_contact_email: typeRaw === "company" ? get(10) || undefined : undefined,
            notes: get(11) || undefined,
          };

          // Validate date format
          if (entity.date_of_birth_or_incorporation && !/^\d{4}-\d{2}-\d{2}$/.test(entity.date_of_birth_or_incorporation)) {
            entity.error = "Invalid date format (use YYYY-MM-DD)";
          }

          entities.push(entity);
        });

        setParsed(entities);
        setErrors(rowErrors);
        setStep("preview");
      } catch {
        setErrors(["Failed to parse file. Please use a valid .xlsx or .xls file."]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!workspaceId) return;
    const valid = parsed.filter(e => !e.error);
    if (valid.length === 0) { toast.error("No valid entities to import"); return; }

    setImporting(true);
    const inserts = valid.map(e => ({
      workspace_id: workspaceId,
      name: e.name,
      type: e.type as any,
      nationality_or_jurisdiction: e.nationality_or_jurisdiction || null,
      date_of_birth_or_incorporation: e.date_of_birth_or_incorporation || null,
      email: e.email || null,
      phone: e.phone || null,
      company_type: e.company_type || null,
      registration_number: e.registration_number || null,
      registered_address: e.registered_address || null,
      primary_contact_name: e.primary_contact_name || null,
      primary_contact_email: e.primary_contact_email || null,
      notes: e.notes || null,
    }));

    const { error } = await supabase.from("entities").insert(inserts);
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      toast.success(`Successfully imported ${valid.length} entities`);
      onImported();
      handleClose();
    }
    setImporting(false);
  };

  const handleClose = () => {
    setParsed([]);
    setErrors([]);
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
    onOpenChange(false);
  };

  const validCount = parsed.filter(e => !e.error).length;
  const errorCount = parsed.filter(e => e.error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Entities from Excel</DialogTitle>
          <DialogDescription>Upload an Excel file to bulk import entities into your workspace.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <span className="text-sm text-muted-foreground">Use this template to format your data correctly.</span>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Upload your Excel file (.xlsx or .xls)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Choose File</Button>
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errors[0]}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {errorCount} errors
                </Badge>
              )}
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-60 overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge variant="outline">{e.type === "person" ? "Person" : "Company"}</Badge></TableCell>
                      <TableCell>{e.nationality_or_jurisdiction || "—"}</TableCell>
                      <TableCell>
                        {e.error ? (
                          <span className="text-xs text-destructive">{e.error}</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); setErrors([]); }}>Back</Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              {importing ? "Importing..." : `Import ${validCount} Entities`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
