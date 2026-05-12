// Pro multi-timeframe confluence engine.
// Stable signals: only flip when confluence strongly reverses; otherwise hold.
export type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };
export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

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
  return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd, width: (mult * 2 * sd) / mean };
};

function trendOf(closes: number[]): "BULLISH" | "BEARISH" | "RANGING" {
  const e9 = last(emaArr(closes, 9));
  const e21 = last(emaArr(closes, 21));
  const e50 = last(emaArr(closes, 50));
  if (e9 > e21 && e21 > e50) return "BULLISH";
  if (e9 < e21 && e21 < e50) return "BEARISH";
  return "RANGING";
}

export function generateSignal(
  ltfCandles: Candle[],
  htfCandles: Candle[],
  livePrice: number,
  prev?: Signal | null
): Signal {
  const closes = ltfCandles.map((c) => c.close);
  const htfCloses = htfCandles.map((c) => c.close);

  const e9 = last(emaArr(closes, 9));
  const e21 = last(emaArr(closes, 21));
  const e50 = last(emaArr(closes, 50));
  const r = rsiCalc(closes);
  const m = macdCalc(closes);
  const bb = boll(closes);
  const a = atrCalc(ltfCandles);
  const price = livePrice;

  const ltfTrend = trendOf(closes);
  const htfTrend = trendOf(htfCloses);

  let bull = 0, bear = 0;
  const reasons: string[] = [];

  // HTF trend filter (heaviest weight — pro traders trade with HTF)
  if (htfTrend === "BULLISH") { bull += 30; reasons.push("HTF trend bullish"); }
  else if (htfTrend === "BEARISH") { bear += 30; reasons.push("HTF trend bearish"); }
  else reasons.push("HTF ranging");

  // LTF EMA structure
  if (ltfTrend === "BULLISH") { bull += 18; reasons.push("LTF EMA stack bullish"); }
  else if (ltfTrend === "BEARISH") { bear += 18; reasons.push("LTF EMA stack bearish"); }

  // Price vs EMA50
  if (price > e50) bull += 8;
  else bear += 8;

  // RSI
  if (r < 30) { bull += 18; reasons.push(`RSI deeply oversold (${r.toFixed(1)})`); }
  else if (r < 45) { bull += 8; reasons.push(`RSI weak (${r.toFixed(1)})`); }
  else if (r > 70) { bear += 18; reasons.push(`RSI deeply overbought (${r.toFixed(1)})`); }
  else if (r > 55) { bear += 8; reasons.push(`RSI strong (${r.toFixed(1)})`); }

  // MACD with momentum check
  if (m.hist > 0 && m.hist > m.prevHist) { bull += 15; reasons.push("MACD bullish & rising"); }
  else if (m.hist > 0) { bull += 8; }
  else if (m.hist < 0 && m.hist < m.prevHist) { bear += 15; reasons.push("MACD bearish & falling"); }
  else { bear += 8; }

  // Bollinger mean reversion
  if (price < bb.lower) { bull += 12; reasons.push("Below lower Bollinger"); }
  else if (price > bb.upper) { bear += 12; reasons.push("Above upper Bollinger"); }

  // Momentum (5-bar ROC)
  const mom = ((closes[closes.length-1] - closes[closes.length-5]) / closes[closes.length-5]) * 100;
  if (mom > 0.4) { bull += 9; reasons.push(`Momentum +${mom.toFixed(2)}%`); }
  else if (mom < -0.4) { bear += 9; reasons.push(`Momentum ${mom.toFixed(2)}%`); }

  // Determine raw side
  const diff = bull - bear;
  let side: SignalSide;
  if (diff >= 18) side = "BUY";
  else if (diff <= -18) side = "SELL";
  else side = "NEUTRAL";

  // STABILITY: don't flip on small reversals — require stronger opposing diff to flip
  if (prev && prev.side !== "NEUTRAL" && side !== prev.side) {
    const flipNeeded = 28; // require dominant reversal
    if (Math.abs(diff) < flipNeeded) {
      side = prev.side; // hold previous signal
      reasons.push("Holding prior signal — reversal not confirmed");
    }
  }

  // If still neutral, surface dominant bias but mark low confidence
  if (side === "NEUTRAL") {
    side = bull >= bear ? "BUY" : "SELL";
  }

  const confidence = Math.max(40, Math.min(98, 50 + Math.abs(diff)));

  // ATR risk (clamped so SL is meaningful but not crazy)
  const atrSL = Math.max(a * 1.5, price * 0.003);
  const entry = price;
  const stopLoss = side === "BUY" ? entry - atrSL : entry + atrSL;
  const takeProfit1 = side === "BUY" ? entry + atrSL * 1.0 : entry - atrSL * 1.0;
  const takeProfit2 = side === "BUY" ? entry + atrSL * 2.0 : entry - atrSL * 2.0;
  const takeProfit3 = side === "BUY" ? entry + atrSL * 3.5 : entry - atrSL * 3.5;
  const rr = Math.abs(takeProfit2 - entry) / Math.abs(entry - stopLoss);

  return {
    side, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3,
    confidence, rr, reasons: reasons.slice(0, 8), rsi: r, trend: ltfTrend, htfTrend, atr: a,
    bullScore: bull, bearScore: bear,
    generatedAt: Date.now(),
    validUntil: Date.now() + 15 * 60 * 1000,
  };
}
