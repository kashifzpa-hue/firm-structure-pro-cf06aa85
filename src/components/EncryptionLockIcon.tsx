import { Lock, LockOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  isEncrypted: boolean;
  className?: string;
}

export function EncryptionLockIcon({ isEncrypted, className = "h-3.5 w-3.5" }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {isEncrypted ? (
            <Lock className={`${className} text-emerald-600 shrink-0`} />
          ) : (
            <LockOpen className={`${className} text-muted-foreground shrink-0`} />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isEncrypted
            ? "Encrypted with AES-256-GCM"
            : "Not encrypted — upload a new version to encrypt"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
