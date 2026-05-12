import { motion } from "framer-motion";
import type { Candle } from "@/lib/signal-engine";

export function PriceChart({ candles, livePrice, side }: { candles: Candle[]; livePrice: number | null; side: "BUY" | "SELL" | "NEUTRAL" }) {
  if (candles.length < 2) return null;
  const data = candles.slice(-60);
  const lows = data.map((c) => c.low);
  const highs = data.map((c) => c.high);
  const min = Math.min(...lows, livePrice ?? Infinity);
  const max = Math.max(...highs, livePrice ?? 0);
  const range = max - min || 1;
  const W = 600, H = 140, pad = 4;
  const x = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (H - pad * 2);

  const path = data.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(" ");
  const areaPath = `${path} L${x(data.length - 1).toFixed(2)},${H - pad} L${pad},${H - pad} Z`;

  const isBuy = side === "BUY";
  const stroke = isBuy ? "var(--bull)" : side === "SELL" ? "var(--bear)" : "var(--primary)";
  const liveY = livePrice !== null ? y(livePrice) : null;

  return (
    <div className="bg-card/60 backdrop-blur rounded-xl p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">BTC/USDT • Live Chart</span>
        <span className="text-[10px] font-mono text-muted-foreground">{data.length} candles</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <motion.path
          d={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }}
        />
        {liveY !== null && (
          <>
            <line x1={pad} y1={liveY} x2={W - pad} y2={liveY} stroke={stroke} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.7" />
            <motion.circle
              cx={x(data.length - 1)} cy={liveY} r="4" fill={stroke}
              animate={{ r: [4, 7, 4], opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            />
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
        <span>${min.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        <span>${max.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
