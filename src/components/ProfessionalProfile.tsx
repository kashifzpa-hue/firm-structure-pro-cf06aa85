import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Loader2, X, Linkedin } from "lucide-react";
import { toast } from "sonner";

const LANGUAGE_SUGGESTIONS = [
  "Arabic", "English", "French", "Hindi", "Urdu",
  "Tagalog", "Malayalam", "Mandarin", "Russian", "Spanish",
  "Portuguese", "German", "Japanese", "Korean", "Italian",
];

interface PreviousPosition {
  id?: string;
  company_name: string;
  role_title: string;
  from_date: string;
  to_date: string;
  is_current: boolean;
  notes: string;
  display_order: number;
}

interface ProfessionalProfileProps {
  entityId: string;
  entity: any;
  onUpdated: () => void;
}

export function ProfessionalProfile({ entityId, entity, onUpdated }: ProfessionalProfileProps) {
  const { workspaceId } = useAuth();
  const [bio, setBio] = useState(entity?.professional_bio || "");
  const [qualifications, setQualifications] = useState(entity?.qualifications || "");
  const [languages, setLanguages] = useState<string[]>(entity?.languages_spoken || []);
  const [langInput, setLangInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [positions, setPositions] = useState<PreviousPosition[]>([]);
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBio(entity?.professional_bio || "");
    setQualifications(entity?.qualifications || "");
    setLanguages(entity?.languages_spoken || []);
  }, [entity]);

  useEffect(() => {
    if (!entityId || !workspaceId) return;
    const fetchPositions = async () => {
      const { data } = await supabase
        .from("previous_positions")
        .select("*")
        .eq("entity_id", entityId)
        .eq("workspace_id", workspaceId)
        .order("display_order")
        .order("from_date", { ascending: false });
      setPositions((data || []).map((p: any) => ({
        id: p.id,
        company_name: p.company_name,
        role_title: p.role_title,
        from_date: p.from_date || "",
        to_date: p.to_date || "",
        is_current: p.is_current,
        notes: p.notes || "",
        display_order: p.display_order,
      })));
      setLoading(false);
    };
    fetchPositions();
  }, [entityId, workspaceId]);

  const addLanguage = (lang: string) => {
    const trimmed = lang.trim();
    if (trimmed && !languages.includes(trimmed)) {
      setLanguages([...languages, trimmed]);
    }
    setLangInput("");
    setShowSuggestions(false);
  };

  const removeLanguage = (lang: string) => setLanguages(languages.filter(l => l !== lang));

  const addPosition = () => {
    setPositions([...positions, {
      company_name: "",
      role_title: "",
      from_date: "",
      to_date: "",
      is_current: false,
      notes: "",
      display_order: positions.length,
    }]);
  };

  const updatePosition = (i: number, field: keyof PreviousPosition, value: any) => {
    const updated = [...positions];
    (updated[i] as any)[field] = value;
    if (field === "is_current" && value) {
      updated[i].to_date = "";
    }
    setPositions(updated);
  };

  const removePosition = (i: number) => setPositions(positions.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);

    try {
      // Update entity fields
      const { error: entityError } = await supabase
        .from("entities")
        .update({
          professional_bio: bio || null,
          qualifications: qualifications || null,
          languages_spoken: languages.length > 0 ? languages : null,
        } as any)
        .eq("id", entityId);

      if (entityError) throw entityError;

      // Sync positions: delete existing and re-insert
      await supabase
        .from("previous_positions")
        .delete()
        .eq("entity_id", entityId)
        .eq("workspace_id", workspaceId);

      const validPositions = positions.filter(p => p.company_name.trim() && p.role_title.trim());
      if (validPositions.length > 0) {
        const { error: posError } = await supabase
          .from("previous_positions")
          .insert(validPositions.map((p, i) => ({
            workspace_id: workspaceId,
            entity_id: entityId,
            company_name: p.company_name,
            role_title: p.role_title,
            from_date: p.from_date || null,
            to_date: p.is_current ? null : (p.to_date || null),
            is_current: p.is_current,
            notes: p.notes || null,
            display_order: i,
          })));
        if (posError) throw posError;
      }

      toast.success("Professional profile saved");
      onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filteredSuggestions = LANGUAGE_SUGGESTIONS.filter(
    l => l.toLowerCase().includes(langInput.toLowerCase()) && !languages.includes(l)
  );

  const visiblePositions = showAllPositions ? positions : positions.slice(0, 5);

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading professional profile...</div>;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Professional Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bio */}
        <div className="space-y-2">
          <Label>Professional Background</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 1000))}
            placeholder="Brief overview of professional background, expertise, and current focus areas."
            rows={4}
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length} / 1000</p>
        </div>

        {/* Qualifications */}
        <div className="space-y-2">
          <Label>Qualifications & Certifications</Label>
          <Input
            value={qualifications}
            onChange={(e) => setQualifications(e.target.value)}
            placeholder="e.g. CFA, MBA (INSEAD), LLB (University of London)"
          />
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <Label>Languages</Label>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {languages.map(l => (
                <Badge key={l} variant="secondary" className="gap-1 pr-1">
                  {l}
                  <button type="button" onClick={() => removeLanguage(l)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative">
            <Input
              value={langInput}
              onChange={(e) => { setLangInput(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addLanguage(langInput); }
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Type a language and press Enter"
            />
            {showSuggestions && langInput && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-md max-h-40 overflow-y-auto">
                {filteredSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); addLanguage(s); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Career History */}
        <div className="space-y-3">
          <Label>Career History</Label>
          {visiblePositions.map((pos, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Position {i + 1}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePosition(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Company Name</Label>
                  <Input value={pos.company_name} onChange={(e) => updatePosition(i, "company_name", e.target.value)} placeholder="Company name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role Title</Label>
                  <Input value={pos.role_title} onChange={(e) => updatePosition(i, "role_title", e.target.value)} placeholder="Role title" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={pos.from_date} onChange={(e) => updatePosition(i, "from_date", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={pos.to_date} onChange={(e) => updatePosition(i, "to_date", e.target.value)} disabled={pos.is_current} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={pos.is_current}
                  onCheckedChange={(v) => updatePosition(i, "is_current", !!v)}
                  id={`current-${i}`}
                />
                <label htmlFor={`current-${i}`} className="text-xs text-muted-foreground cursor-pointer">Current position</label>
              </div>
            </div>
          ))}

          {positions.length > 5 && !showAllPositions && (
            <Button type="button" variant="link" size="sm" onClick={() => setShowAllPositions(true)}>
              Show {positions.length - 5} more...
            </Button>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addPosition}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Position
          </Button>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Professional Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
