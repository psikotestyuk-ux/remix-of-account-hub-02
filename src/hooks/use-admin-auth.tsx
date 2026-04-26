import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AdminAuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const evaluate = async (s: Session | null) => {
    setSession(s);
    if (!s?.user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: s.user.id,
      _role: "admin",
    });
    if (error) {
      console.error("has_role check failed", error);
      setIsAdmin(false);
    } else {
      setIsAdmin(Boolean(data));
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;

    // Listener FIRST (Supabase best practice)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return;
      // Defer DB call so listener stays sync-safe
      setSession(s);
      setLoading(true);
      setTimeout(() => {
        if (!cancelled) evaluate(s);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      evaluate(s);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AdminAuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      isAdmin,
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        await evaluate(s);
      },
    }),
    [loading, session, isAdmin]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}