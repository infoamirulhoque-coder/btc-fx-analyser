import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield } from "lucide-react";

const PIN = "909098";
const STORAGE_KEY = "btcfx_unlocked_v1";

export function PinLock({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  const handleDigit = (d: string) => {
    setError(false);
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) {
      setTimeout(() => {
        if (next === PIN) {
          sessionStorage.setItem(STORAGE_KEY, "1");
          setUnlocked(true);
        } else {
          setError(true);
          setPin("");
        }
      }, 150);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm bg-card/80 backdrop-blur-xl rounded-2xl p-8 border border-border neon-border"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 glow-pulse"
          >
            <Shield className="w-8 h-8 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold glow-text">BTC-FX-Analyser</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter PIN to access</p>
        </div>

        <motion.div
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          className="flex justify-center gap-2 mb-6"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                pin.length > i ? "bg-primary scale-110" : "bg-muted"
              } ${error ? "bg-destructive" : ""}`}
            />
          ))}
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
            <button
              key={i}
              onClick={() => {
                if (k === "⌫") setPin(pin.slice(0, -1));
                else if (k) handleDigit(k);
              }}
              disabled={!k}
              className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k ? "bg-secondary hover:bg-accent hover:text-accent-foreground" : "invisible"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-destructive text-sm mt-4"
            >
              Incorrect PIN
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" /> Secured by BTC-FX-Analyser
        </div>
      </motion.div>
    </div>
  );
}
