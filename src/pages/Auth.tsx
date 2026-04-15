import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Auth() {
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: { full_name: signupName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (authError) {
      setLoading(false);
      toast.error(authError.message);
      return;
    }

    if (authData.user && authData.session) {
      // Check if the user has a pending invitation
      const { data: inviteResult } = await supabase.rpc("accept_invitation", {
        _email: signupEmail.toLowerCase(),
      } as any);

      if (inviteResult) {
        // User was invited — they've been auto-joined to the workspace
        setLoading(false);
        toast.success("Account created! You've been added to the workspace.");
        window.location.href = "/dashboard";
        return;
      }

      // No invitation — create a new workspace
      if (!workspaceName.trim()) {
        setLoading(false);
        toast.error("Please enter a workspace name to create a new workspace.");
        return;
      }

      const { error: wsError } = await supabase.rpc("create_workspace", { _name: workspaceName } as any);
      if (wsError) {
        setLoading(false);
        toast.error("Failed to create workspace: " + wsError.message);
        return;
      }

      setLoading(false);
      toast.success("Account created successfully!");
      window.location.href = "/dashboard";
    } else {
      setLoading(false);
      toast.success("Please check your email to confirm your account.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo-icon.png" alt="CorpSync" className="mx-auto mb-4 h-12 w-12 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">CorpSync</h1>
          <p className="mt-1 text-muted-foreground">Entity Management System</p>
        </div>

        <Card>
          <Tabs defaultValue="login">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot your password?
                    </Link>
                  </div>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" name="name" autoComplete="name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" autoComplete="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" name="new-password" type="password" autoComplete="new-password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace Name</Label>
                    <Input id="workspace-name" name="organization" placeholder="e.g., Your Law Firm Name (leave blank if invited)" autoComplete="organization" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      If you've been invited to a workspace, leave this blank. Otherwise, enter your organization's name to create a new workspace.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
