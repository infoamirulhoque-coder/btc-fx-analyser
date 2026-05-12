import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Target, Shield, Clock, Zap, BarChart3, RefreshCw, Sparkles, Wifi, WifiOff } from "lucide-react";
import { fetch24h, fetchKlines, fetchPrice } from "@/lib/binance";
import { generateSignal, type Candle, type Signal } from "@/lib/signal-engine";
import { PriceChart } from "./PriceChart";

const TIMEFRAMES = [
  { label: "5M", v: "5m", htf: "1h" },
  { label: "15M", v: "15m", htf: "4h" },
  { label: "1H", v: "1h", htf: "4h" },
  { label: "4H", v: "4h", htf: "1d" },
];

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function SignalDashboard() {
  const [tfIdx, setTfIdx] = useState(1);
  const tf = TIMEFRAMES[tfIdx];
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [htfCandles, setHtfCandles] = useState<Candle[]>([]);
  const [stats, setStats] = useState<{ change: number; changePercent: number; high: number; low: number; volume: number } | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const signalRef = useRef<Signal | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => { signalRef.current = signal; }, [signal]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load candles + HTF when timeframe changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSignal(null);
    signalRef.current = null;
    (async () => {
      try {
        const [k, htf, p, s] = await Promise.all([
          fetchKlines("BTCUSDT", tf.v, 200),
          fetchKlines("BTCUSDT", tf.htf, 200),
          fetchPrice(),
          fetch24h(),
        ]);
        if (cancelled) return;
        setCandles(k); setHtfCandles(htf); setPrice(p); setStats(s);
        setSignal(generateSignal(k, htf, p, null));
        setOnline(true);
      } catch (e) { console.error(e); setOnline(false); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tf.v, tf.htf]);

  // Live price polling every 3s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const p = await fetchPrice();
        setPrevPrice((prev) => (price !== null ? price : prev));
        setPrice(p);
        setOnline(true);
      } catch { setOnline(false); }
    }, 3000);
    return () => clearInterval(t);
  }, [price]);

  // Refresh signal every 45s with stability (passes prev signal)
  useEffect(() => {
    if (candles.length === 0) return;
    const t = setInterval(async () => {
      try {
        const [k, htf, p, s24] = await Promise.all([
          fetchKlines("BTCUSDT", tf.v, 200),
          fetchKlines("BTCUSDT", tf.htf, 200),
          fetchPrice(),
          fetch24h(),
        ]);
        setCandles(k); setHtfCandles(htf); setStats(s24);
        setPrevPrice(price); setPrice(p);
        setSignal(generateSignal(k, htf, p, signalRef.current));
        setOnline(true);
      } catch { setOnline(false); }
    }, 45000);
    return () => clearInterval(t);
  }, [candles.length, tf.v, tf.htf, price]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [k, htf, p, s] = await Promise.all([
        fetchKlines("BTCUSDT", tf.v, 200),
        fetchKlines("BTCUSDT", tf.htf, 200),
        fetchPrice(),
        fetch24h(),
      ]);
      setCandles(k); setHtfCandles(htf); setPrice(p); setStats(s);
      setSignal(generateSignal(k, htf, p, signalRef.current));
      setOnline(true);
    } catch { setOnline(false); }
    finally { setTimeout(() => setRefreshing(false), 600); }
  };

  const priceDir = useMemo(() => {
    if (price === null || prevPrice === null) return "flat";
    return price > prevPrice ? "up" : price < prevPrice ? "down" : "flat";
  }, [price, prevPrice]);

  const isBuy = signal?.side === "BUY";
  const sideColor = signal ? (isBuy ? "bull" : "bear") : "primary";

  return (
    <div className="min-h-screen grid-bg">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-pulse">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold glow-text leading-tight">BTC-FX-Analyser</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pro Signal Engine</p>
            </div>
          </motion.div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={`flex items-center gap-1 ${online ? "text-bull" : "text-bear"}`}>
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? "LIVE" : "OFF"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span className="font-mono">{now.toLocaleTimeString()}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Live Price */}
        <motion.section
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-card/80 backdrop-blur rounded-2xl p-6 border border-border relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                <Activity className="w-3 h-3 text-bull animate-pulse" /> BTC / USDT • Binance Live
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={price ?? 0}
                  initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-4xl sm:text-5xl font-bold font-mono ${
                    priceDir === "up" ? "text-bull" : priceDir === "down" ? "text-bear" : "text-foreground"
                  }`}
                >
                  ${price !== null ? fmt(price) : "—"}
                </motion.div>
              </AnimatePresence>
              {stats && (
                <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${stats.changePercent >= 0 ? "text-bull" : "text-bear"}`}>
                  {stats.changePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {stats.changePercent >= 0 ? "+" : ""}{fmt(stats.changePercent)}% (24h)
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Stat label="24h High" value={stats ? `$${fmt(stats.high)}` : "—"} />
              <Stat label="24h Low" value={stats ? `$${fmt(stats.low)}` : "—"} />
              <Stat label="Volume" value={stats ? `${fmt(stats.volume, 0)}` : "—"} />
            </div>
          </div>
        </motion.section>

        {/* Live chart */}
        {candles.length > 0 && price !== null && (
          <PriceChart candles={candles} livePrice={price} side={signal?.side ?? "NEUTRAL"} />
        )}

        {/* Timeframes */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {TIMEFRAMES.map((t, i) => (
              <button
                key={t.v}
                onClick={() => setTfIdx(i)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
                  tfIdx === i ? "bg-primary text-primary-foreground glow-pulse" : "bg-secondary hover:bg-accent hover:text-accent-foreground"
                }`}
              >{t.label}</button>
            ))}
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-secondary hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Signal Card */}
        {loading || !signal ? (
          <div className="bg-card/80 rounded-2xl p-12 border border-border flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.section
              key={signal.generatedAt}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className={`relative rounded-2xl p-6 border-2 overflow-hidden ${
                isBuy ? "border-bull/50 bg-bull/5" : "border-bear/50 bg-bear/5"
              }`}
            >
              <div className={`absolute inset-0 opacity-20 ${isBuy ? "bg-gradient-to-br from-bull to-transparent" : "bg-gradient-to-br from-bear to-transparent"}`} />

              <div className="relative space-y-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Signal • {tf.label} (HTF: {tf.htf.toUpperCase()})
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2, repeat: Infinity }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-lg ${
                        isBuy ? "bg-bull text-background" : "bg-bear text-background"
                      }`}
                    >
                      {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      {signal.side}
                    </motion.div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase">Confidence</div>
                    <div className="text-2xl font-bold glow-text">{signal.confidence.toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">RR 1:{signal.rr.toFixed(2)}</div>
                  </div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${signal.confidence}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${isBuy ? "bg-bull" : "bg-bear"}`}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Level label="Entry" value={signal.entry} icon={<Target className="w-4 h-4" />} accent />
                  <Level label="Stop Loss" value={signal.stopLoss} icon={<Shield className="w-4 h-4" />} danger />
                  <Level label="TP 1" value={signal.takeProfit1} icon={<Sparkles className="w-4 h-4" />} bull />
                  <Level label="TP 2" value={signal.takeProfit2} icon={<Sparkles className="w-4 h-4" />} bull />
                  <Level label="TP 3" value={signal.takeProfit3} icon={<Sparkles className="w-4 h-4" />} bull />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="RSI(14)" value={signal.rsi.toFixed(1)} />
                  <Stat label="LTF Trend" value={signal.trend} />
                  <Stat label="HTF Trend" value={signal.htfTrend} />
                  <Stat label="ATR" value={fmt(signal.atr)} />
                </div>

                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Strategy Confluence
                    <span className="ml-auto font-mono text-bull">B:{signal.bullScore}</span>
                    <span className="font-mono text-bear">S:{signal.bearScore}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {signal.reasons.map((r, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border"
                      >{r}</motion.span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                  <span>Generated {new Date(signal.generatedAt).toLocaleTimeString()}</span>
                  <span>Valid until {new Date(signal.validUntil).toLocaleTimeString()}</span>
                </div>
              </div>
            </motion.section>
          </AnimatePresence>
        )}

        {/* Developer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card/60 backdrop-blur rounded-2xl p-5 border border-border text-center relative overflow-hidden"
        >
          <motion.div
            className="absolute -inset-1 opacity-20 blur-2xl"
            animate={{ background: [
              "radial-gradient(circle at 20% 50%, oklch(0.85 0.19 85), transparent 50%)",
              "radial-gradient(circle at 80% 50%, oklch(0.78 0.2 195), transparent 50%)",
              "radial-gradient(circle at 50% 50%, oklch(0.85 0.19 85), transparent 50%)",
            ]}}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Developed by</p>
            <motion.h3
              className="text-3xl dev-highlight inline-block"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ✨ Amirul-Adnan ✨
            </motion.h3>
            <p className="text-xs text-muted-foreground mt-2">Pro Forex & Crypto Strategy Engineer</p>
          </div>
        </motion.div>

        <p className="text-[10px] text-center text-muted-foreground pb-4">
          ⚠ Educational purposes only. Live data via Binance Public API. Always manage your risk.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/60 rounded-lg p-2.5 border border-border">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-mono font-semibold text-sm mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Level({ label, value, icon, accent, danger, bull }: { label: string; value: number; icon: React.ReactNode; accent?: boolean; danger?: boolean; bull?: boolean }) {
  const color = danger ? "text-bear border-bear/40" : bull ? "text-bull border-bull/40" : accent ? "text-primary border-primary/40" : "border-border";
  return (
    <motion.div whileHover={{ y: -2 }} className={`bg-card/80 rounded-xl p-3 border ${color}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="font-mono font-bold text-sm mt-1">${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</div>
    </motion.div>
  );
}
