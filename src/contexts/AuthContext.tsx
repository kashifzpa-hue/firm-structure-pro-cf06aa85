import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  workspaceId: string | null;
  userRole: "admin" | "viewer" | null;
  isDemoUser: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  workspaceId: null,
  userRole: null,
  isDemoUser: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "viewer" | null>(null);

  const fetchWorkspaceAndRole = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", userId)
      .single();

    if (profile?.workspace_id) {
      setWorkspaceId(profile.workspace_id);
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("workspace_id", profile.workspace_id)
        .single();
      setUserRole((role?.role as "admin" | "viewer") || null);
    } else {
      setWorkspaceId(null);
      setUserRole(null);
    }
  };

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchWorkspaceAndRole(session.user.id).finally(() => {
          if (initialLoad) {
            initialLoad = false;
            setLoading(false);
          }
        });
      } else {
        setWorkspaceId(null);
        setUserRole(null);
        if (initialLoad) {
          initialLoad = false;
        }
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchWorkspaceAndRole(session.user.id).finally(() => {
          setLoading(false);
          initialLoad = false;
        });
      } else {
        setLoading(false);
        initialLoad = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setWorkspaceId(null);
    setUserRole(null);
  };

  const isDemoUser = session?.user?.email === "demo@corpsync.app";

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, workspaceId, userRole, isDemoUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
