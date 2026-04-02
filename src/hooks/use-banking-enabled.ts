import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useBankingEnabled() {
  const { workspaceId } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from("workspaces")
      .select("banking_enabled")
      .eq("id", workspaceId)
      .single()
      .then(({ data }) => {
        setEnabled(!!(data as any)?.banking_enabled);
        setLoading(false);
      });
  }, [workspaceId]);

  return { bankingEnabled: enabled, loading };
}
