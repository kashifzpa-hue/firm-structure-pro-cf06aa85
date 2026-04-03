import { getAvatarColor, getInitials } from "@/lib/entity-avatar";
import { cn } from "@/lib/utils";

interface EntityAvatarProps {
  entityId: string;
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  inactive?: boolean;
}

const SIZE_MAP = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-20 h-20 text-xl",
  xl: "w-[120px] h-[120px] text-3xl",
};

export function EntityAvatar({ entityId, name, photoUrl, size = "md", className, inactive }: EntityAvatarProps) {
  const sizeClass = SIZE_MAP[size];
  const initials = getInitials(name);
  const bgColor = getAvatarColor(entityId);

  return (
    <div className={cn("relative rounded-full overflow-hidden flex-shrink-0", sizeClass, className)}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials on error
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <div
        className={cn(
          "w-full h-full flex items-center justify-center font-semibold text-white",
          photoUrl ? "hidden" : ""
        )}
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </div>
      {inactive && (
        <div className="absolute inset-0 bg-muted-foreground/40 flex items-center justify-center">
          <span className="text-[8px] font-bold text-white bg-muted-foreground/80 px-1 rounded">INACTIVE</span>
        </div>
      )}
    </div>
  );
}
