import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyAccess } from "@/lib/profile.functions";

export function AuthGate({ children }: { children: (ctx: { isAdmin: boolean; email: string }) => React.ReactNode }) {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
  const [state, setState] = useState<"loading" | "blocked" | "ok">("loading");
  const [access, setAccess] = useState<{ isAdmin: boolean; email: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate({ to: "/auth" }); return; }
      try {
        const a = await fetchAccess();
        if (!alive) return;
        if (a.isBlocked) { setState("blocked"); return; }
        setAccess({ isAdmin: a.isAdmin, email: a.profile?.email ?? data.session.user.email ?? "" });
        setState("ok");
      } catch {
        if (alive) navigate({ to: "/auth" });
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [navigate, fetchAccess]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "blocked") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-card/80 backdrop-blur-xl rounded-2xl p-8 border border-destructive/40 text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Blocked</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your account has been blocked by the administrator. Contact support for access.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-accent transition inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </motion.div>
      </div>
    );
  }
  return <>{children(access!)}</>;
}
