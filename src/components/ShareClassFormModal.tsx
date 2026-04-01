import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { currencies } from "@/lib/currencies";

const classNamePresets = [
  "Ordinary Shares",
  "Class A Shares",
  "Class B Shares",
  "Preference Shares",
  "Redeemable Preference Shares",
  "Founders Shares",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClass: any;
  companyEntityId: string;
  workspaceId: string;
  onSaved: () => void;
}

export function ShareClassFormModal({ open, onOpenChange, editingClass, companyEntityId, workspaceId, onSaved }: Props) {
  const [className, setClassName] = useState("");
  const [classNamePreset, setClassNamePreset] = useState("");
  const [totalShares, setTotalShares] = useState("");
  const [parValue, setParValue] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [customCurrency, setCustomCurrency] = useState("");
  const [votingRights, setVotingRights] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingClass) {
      const isPreset = classNamePresets.includes(editingClass.class_name);
      setClassNamePreset(isPreset ? editingClass.class_name : "Other");
      setClassName(isPreset ? "" : editingClass.class_name);
      setTotalShares(String(editingClass.total_shares_issued));
      setParValue(String(editingClass.par_value_per_share));
      const known = currencies.find(c => c.code === editingClass.currency);
      setCurrency(known ? editingClass.currency : "Other");
      setCustomCurrency(known ? "" : editingClass.currency);
      setVotingRights(editingClass.voting_rights);
      setNotes(editingClass.notes || "");
    } else {
      setClassNamePreset("");
      setClassName("");
      setTotalShares("");
      setParValue("");
      setCurrency("AED");
      setCustomCurrency("");
      setVotingRights(true);
      setNotes("");
    }
  }, [editingClass, open]);

  const resolvedName = classNamePreset === "Other" ? className : classNamePreset;
  const resolvedCurrency = currency === "Other" ? customCurrency.toUpperCase() : currency;
  const totalSharesNum = Number(totalShares) || 0;
  const parValueNum = Number(parValue) || 0;
  const totalCapital = totalSharesNum * parValueNum;

  const handleSave = async () => {
    if (!resolvedName) { toast.error("Please enter a class name"); return; }
    if (totalSharesNum < 1) { toast.error("Total shares must be at least 1"); return; }
    if (parValueNum <= 0) { toast.error("Par value must be greater than 0"); return; }
    if (!resolvedCurrency || resolvedCurrency.length < 3) { toast.error("Please select or enter a valid currency"); return; }

    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      company_entity_id: companyEntityId,
      class_name: resolvedName,
      total_shares_issued: totalSharesNum,
      par_value_per_share: parValueNum,
      currency: resolvedCurrency,
      voting_rights: votingRights,
      notes: notes || null,
    };

    let error;
    if (editingClass) {
      ({ error } = await supabase.from("share_classes").update(payload).eq("id", editingClass.id));
    } else {
      ({ error } = await supabase.from("share_classes").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingClass ? "Share class updated" : "Share class created");
    onOpenChange(false);
    onSaved();
  };

  const currencySymbol = currencies.find(c => c.code === resolvedCurrency)?.code || resolvedCurrency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingClass ? "Edit Share Class" : "Add Share Class"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Class Name *</Label>
            <Select value={classNamePreset} onValueChange={(v) => { setClassNamePreset(v); if (v !== "Other") setClassName(""); }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select or choose Other..." /></SelectTrigger>
              <SelectContent>
                {classNamePresets.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                <SelectItem value="Other">Other (custom)</SelectItem>
              </SelectContent>
            </Select>
            {classNamePreset === "Other" && (
              <Input value={className} onChange={e => setClassName(e.target.value)} placeholder="Enter class name" className="mt-2" />
            )}
          </div>

          <div>
            <Label>Total Shares Issued *</Label>
            <Input type="number" min="1" step="1" value={totalShares} onChange={e => setTotalShares(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">This is the total number of shares of this class that the company has issued. Example: 1,000</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Par Value per Share *</Label>
              <Input type="number" min="0" step="0.0001" value={parValue} onChange={e => setParValue(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">The nominal/face value of each share. Example: 1.00</p>
            </div>
            <div>
              <Label>Currency *</Label>
              <Select value={currency} onValueChange={v => { setCurrency(v); if (v !== "Other") setCustomCurrency(""); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</SelectItem>)}
                  <SelectItem value="Other">Other (ISO code)</SelectItem>
                </SelectContent>
              </Select>
              {currency === "Other" && (
                <Input value={customCurrency} onChange={e => setCustomCurrency(e.target.value)} placeholder="e.g. HKD" maxLength={3} className="mt-2" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={votingRights} onCheckedChange={setVotingRights} />
            <div>
              <Label>Voting Rights</Label>
              <p className="text-xs text-muted-foreground">Does each share of this class carry a voting right?</p>
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" rows={2} />
          </div>

          {totalSharesNum > 0 && parValueNum > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-sm font-medium text-muted-foreground">Total Issued Capital</p>
                <p className="text-lg font-bold">
                  {totalSharesNum.toLocaleString()} shares × {currencySymbol} {parValueNum.toFixed(4)} = {currencySymbol} {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground italic">Par value is the nominal face value for legal purposes. It does not represent market value.</p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
