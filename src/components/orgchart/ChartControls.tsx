import { Download, Eye, LayoutGrid, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface VisibilityFlags {
  capitalBadges: boolean;
  edgeLabels: boolean;
  personHoldings: boolean;
  officerCounts: boolean;
  regNumbers: boolean;
  incDates: boolean;
}

interface ChartControlsProps {
  layoutDirection: "TB" | "LR";
  onLayoutChange: (dir: "TB" | "LR") => void;
  visibility: VisibilityFlags;
  onVisibilityChange: (v: VisibilityFlags) => void;
  showMinimap: boolean;
  onMinimapToggle: () => void;
  onExportPng: () => void;
}

export function ChartControls({
  layoutDirection,
  onLayoutChange,
  visibility,
  onVisibilityChange,
  showMinimap,
  onMinimapToggle,
  onExportPng,
}: ChartControlsProps) {
  const toggle = (key: keyof VisibilityFlags) =>
    onVisibilityChange({ ...visibility, [key]: !visibility[key] });

  return (
    <div className="flex gap-1">
      {/* Layout */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="Layout direction">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={layoutDirection}
            onValueChange={(v) => onLayoutChange(v as "TB" | "LR")}
          >
            <DropdownMenuRadioItem value="TB">Top → Down</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="LR">Left → Right</DropdownMenuRadioItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuRadioItem value="radial" disabled>
                    Radial (Beta)
                  </DropdownMenuRadioItem>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Beta — works best with simple structures
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" title="Show / Hide">
            <Eye className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Show / Hide</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={visibility.capitalBadges} onCheckedChange={() => toggle("capitalBadges")}>
            Capital Badges
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={visibility.edgeLabels} onCheckedChange={() => toggle("edgeLabels")}>
            Edge Labels
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={visibility.personHoldings} onCheckedChange={() => toggle("personHoldings")}>
            Person Holdings
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={visibility.officerCounts} onCheckedChange={() => toggle("officerCounts")}>
            Officer Counts
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={visibility.regNumbers} onCheckedChange={() => toggle("regNumbers")}>
            Registration Numbers
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={visibility.incDates} onCheckedChange={() => toggle("incDates")}>
            Incorporation Dates
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Minimap toggle */}
      <Button
        variant={showMinimap ? "default" : "outline"}
        size="icon"
        onClick={onMinimapToggle}
        title="Toggle minimap"
      >
        <Map className="h-4 w-4" />
      </Button>

      {/* Export */}
      <Button variant="outline" size="icon" onClick={onExportPng} title="Export as PNG">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
