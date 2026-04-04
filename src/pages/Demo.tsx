import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, LogIn, AlertTriangle } from "lucide-react";

const DEMO_EMAIL = "demo@corpsync.app";
const DEMO_PASS = "CorpSync-Demo-2026";

export default function Demo() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "conflict" | "logging-in" | "error">("loading");
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email === DEMO_EMAIL) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (session?.user) {
      setConflictEmail(session.user.email ?? "unknown");
      setStatus("conflict");
      return;
    }
    setStatus("ready");
  };

  const loginAsDemo = async () => {
    setStatus("logging-in");
    setError(null);
    try {
      // Sign out first if there's an existing session
      await supabase.auth.signOut();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASS,
      });

      if (signInError) {
        setError(signInError.message);
        setStatus("ready");
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message);
      setStatus("ready");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            CS
          </div>
          <CardTitle className="text-2xl">CorpSync Demo</CardTitle>
          <CardDescription className="text-sm">
            Explore the platform with sample corporate structure data. Read-only access — no changes can be made.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "conflict" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">
                  You are currently logged in as <strong>{conflictEmail}</strong>. Continuing to the demo will sign you out of your account.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="flex-1">
                  Cancel
                </Button>
                <Button size="sm" onClick={loginAsDemo} className="flex-1">
                  Continue to Demo
                </Button>
              </div>
            </div>
          )}

          {status === "ready" && (
            <Button onClick={loginAsDemo} className="w-full gap-2" size="lg">
              <Eye className="h-5 w-5" />
              Explore Demo
            </Button>
          )}

          {status === "logging-in" && (
            <Button disabled className="w-full gap-2" size="lg">
              <LogIn className="h-5 w-5 animate-spin" />
              Signing in...
            </Button>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <p className="text-xs text-muted-foreground text-center pt-2">
            Demo uses a shared read-only account. No registration required.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
