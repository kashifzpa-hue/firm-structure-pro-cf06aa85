import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatLimit, getAuthorityLabels } from "@/lib/banking-utils";
import { Edit, Ban } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

interface Props {
  signatory: any;
  groupLabel?: string;
  isAdmin?: boolean;
  onEdit: () => void;
  onRevoke: () => void;
}

export function SignatoryCard({ signatory, groupLabel, isAdmin = true, onEdit, onRevoke }: Props) {
  const s = signatory;
  const isRevoked = s.status === "revoked";
  const isSuspended = s.status === "suspended";
  const expiryDiff = s.expiry_date ? differenceInDays(parseISO(s.expiry_date), new Date()) : null;

  return (
    <Card className={`${isRevoked ? "opacity-60 line-through" : ""} ${isSuspended ? "border-amber-300" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            {groupLabel && <span className="text-xs font-medium text-primary">{groupLabel}</span>}
            <h4 className={`font-semibold ${isRevoked ? "line-through" : ""}`}>{s.person_name || "Unknown"}</h4>
            <p className="text-sm text-muted-foreground">{s.designation}</p>
          </div>
          <Badge variant={s.status === "active" ? "default" : s.status === "suspended" ? "secondary" : "outline"}
            className={s.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : s.status === "revoked" ? "bg-red-100 text-red-800" : ""}>
            {s.status}
          </Badge>
        </div>

        {s.signature_image_url && (
          <div className="relative inline-block border rounded overflow-hidden">
            <img src={s.signature_image_url} alt="Signature" className="h-16 grayscale" />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,128,0.18) 10px, rgba(0,0,128,0.18) 11px),
                  repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(0,0,128,0.18) 10px, rgba(0,0,128,0.18) 11px)
                `,
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              style={{
                transform: "rotate(-20deg)",
                color: "rgba(128,128,128,0.30)",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "2px",
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              CORPSYNC RECORD ONLY
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 px-1 pb-1">Reference record only — not for use as digital signature</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Individual Limit:</span> {formatLimit(s.individual_limit, s.individual_limit_currency)}</div>
          <div><span className="text-muted-foreground">Authorised For:</span> {getAuthorityLabels(s.authorised_for || []).join(", ") || "—"}</div>
          <div><span className="text-muted-foreground">Effective:</span> {s.effective_date ? format(parseISO(s.effective_date), "dd MMM yyyy") : "—"}</div>
          <div>
            <span className="text-muted-foreground">Expiry:</span>{" "}
            {s.expiry_date ? (
              <span className={expiryDiff !== null && expiryDiff < 0 ? "text-destructive font-medium" : expiryDiff !== null && expiryDiff <= 30 ? "text-amber-600 font-medium" : ""}>
                {format(parseISO(s.expiry_date), "dd MMM yyyy")}
              </span>
            ) : "No expiry"}
          </div>
          {s.board_resolution_ref && <div><span className="text-muted-foreground">Board Resolution:</span> {s.board_resolution_ref}</div>}
          <div><span className="text-muted-foreground">Bank Acknowledged:</span> {s.bank_acknowledged_date ? format(parseISO(s.bank_acknowledged_date), "dd MMM yyyy") : "⏳ Pending"}</div>
        </div>

        {!isRevoked && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={onEdit}><Edit className="h-3 w-3 mr-1" /> Edit</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={onRevoke}><Ban className="h-3 w-3 mr-1" /> Revoke</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
