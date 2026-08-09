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
// Loaded on demand: the spreadsheet library is ~400 kB and only needed for import/template.
const loadXLSX = () => import("xlsx");


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

interface ParsedShareClass {
  company_name: string;
  class_name: string;
  total_shares_issued: number;
  par_value_per_share: number;
  currency: string;
  voting_rights: boolean;
  notes?: string;
  error?: string;
}

const ENTITY_COLUMNS = [
  "Name*", "Type* (person/company)", "Nationality / Jurisdiction", "Date of Birth / Incorporation (YYYY-MM-DD)",
  "Email", "Phone", "Company Type", "Registration Number", "Registered Address",
  "Primary Contact Name", "Primary Contact Email", "Notes",
];

const SHARE_CLASS_COLUMNS = [
  "Company Name*", "Class Name*", "Total Shares Issued*", "Par Value Per Share*",
  "Currency (ISO)", "Voting Rights (Yes/No)", "Notes",
];

export function EntityImportModal({ open, onOpenChange, onImported }: Props) {
  const { workspaceId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedEntity[]>([]);
  const [parsedShareClasses, setParsedShareClasses] = useState<ParsedShareClass[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleDownloadTemplate = async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();


    const ws1 = XLSX.utils.aoa_to_sheet([
      ENTITY_COLUMNS,
      ["John Doe", "person", "United Arab Emirates", "1990-05-15", "john@example.com", "+971501234567", "", "", "", "", "", "Sample person"],
      ["Gulf Holdings LLC", "company", "United Arab Emirates", "2015-03-01", "", "", "LLC", "123456", "Dubai, UAE", "Ahmed Ali", "ahmed@gulf.com", "Sample company"],
    ]);
    ws1["!cols"] = ENTITY_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws1, "Entities");

    const ws2 = XLSX.utils.aoa_to_sheet([
      SHARE_CLASS_COLUMNS,
      ["Gulf Holdings LLC", "Ordinary Shares", "1000", "1.00", "AED", "Yes", ""],
      ["Gulf Holdings LLC", "Preference Shares", "500", "10.00", "AED", "No", "Non-voting preference"],
    ]);
    ws2["!cols"] = SHARE_CLASS_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Share Classes");

    XLSX.writeFile(wb, "CorpSync_Entity_Template.xlsx");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const rowErrors: string[] = [];

        // Parse Entities sheet
        const entitiesSheet = wb.Sheets[wb.SheetNames[0]];
        const entRows: any[][] = XLSX.utils.sheet_to_json(entitiesSheet, { header: 1 });
        const entities: ParsedEntity[] = [];

        if (entRows.length < 2) {
          setErrors(["Entities sheet is empty or has no data rows."]);
          return;
        }

        const dataRows = entRows.slice(1).filter(r => r.some(c => c != null && String(c).trim()));
        dataRows.forEach((row, idx) => {
          const get = (colIdx: number) => row[colIdx] != null ? String(row[colIdx]).trim() : "";
          const name = get(0);
          const typeRaw = get(1).toLowerCase();

          if (!name) { rowErrors.push(`Entities Row ${idx + 2}: Name is required`); return; }
          if (typeRaw !== "person" && typeRaw !== "company") {
            rowErrors.push(`Entities Row ${idx + 2}: Type must be "person" or "company", got "${get(1)}"`);
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

          if (entity.date_of_birth_or_incorporation && !/^\d{4}-\d{2}-\d{2}$/.test(entity.date_of_birth_or_incorporation)) {
            entity.error = "Invalid date format (use YYYY-MM-DD)";
          }

          entities.push(entity);
        });

        // Parse Share Classes sheet (if present)
        const shareClasses: ParsedShareClass[] = [];
        const scSheetName = wb.SheetNames.find(n => n.toLowerCase().includes("share"));
        if (scSheetName) {
          const scSheet = wb.Sheets[scSheetName];
          const scRows: any[][] = XLSX.utils.sheet_to_json(scSheet, { header: 1 });
          const scDataRows = scRows.slice(1).filter(r => r.some(c => c != null && String(c).trim()));

          scDataRows.forEach((row, idx) => {
            const get = (colIdx: number) => row[colIdx] != null ? String(row[colIdx]).trim() : "";
            const companyName = get(0);
            const className = get(1);
            const totalShares = parseInt(get(2));
            const parValue = parseFloat(get(3));

            if (!companyName) { rowErrors.push(`Share Classes Row ${idx + 2}: Company Name is required`); return; }
            if (!className) { rowErrors.push(`Share Classes Row ${idx + 2}: Class Name is required`); return; }

            const sc: ParsedShareClass = {
              company_name: companyName,
              class_name: className,
              total_shares_issued: isNaN(totalShares) ? 0 : totalShares,
              par_value_per_share: isNaN(parValue) ? 0 : parValue,
              currency: get(4) || "AED",
              voting_rights: get(5).toLowerCase() !== "no",
              notes: get(6) || undefined,
            };

            if (sc.total_shares_issued <= 0) sc.error = "Total shares must be > 0";
            if (sc.par_value_per_share < 0) sc.error = "Par value cannot be negative";

            shareClasses.push(sc);
          });
        }

        setParsed(entities);
        setParsedShareClasses(shareClasses);
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
    const validEntities = parsed.filter(e => !e.error);
    if (validEntities.length === 0) { toast.error("No valid entities to import"); return; }

    setImporting(true);

    // Insert entities
    const inserts = validEntities.map(e => ({
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

    const { data: insertedEntities, error } = await supabase.from("entities").insert(inserts).select("id, name");
    if (error) {
      toast.error("Import failed: " + error.message);
      setImporting(false);
      return;
    }

    // Insert share classes if any
    const validSC = parsedShareClasses.filter(sc => !sc.error);
    let scCount = 0;
    if (validSC.length > 0 && insertedEntities) {
      // Also fetch existing entities to map company names
      const { data: allEntities } = await supabase
        .from("entities")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .eq("type", "company" as any);

      const nameToId = new Map((allEntities || []).map(e => [e.name.toLowerCase(), e.id]));

      const scInserts = validSC
        .map(sc => {
          const companyId = nameToId.get(sc.company_name.toLowerCase());
          if (!companyId) return null;
          return {
            workspace_id: workspaceId,
            company_entity_id: companyId,
            class_name: sc.class_name,
            total_shares_issued: sc.total_shares_issued,
            par_value_per_share: sc.par_value_per_share,
            currency: sc.currency,
            voting_rights: sc.voting_rights,
            notes: sc.notes || null,
          };
        })
        .filter(Boolean);

      if (scInserts.length > 0) {
        const { error: scError } = await supabase.from("share_classes").insert(scInserts as any);
        if (scError) {
          toast.warning("Entities imported but share classes failed: " + scError.message);
        } else {
          scCount = scInserts.length;
        }
      }
    }

    const msg = scCount > 0
      ? `Imported ${validEntities.length} entities and ${scCount} share classes`
      : `Imported ${validEntities.length} entities`;
    toast.success(msg);
    onImported();
    handleClose();
    setImporting(false);
  };

  const handleClose = () => {
    setParsed([]);
    setParsedShareClasses([]);
    setErrors([]);
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
    onOpenChange(false);
  };

  const validCount = parsed.filter(e => !e.error).length;
  const errorCount = parsed.filter(e => e.error).length;
  const validSCCount = parsedShareClasses.filter(sc => !sc.error).length;
  const errorSCCount = parsedShareClasses.filter(sc => sc.error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Entities from Excel</DialogTitle>
          <DialogDescription>Upload an Excel file to bulk import entities and share classes into your workspace.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <span className="text-sm text-muted-foreground">Template includes Entities and Share Classes sheets.</span>
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
            <div className="flex gap-3 flex-wrap">
              <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} entities valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {errorCount} entity errors
                </Badge>
              )}
              {parsedShareClasses.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {validSCCount} share classes
                </Badge>
              )}
              {errorSCCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" /> {errorSCCount} share class errors
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

            <p className="text-sm font-medium text-muted-foreground">Entities</p>
            <div className="max-h-48 overflow-y-auto rounded border">
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

            {parsedShareClasses.length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground">Share Classes</p>
                <div className="max-h-48 overflow-y-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Shares</TableHead>
                        <TableHead>Par Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedShareClasses.map((sc, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{sc.company_name}</TableCell>
                          <TableCell>{sc.class_name}</TableCell>
                          <TableCell>{sc.total_shares_issued.toLocaleString()}</TableCell>
                          <TableCell>{sc.currency} {sc.par_value_per_share}</TableCell>
                          <TableCell>
                            {sc.error ? (
                              <span className="text-xs text-destructive">{sc.error}</span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); setParsedShareClasses([]); setErrors([]); }}>Back</Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              {importing ? "Importing..." : `Import ${validCount} Entities${validSCCount > 0 ? ` + ${validSCCount} Share Classes` : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
