import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BankRow {
  id: string;
  name: string;
  short_code: string | null;
  country: string;
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

export function useBanks(includeInactive = false) {
  const { workspaceId } = useAuth();

  const query = useQuery({
    queryKey: ["banks", workspaceId, includeInactive],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase
        .from("banks" as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BankRow[];
    },
  });

  const names = (query.data || []).map(b => b.name);
  return { ...query, banks: query.data || [], bankNames: [...names, "Other"] };
}
