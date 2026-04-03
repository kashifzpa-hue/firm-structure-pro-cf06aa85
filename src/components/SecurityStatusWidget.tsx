import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function SecurityStatusWidget() {
  const { workspaceId } = useAuth();
  const navigate = useNavigate();
  const [encrypted, setEncrypted] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("documents")
        .select("is_encrypted")
        .eq("workspace_id", workspaceId);
      const docs = data || [];
      setTotal(docs.length);
      setEncrypted(docs.filter(d => d.is_encrypted).length);
      setLoading(false);
    };
    fetch();
  }, [workspaceId]);

  if (loading) return null;

  const unencrypted = total - encrypted;
  const allEncrypted = unencrypted === 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Security Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Document encryption active</span>
        </div>
        {allEncrypted ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>All {total} documents encrypted</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{unencrypted} unencrypted document{unencrypted !== 1 ? "s" : ""}</span>
            <button
              className="text-primary text-xs underline ml-1"
              onClick={() => navigate("/settings")}
            >
              Encrypt now →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
