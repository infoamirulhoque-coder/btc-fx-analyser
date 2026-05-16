import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { Shield, Lock, Loader2, Ban, CheckCircle2, Crown, Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/profile.functions";
import { listUsers, setBlocked, setAdmin, deleteUser } from "@/lib/admin.functions";

const ADMIN_PIN = "808090";
const PIN_KEY = "btcfx_admin_pin_v1";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin Panel — BTC-FX-Analyser" }] }),
});

function AdminPage() {
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getMyAccess);
  const fetchUsers = useServerFn(listUsers);
  const block = useServerFn(setBlocked);
  const promote = useServerFn(setAdmin);
  const remove = useServerFn(deleteUser);

  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(PIN_KEY) === "1") setPinOk(true);
  }, []);

  useEffect(() => {
    if (!pinOk) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate({ to: "/auth" }); return; }
      try {
        const a = await fetchAccess();
        if (!a.isAdmin) { setAuthState("denied"); return; }
        setAuthState("ok");
        await reload();
      } catch { setAuthState("denied"); }
    })();
  }, [pinOk]);

  const reload = async () => {
    const u = await fetchUsers();
    setUsers(u as any[]);
  };

  const onDigit = (d: string) => {
    setPinErr(false);
    if (pin.length >= 6) return;
    const n = pin + d;
    setPin(n);
    if (n.length === 6) {
      setTimeout(() => {
        if (n === ADMIN_PIN) { sessionStorage.setItem(PIN_KEY, "1"); setPinOk(true); }
        else { setPinErr(true); setPin(""); }
      }, 120);
    }
  };

  if (!pinOk) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-card/80 backdrop-blur-xl rounded-2xl p-8 border border-border neon-border">
          <div className="flex flex-col items-center text-center mb-6">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-destructive to-accent flex items-center justify-center mb-4 glow-pulse">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </motion.div>
            <h1 className="text-2xl font-bold glow-text">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter Admin PIN</p>
          </div>
          <motion.div animate={pinErr ? { x: [-10, 10, -10, 10, 0] } : {}} className="flex justify-center gap-2 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all ${pin.length > i ? "bg-primary scale-110" : "bg-muted"} ${pinErr ? "bg-destructive" : ""}`} />
            ))}
          </motion.div>
          <div className="grid grid-cols-3 gap-3">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
              <button key={i} onClick={() => { if (k === "⌫") setPin(pin.slice(0,-1)); else if (k) onDigit(k); }}
                disabled={!k}
                className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${k ? "bg-secondary hover:bg-accent" : "invisible"}`}>
                {k}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {pinErr && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center text-destructive text-sm mt-4">Incorrect PIN</motion.p>}
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" /> Admin secured
          </div>
          <Link to="/" className="block text-center text-xs text-muted-foreground mt-3 hover:text-foreground">← Back</Link>
        </motion.div>
      </div>
    );
  }

  if (authState === "loading") {
    return <div className="min-h-screen flex items-center justify-center grid-bg"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (authState === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
        <div className="max-w-md w-full bg-card/80 rounded-2xl p-8 text-center border border-destructive/40">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">Your account is not an administrator.</p>
          <Link to="/" className="inline-block px-4 py-2 rounded-lg bg-secondary hover:bg-accent">Return Home</Link>
        </div>
      </div>
    );
  }

  const action = async (id: string, fn: () => Promise<any>) => {
    setBusy(id); try { await fn(); await reload(); } catch (e: any) { alert(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="min-h-screen grid-bg p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-lg bg-secondary hover:bg-accent"><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold glow-text">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Manage user access</p>
            </div>
          </div>
          <button onClick={reload} className="px-3 py-2 rounded-lg bg-secondary hover:bg-accent flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Stat label="Total Users" value={users.length} />
          <Stat label="Blocked" value={users.filter((u) => u.is_blocked).length} />
          <Stat label="Admins" value={users.filter((u) => u.roles?.includes("admin")).length} />
        </div>

        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {users.map((u) => {
                    const isAdmin = u.roles?.includes("admin");
                    return (
                      <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="border-t border-border/60 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.display_name || u.email.split("@")[0]}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs flex items-center gap-1 w-fit"><Crown className="w-3 h-3" />Admin</span>
                            : <span className="text-xs text-muted-foreground">User</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u.is_blocked
                            ? <span className="px-2 py-1 rounded bg-destructive/20 text-destructive text-xs">Blocked</span>
                            : <span className="px-2 py-1 rounded bg-bull/20 text-bull text-xs">Active</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button disabled={busy === u.id}
                              onClick={() => action(u.id, () => block({ data: { userId: u.id, blocked: !u.is_blocked } }))}
                              className={`p-2 rounded-lg text-xs ${u.is_blocked ? "bg-bull/20 text-bull hover:bg-bull/30" : "bg-destructive/20 text-destructive hover:bg-destructive/30"}`}
                              title={u.is_blocked ? "Unblock" : "Block"}>
                              {u.is_blocked ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </button>
                            <button disabled={busy === u.id}
                              onClick={() => action(u.id, () => promote({ data: { userId: u.id, admin: !isAdmin } }))}
                              className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs"
                              title={isAdmin ? "Demote" : "Promote to admin"}>
                              <Crown className="w-4 h-4" />
                            </button>
                            <button disabled={busy === u.id}
                              onClick={() => { if (confirm(`Delete ${u.email}?`)) action(u.id, () => remove({ data: { userId: u.id } })); }}
                              className="p-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 text-xs"
                              title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {users.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <motion.div whileHover={{ y: -2 }} className="bg-card/60 backdrop-blur-xl rounded-xl p-4 border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold glow-text">{value}</div>
    </motion.div>
  );
}
