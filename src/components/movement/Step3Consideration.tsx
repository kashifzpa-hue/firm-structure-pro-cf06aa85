import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { currencies } from "@/lib/currencies";
import { useState } from "react";

interface Step3Props {
  data: any;
  onChange: (updates: any) => void;
}

export function Step3Consideration({ data, onChange }: Step3Props) {
  const [showConsideration, setShowConsideration] = useState(!!(data.price_per_share || data.total_consideration));

  const handleToggle = (v: boolean) => {
    setShowConsideration(v);
    if (!v) onChange({ price_per_share: null, currency: null, total_consideration: null });
  };

  const handlePriceChange = (price: number) => {
    const total = price * (data.shares_transferred || 0);
    onChange({ price_per_share: price, total_consideration: total });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Switch checked={showConsideration} onCheckedChange={handleToggle} />
        <Label>Include consideration details</Label>
      </div>

      {showConsideration && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={data.currency || "AED"} onValueChange={v => onChange({ currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price per Share</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={data.price_per_share || ""}
                onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Total Consideration</Label>
              <Input
                type="number"
                step="0.01"
                value={data.total_consideration || ""}
                onChange={e => onChange({ total_consideration: parseFloat(e.target.value) || 0 })}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
