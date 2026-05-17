import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Target, Shield, Clock, Zap, BarChart3, RefreshCw, Sparkles, Wifi, WifiOff, Layers, ChevronDown } from "lucide-react";
import { fetch24h, fetchKlines, fetchPrice } from "@/lib/binance";
import { generateSignal, type Candle, type Signal, type MTFInput } from "@/lib/signal-engine";
import { TradingViewChart } from "./TradingViewChart";
import devImage from "@/assets/developer-amirul.jpg";

const MTF = [
  { tf: "5m", weight: 1 },
  { tf: "15m", weight: 1.3 },
  { tf: "30m", weight: 1.6 },
  { tf: "1h", weight: 2.0 },
  { tf: "2h", weight: 2.4 },
  { tf: "4h", weight: 2.8 },
];

const PAIRS = [
  { symbol: "BTCUSDT", label: "BTC / USDT", digits: 2 },
  { symbol: "ETHUSDT", label: "ETH / USDT", digits: 2 },
  { symbol: "BNBUSDT", label: "BNB / USDT", digits: 2 },
  { symbol: "SOLUSDT", label: "SOL / USDT", digits: 2 },
  { symbol: "XRPUSDT", label: "XRP / USDT", digits: 4 },
  { symbol: "ADAUSDT", label: "ADA / USDT", digits: 4 },
  { symbol: "DOGEUSDT", label: "DOGE / USDT", digits: 5 },
  { symbol: "AVAXUSDT", label: "AVAX / USDT", digits: 3 },
  { symbol: "LINKUSDT", label: "LINK / USDT", digits: 3 },
  { symbol: "MATICUSDT", label: "MATIC / USDT", digits: 4 },
  { symbol: "DOTUSDT", label: "DOT / USDT", digits: 3 },
  { symbol: "LTCUSDT", label: "LTC / USDT", digits: 2 },
  { symbol: "TRXUSDT", label: "TRX / USDT", digits: 5 },
  { symbol: "ATOMUSDT", label: "ATOM / USDT", digits: 3 },
  { symbol: "NEARUSDT", label: "NEAR / USDT", digits: 3 },
  { symbol: "ARBUSDT", label: "ARB / USDT", digits: 4 },
];

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function SignalDashboard() {
  const [pair, setPair] = useState(PAIRS[0]);
  const [pairOpen, setPairOpen] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [stats, setStats] = useState<{ change: number; changePercent: number; high: number; low: number; volume: number } | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const signalsByPair = useRef<Record<string, Signal | null>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);

  const digits = pair.digits;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = async (sym: string, force = false) => {
    try {
      const [klinesArr, p, s] = await Promise.all([
        Promise.all(MTF.map((m) => fetchKlines(sym, m.tf, 200))),
        fetchPrice(sym),
        fetch24h(sym),
      ]);
      const inputs: MTFInput[] = MTF.map((m, i) => ({ tf: m.tf, weight: m.weight, candles: klinesArr[i] }));
      const oneH = inputs.find((i) => i.tf === "1h")?.candles ?? klinesArr[0];
      setChartCandles(oneH);
      setPrevPrice(price);
      setPrice(p);
      setStats(s);
      const prev = force ? null : signalsByPair.current[sym];
      const next = generateSignal(inputs, p, prev);
      signalsByPair.current[sym] = next;
      setSignal(next);
      setOnline(true);
    } catch (e) {
      console.error(e);
      setOnline(false);
    }
  };

  // Load on pair change
  useEffect(() => {
    setLoading(true);
    setPrice(null); setPrevPrice(null); setStats(null); setSignal(null); setChartCandles([]);
    loadAll(pair.symbol, !signalsByPair.current[pair.symbol]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.symbol]);

  // Price polling every 3s
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const p = await fetchPrice(pair.symbol);
        setPrevPrice(price);
        setPrice(p);
        setOnline(true);
      } catch { setOnline(false); }
    }, 3000);
    return () => clearInterval(t);
  }, [pair.symbol, price]);

  // Re-evaluate every 60s (signal locked 2h)
  useEffect(() => {
    const t = setInterval(() => loadAll(pair.symbol, false), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.symbol]);

  const refresh = async () => {
    setRefreshing(true);
    await loadAll(pair.symbol, false);
    setTimeout(() => setRefreshing(false), 600);
  };

  const priceDir = useMemo(() => {
    if (price === null || prevPrice === null) return "flat";
    return price > prevPrice ? "up" : price < prevPrice ? "down" : "flat";
  }, [price, prevPrice]);

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!signal) return;
    const update = () => {
      const ms = Math.max(0, signal.validUntil - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [signal]);

  const isBuy = signal?.side === "BUY";

  return (
    <div className="min-h-screen relative">
      {/* Animated developer background theme */}
      <div className="dev-bg-image" style={{ backgroundImage: `url(${devImage})` }} aria-hidden />
      <div className="dev-bg-overlay" aria-hidden />
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" aria-hidden />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-pulse">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold glow-text leading-tight">BTC-FX-Analyser</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MTF Pro Signal Engine</p>
              </div>
            </motion.div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className={`flex items-center gap-1 ${online ? "text-bull" : "text-bear"}`}>
                {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {online ? "LIVE" : "OFF"}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{now.toLocaleTimeString()}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
          {/* Pair selector */}
          <div className="relative">
            <button
              onClick={() => setPairOpen((v) => !v)}
              className="w-full bg-card/80 backdrop-blur rounded-xl p-3 border border-border flex items-center justify-between hover:border-primary/60 transition"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">{pair.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Trading Pair</span>
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${pairOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {pairOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="absolute z-40 mt-2 w-full bg-card/95 backdrop-blur-xl rounded-xl border border-border p-2 grid grid-cols-2 sm:grid-cols-4 gap-1 max-h-80 overflow-auto shadow-2xl"
                >
                  {PAIRS.map((p) => (
                    <button
                      key={p.symbol}
                      onClick={() => { setPair(p); setPairOpen(false); }}
                      className={`text-xs px-3 py-2 rounded-lg text-left hover:bg-primary/20 transition ${pair.symbol === p.symbol ? "bg-primary/20 text-primary font-bold" : ""}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Live Price */}
          <motion.section
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-card/80 backdrop-blur rounded-2xl p-6 border border-border relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  <Activity className="w-3 h-3 text-bull animate-pulse" /> {pair.label} • Binance Live
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
                    ${price !== null ? fmt(price, digits) : "—"}
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
                <Stat label="24h High" value={stats ? `$${fmt(stats.high, digits)}` : "—"} />
                <Stat label="24h Low" value={stats ? `$${fmt(stats.low, digits)}` : "—"} />
                <Stat label="Volume" value={stats ? `${fmt(stats.volume, 0)}` : "—"} />
              </div>
            </div>
          </motion.section>

          {chartCandles.length > 0 && price !== null && (
            <PriceChart candles={chartCandles} livePrice={price} side={signal?.side ?? "NEUTRAL"} />
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="w-4 h-4 text-primary" />
              <span className="uppercase tracking-wider">Analyzing: 5M · 15M · 30M · 1H · 2H · 4H</span>
            </div>
            <div className="flex items-center gap-2">
              {signal && (
                <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-secondary border border-border">
                  Resets in <span className="text-primary font-bold">{timeLeft}</span>
                </span>
              )}
              <button
                onClick={refresh}
                className="p-2 rounded-lg bg-secondary hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading || !signal ? (
            <div className="bg-card/80 rounded-2xl p-12 border border-border flex items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.section
                key={pair.symbol + signal.generatedAt}
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
                        Final MTF Signal • {pair.label} • Locked 2H
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
                      <div className="text-xs text-muted-foreground">RR 1:{signal.rr.toFixed(2)} · Align {signal.alignment}%</div>
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
                    <Level label="Entry" value={signal.entry} digits={digits} icon={<Target className="w-4 h-4" />} accent />
                    <Level label="Stop Loss" value={signal.stopLoss} digits={digits} icon={<Shield className="w-4 h-4" />} danger />
                    <Level label="TP 1" value={signal.takeProfit1} digits={digits} icon={<Sparkles className="w-4 h-4" />} bull />
                    <Level label="TP 2" value={signal.takeProfit2} digits={digits} icon={<Sparkles className="w-4 h-4" />} bull />
                    <Level label="TP 3" value={signal.takeProfit3} digits={digits} icon={<Sparkles className="w-4 h-4" />} bull />
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Timeframe Votes
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {signal.votes.map((v) => (
                        <motion.div
                          key={v.tf}
                          initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                          className={`rounded-lg p-2 border text-center ${
                            v.side === "BUY" ? "border-bull/50 bg-bull/10 text-bull" :
                            v.side === "SELL" ? "border-bear/50 bg-bear/10 text-bear" :
                            "border-border bg-secondary/40"
                          }`}
                        >
                          <div className="text-[10px] uppercase opacity-70">{v.tf}</div>
                          <div className="font-bold text-sm">{v.side}</div>
                          <div className="text-[10px] font-mono opacity-80">{v.score > 0 ? "+" : ""}{v.score}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <Stat label="RSI(1H)" value={signal.rsi.toFixed(1)} />
                    <Stat label="1H Trend" value={signal.trend} />
                    <Stat label="HTF Trend" value={signal.htfTrend} />
                    <Stat label="ATR" value={fmt(signal.atr, digits)} />
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Strategy Confluence
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
                    <span>Resets {new Date(signal.validUntil).toLocaleTimeString()}</span>
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
            <div className="relative flex flex-col items-center gap-3">
              <motion.div
                className="dev-avatar-ring p-[3px] rounded-full"
                animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              >
                <img src={devImage} alt="Amirul-Adnan" className="w-20 h-20 rounded-full object-cover border-2 border-background" />
              </motion.div>
              <div>
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
            </div>
          </motion.div>

          <p className="text-[10px] text-center text-muted-foreground pb-4">
            ⚠ Educational purposes only. Live data via Binance Public API. Always manage your risk.
          </p>
        </main>
      </div>
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

function Level({ label, value, digits, icon, accent, danger, bull }: { label: string; value: number; digits: number; icon: React.ReactNode; accent?: boolean; danger?: boolean; bull?: boolean }) {
  const color = danger ? "text-bear border-bear/40" : bull ? "text-bull border-bull/40" : accent ? "text-primary border-primary/40" : "border-border";
  return (
    <motion.div whileHover={{ y: -2 }} className={`bg-card/80 rounded-xl p-3 border ${color}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="font-mono font-bold text-sm mt-1">${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}</div>
    </motion.div>
  );
}
