// Multi-timeframe confluence engine.
// Aggregates 5m, 15m, 30m, 1h, 2h, 4h votes into ONE final signal.
// Signal is locked for 2 hours (resets only after that window).
export type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };
export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

export interface TFVote {
  tf: string;
  side: SignalSide;
  score: number; // -100..100 (negative = bearish)
  rsi: number;
  trend: "BULLISH" | "BEARISH" | "RANGING";
}

export interface Signal {
  side: SignalSide;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number;
  rr: number;
  reasons: string[];
  rsi: number;
  trend: "BULLISH" | "BEARISH" | "RANGING";
  htfTrend: "BULLISH" | "BEARISH" | "RANGING";
  atr: number;
  validUntil: number;
  generatedAt: number;
  bullScore: number;
  bearScore: number;
  votes: TFVote[];
  alignment: number; // 0..100 % of TFs agreeing
}

const emaArr = (values: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};
const last = <T,>(a: T[]) => a[a.length - 1];

const rsiCalc = (closes: number[], period = 14): number => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    d >= 0 ? (gains += d) : (losses -= d);
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d >= 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
};

const atrCalc = (candles: Candle[], period = 14): number => {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

const macdCalc = (closes: number[]) => {
  const e12 = emaArr(closes, 12);
  const e26 = emaArr(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const sig = emaArr(line, 9);
  return { line: last(line), signal: last(sig), hist: last(line) - last(sig), prevHist: line[line.length-2] - sig[sig.length-2] };
};

const boll = (closes: number[], period = 20, mult = 2) => {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
};

function trendOf(closes: number[]): "BULLISH" | "BEARISH" | "RANGING" {
  const e9 = last(emaArr(closes, 9));
  const e21 = last(emaArr(closes, 21));
  const e50 = last(emaArr(closes, 50));
  if (e9 > e21 && e21 > e50) return "BULLISH";
  if (e9 < e21 && e21 < e50) return "BEARISH";
  return "RANGING";
}

// Score a single timeframe: returns net score in -100..100
function scoreTF(candles: Candle[], price: number): { score: number; rsi: number; trend: "BULLISH" | "BEARISH" | "RANGING" } {
  const closes = candles.map((c) => c.close);
  const t = trendOf(closes);
  const r = rsiCalc(closes);
  const m = macdCalc(closes);
  const bb = boll(closes);
  const e50 = last(emaArr(closes, 50));

  let bull = 0, bear = 0;
  if (t === "BULLISH") bull += 25;
  else if (t === "BEARISH") bear += 25;

  if (price > e50) bull += 10; else bear += 10;

  if (r < 30) bull += 20;
  else if (r < 45) bull += 8;
  else if (r > 70) bear += 20;
  else if (r > 55) bear += 8;

  if (m.hist > 0 && m.hist > m.prevHist) bull += 18;
  else if (m.hist > 0) bull += 8;
  else if (m.hist < 0 && m.hist < m.prevHist) bear += 18;
  else bear += 8;

  if (price < bb.lower) bull += 12;
  else if (price > bb.upper) bear += 12;

  if (closes.length >= 6) {
    const mom = ((closes[closes.length-1] - closes[closes.length-5]) / closes[closes.length-5]) * 100;
    if (mom > 0.4) bull += 10;
    else if (mom < -0.4) bear += 10;
  }

  const total = bull + bear || 1;
  const score = ((bull - bear) / total) * 100;
  return { score, rsi: r, trend: t };
}

export interface MTFInput {
  tf: string;
  weight: number;
  candles: Candle[];
}

export function generateSignal(
  inputs: MTFInput[],
  livePrice: number,
  prev?: Signal | null
): Signal {
  // The signal is locked for 2 hours from generatedAt.
  if (prev && Date.now() < prev.validUntil) {
    // Refresh entry/SL/TP only if live price drifts significantly? Keep stable — return prev with updated entry display.
    return prev;
  }

  const votes: TFVote[] = [];
  let weightedScore = 0;
  let totalWeight = 0;
  let bullCount = 0, bearCount = 0;

  for (const input of inputs) {
    if (input.candles.length < 50) continue;
    const r = scoreTF(input.candles, livePrice);
    const side: SignalSide = r.score > 12 ? "BUY" : r.score < -12 ? "SELL" : "NEUTRAL";
    votes.push({ tf: input.tf, side, score: Math.round(r.score), rsi: r.rsi, trend: r.trend });
    weightedScore += r.score * input.weight;
    totalWeight += input.weight;
    if (side === "BUY") bullCount++;
    else if (side === "SELL") bearCount++;
  }

  const finalScore = totalWeight ? weightedScore / totalWeight : 0;
  let side: SignalSide = finalScore > 8 ? "BUY" : finalScore < -8 ? "SELL" : (finalScore >= 0 ? "BUY" : "SELL");

  const reasons: string[] = [];
  reasons.push(`MTF aggregate score: ${finalScore.toFixed(1)}`);
  reasons.push(`${bullCount} TFs bullish vs ${bearCount} bearish`);
  votes.forEach((v) => reasons.push(`${v.tf}: ${v.side} (${v.score})`));

  const alignment = votes.length ? Math.round((Math.max(bullCount, bearCount) / votes.length) * 100) : 0;
  const confidence = Math.max(55, Math.min(98, 55 + Math.abs(finalScore) * 0.45 + alignment * 0.15));

  // Use the 1h candles for ATR/structure if available, else first valid input
  const refInput = inputs.find((i) => i.tf === "1h" && i.candles.length >= 50) ?? inputs.find((i) => i.candles.length >= 50)!;
  const refCandles = refInput.candles;
  const a = atrCalc(refCandles);
  const refTrend = trendOf(refCandles.map((c) => c.close));

  const htfInput = inputs.find((i) => i.tf === "4h" && i.candles.length >= 50) ?? refInput;
  const htfTrend = trendOf(htfInput.candles.map((c) => c.close));

  const atrSL = Math.max(a * 1.6, livePrice * 0.004);
  const entry = livePrice;
  const stopLoss = side === "BUY" ? entry - atrSL : entry + atrSL;
  const takeProfit1 = side === "BUY" ? entry + atrSL * 1.0 : entry - atrSL * 1.0;
  const takeProfit2 = side === "BUY" ? entry + atrSL * 2.0 : entry - atrSL * 2.0;
  const takeProfit3 = side === "BUY" ? entry + atrSL * 3.5 : entry - atrSL * 3.5;
  const rr = Math.abs(takeProfit2 - entry) / Math.abs(entry - stopLoss);

  const now = Date.now();
  return {
    side, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3,
    confidence, rr,
    reasons: reasons.slice(0, 12),
    rsi: votes.find((v) => v.tf === "1h")?.rsi ?? votes[0]?.rsi ?? 50,
    trend: refTrend,
    htfTrend,
    atr: a,
    bullScore: Math.round(50 + finalScore / 2),
    bearScore: Math.round(50 - finalScore / 2),
    votes,
    alignment,
    generatedAt: now,
    validUntil: now + 2 * 60 * 60 * 1000, // 2 hours lock
  };
}
