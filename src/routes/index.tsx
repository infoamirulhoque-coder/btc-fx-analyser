import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { SignalDashboard } from "@/components/SignalDashboard";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BTC-FX-Analyser — Pro BTC Forex Signal Bot" },
      { name: "description", content: "Live BTC/USDT trading signals with entry, SL, TP. Powered by Binance API and pro-grade confluence strategy." },
    ],
  }),
});

function Index() {
  return (
    <AuthGate>
      {({ isAdmin, email }) => (
        <div className="relative">
          <div className="absolute top-3 right-3 z-50 flex gap-2">
            {isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 flex items-center gap-1 backdrop-blur">
                <Shield className="w-3 h-3" /> Admin
              </Link>
            )}
            <button onClick={() => supabase.auth.signOut()}
              className="px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-accent text-xs font-medium flex items-center gap-1 backdrop-blur"
              title={email}>
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
          <SignalDashboard />
        </div>
      )}
    </AuthGate>
  );
}
