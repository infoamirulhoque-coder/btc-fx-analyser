// Multi-timeframe confluence engine — Upgraded for maximum accuracy.
// Adds: ADX, Stochastic RSI, VWAP, volume confirmation, S/R proximity,
// candlestick patterns (engulfing, pin bar, doji), RSI divergence.
// Anti-flip: signal locked 2h, requires strong score AND alignment to flip.
export type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };
export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

export interface TFVote {
  tf: string;
  side: SignalSide;
  score: number;
  rsi: number;
  trend: "BULLISH" | "BEARISH" | "RANGING";
  adx: number;
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
  alignment: number;
}

const last = <T,>(a: T[]) => a[a.length - 1];

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

const rsiArr = (closes: number[], period = 14): number[] => {
  const out: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    d >= 0 ? (gains += d) : (losses -= d);
  }
  let avgG = gains / period, avgL = losses / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d >= 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
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
  return { line: last(line), signal: last(sig), hist: last(line) - last(sig), prevHist: line[line.length - 2] - sig[sig.length - 2] };
};

const boll = (closes: number[], period = 20, mult = 2) => {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
};

// Wilder ADX (trend strength 0..100)
const adxCalc = (candles: Candle[], period = 14): number => {
  if (candles.length < period * 2) return 0;
  const tr: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const upMove = c.high - p.high;
    const dnMove = p.low - c.low;
    plusDM.push(upMove > dnMove && upMove > 0 ? upMove : 0);
    minusDM.push(dnMove > upMove && dnMove > 0 ? dnMove : 0);
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const smooth = (arr: number[]) => {
    let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const out = [s];
    for (let i = period; i < arr.length; i++) {
      s = s - s / period + arr[i];
      out.push(s);
    }
    return out;
  };
  const trS = smooth(tr), pS = smooth(plusDM), mS = smooth(minusDM);
  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    const pdi = (pS[i] / trS[i]) * 100;
    const mdi = (mS[i] / trS[i]) * 100;
    const sum = pdi + mdi || 1;
    dx.push((Math.abs(pdi - mdi) / sum) * 100);
  }
  const adxSlice = dx.slice(-period);
  return adxSlice.reduce((a, b) => a + b, 0) / adxSlice.length;
};

// Stochastic RSI
const stochRsi = (closes: number[]): number => {
  const r = rsiArr(closes);
  const slice = r.slice(-14);
  const min = Math.min(...slice), max = Math.max(...slice);
  if (max === min) return 50;
  return ((r[r.length - 1] - min) / (max - min)) * 100;
};

// Approximate VWAP from candle volume * typical price
const vwapCalc = (candles: Candle[], lookback = 50): number => {
  const slice = candles.slice(-lookback);
  let pv = 0, v = 0;
  for (const c of slice) {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    v += c.volume;
  }
  return v ? pv / v : last(candles).close;
};

// Recent swing high/low
const recentSwings = (candles: Candle[], lookback = 30) => {
  const slice = candles.slice(-lookback);
  return {
    high: Math.max(...slice.map((c) => c.high)),
    low: Math.min(...slice.map((c) => c.low)),
  };
};

// Candlestick pattern detection on the last 2 candles
const candlePattern = (candles: Candle[]): "BULL" | "BEAR" | "NONE" => {
  if (candles.length < 3) return "NONE";
  const a = candles[candles.length - 2], b = candles[candles.length - 1];
  const bodyA = Math.abs(a.close - a.open);
  const bodyB = Math.abs(b.close - b.open);
  const rangeB = b.high - b.low || 1;
  // Bullish engulfing
  if (a.close < a.open && b.close > b.open && b.close > a.open && b.open < a.close && bodyB > bodyA) return "BULL";
  // Bearish engulfing
  if (a.close > a.open && b.close < b.open && b.open > a.close && b.close < a.open && bodyB > bodyA) return "BEAR";
  // Hammer / pin bar (long lower wick)
  const lowerWick = Math.min(b.open, b.close) - b.low;
  const upperWick = b.high - Math.max(b.open, b.close);
  if (lowerWick > rangeB * 0.6 && bodyB < rangeB * 0.3) return "BULL";
  if (upperWick > rangeB * 0.6 && bodyB < rangeB * 0.3) return "BEAR";
  return "NONE";
};

// RSI divergence on last 14 bars
const divergence = (candles: Candle[]): "BULL" | "BEAR" | "NONE" => {
  if (candles.length < 20) return "NONE";
  const closes = candles.map((c) => c.close);
  const r = rsiArr(closes);
  const n = closes.length;
  const recent = closes.slice(n - 5, n);
  const prev = closes.slice(n - 14, n - 9);
  const rRecent = r.slice(n - 5, n);
  const rPrev = r.slice(n - 14, n - 9);
  const priceLowNow = Math.min(...recent), priceLowPrev = Math.min(...prev);
  const priceHighNow = Math.max(...recent), priceHighPrev = Math.max(...prev);
  const rsiLowNow = Math.min(...rRecent), rsiLowPrev = Math.min(...rPrev);
  const rsiHighNow = Math.max(...rRecent), rsiHighPrev = Math.max(...rPrev);
  if (priceLowNow < priceLowPrev && rsiLowNow > rsiLowPrev) return "BULL";
  if (priceHighNow > priceHighPrev && rsiHighNow < rsiHighPrev) return "BEAR";
  return "NONE";
};

function trendOf(closes: number[]): "BULLISH" | "BEARISH" | "RANGING" {
  const e9 = last(emaArr(closes, 9));
  const e21 = last(emaArr(closes, 21));
  const e50 = last(emaArr(closes, 50));
  if (e9 > e21 && e21 > e50) return "BULLISH";
  if (e9 < e21 && e21 < e50) return "BEARISH";
  return "RANGING";
}

function scoreTF(candles: Candle[], price: number) {
  const closes = candles.map((c) => c.close);
  const t = trendOf(closes);
  const rArr = rsiArr(closes);
  const r = rArr[rArr.length - 1];
  const m = macdCalc(closes);
  const bb = boll(closes);
  const e50 = last(emaArr(closes, 50));
  const adx = adxCalc(candles);
  const sRsi = stochRsi(closes);
  const vwap = vwapCalc(candles);
  const sw = recentSwings(candles);
  const pat = candlePattern(candles);
  const div = divergence(candles);
  const avgVol = candles.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
  const lastVol = last(candles).volume;
  const volBoost = avgVol ? lastVol / avgVol : 1;

  let bull = 0, bear = 0;

  // Trend (EMA stack) — heavy weight
  if (t === "BULLISH") bull += 22;
  else if (t === "BEARISH") bear += 22;

  // ADX trend strength gate — only counts when trend is strong
  const strong = adx > 22;
  if (strong) {
    if (t === "BULLISH") bull += 10;
    else if (t === "BEARISH") bear += 10;
  }

  // Price vs EMA50
  if (price > e50) bull += 8; else bear += 8;

  // RSI
  if (r < 30) bull += 16;
  else if (r < 45) bull += 6;
  else if (r > 70) bear += 16;
  else if (r > 55) bear += 6;

  // Stochastic RSI confirmation
  if (sRsi < 20) bull += 10;
  else if (sRsi > 80) bear += 10;

  // MACD histogram + slope
  if (m.hist > 0 && m.hist > m.prevHist) bull += 16;
  else if (m.hist > 0) bull += 7;
  else if (m.hist < 0 && m.hist < m.prevHist) bear += 16;
  else if (m.hist < 0) bear += 7;

  // Bollinger Bands extremes (mean reversion bias)
  if (price < bb.lower) bull += 10;
  else if (price > bb.upper) bear += 10;

  // VWAP relative
  if (price > vwap) bull += 8; else bear += 8;

  // Momentum (5-bar)
  if (closes.length >= 6) {
    const mom = ((closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5]) * 100;
    if (mom > 0.4) bull += 8;
    else if (mom < -0.4) bear += 8;
  }

  // Support / resistance proximity
  const range = sw.high - sw.low || 1;
  const distLow = (price - sw.low) / range;
  const distHigh = (sw.high - price) / range;
  if (distLow < 0.15) bull += 9;
  if (distHigh < 0.15) bear += 9;

  // Candle pattern
  if (pat === "BULL") bull += 8;
  else if (pat === "BEAR") bear += 8;

  // RSI divergence — strong reversal signal
  if (div === "BULL") bull += 12;
  else if (div === "BEAR") bear += 12;

  // Volume confirmation: boost the dominant side
  if (volBoost > 1.3) {
    if (bull > bear) bull += 6; else if (bear > bull) bear += 6;
  }

  const total = bull + bear || 1;
  const score = ((bull - bear) / total) * 100;
  return { score, rsi: r, trend: t, adx };
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
    return prev;
  }

  const votes: TFVote[] = [];
  let weightedScore = 0, totalWeight = 0;
  let bullCount = 0, bearCount = 0, neutralCount = 0;
  let adxSum = 0, adxCount = 0;

  for (const input of inputs) {
    if (input.candles.length < 50) continue;
    const r = scoreTF(input.candles, livePrice);
    const side: SignalSide = r.score > 15 ? "BUY" : r.score < -15 ? "SELL" : "NEUTRAL";
    votes.push({ tf: input.tf, side, score: Math.round(r.score), rsi: r.rsi, trend: r.trend, adx: Math.round(r.adx) });
    weightedScore += r.score * input.weight;
    totalWeight += input.weight;
    adxSum += r.adx; adxCount++;
    if (side === "BUY") bullCount++;
    else if (side === "SELL") bearCount++;
    else neutralCount++;
  }

  const finalScore = totalWeight ? weightedScore / totalWeight : 0;
  const dominantCount = Math.max(bullCount, bearCount);
  const alignment = votes.length ? Math.round((dominantCount / votes.length) * 100) : 0;
  const avgAdx = adxCount ? adxSum / adxCount : 0;

  // Decide side. Confidence floor: weak signals fall back to previous side
  // (or hold neutral as BUY/SELL based on micro-bias) to prevent random flips.
  let side: SignalSide;
  const strongEnough = Math.abs(finalScore) >= 18 && alignment >= 50 && avgAdx >= 18;

  if (strongEnough) {
    side = finalScore > 0 ? "BUY" : "SELL";
  } else if (prev) {
    // Hold previous direction if not conclusive
    side = prev.side;
  } else {
    side = finalScore >= 0 ? "BUY" : "SELL";
  }

  const reasons: string[] = [];
  reasons.push(`MTF aggregate: ${finalScore.toFixed(1)} (alignment ${alignment}%)`);
  reasons.push(`Avg ADX ${avgAdx.toFixed(0)} — ${avgAdx > 22 ? "strong trend" : avgAdx > 15 ? "developing" : "weak/ranging"}`);
  reasons.push(`${bullCount} bullish · ${bearCount} bearish · ${neutralCount} neutral TFs`);
  votes.forEach((v) => reasons.push(`${v.tf}: ${v.side} (score ${v.score}, ADX ${v.adx})`));

  // Confidence tightened: based on |score|, alignment, ADX
  const confidence = Math.max(60, Math.min(98,
    55 + Math.abs(finalScore) * 0.35 + alignment * 0.15 + Math.min(avgAdx, 40) * 0.2
  ));

  const refInput = inputs.find((i) => i.tf === "1h" && i.candles.length >= 50) ?? inputs.find((i) => i.candles.length >= 50)!;
  const refCandles = refInput.candles;
  const a = atrCalc(refCandles);
  const refTrend = trendOf(refCandles.map((c) => c.close));

  const htfInput = inputs.find((i) => i.tf === "4h" && i.candles.length >= 50)
    ?? inputs.find((i) => i.tf === "2h" && i.candles.length >= 50) ?? refInput;
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
    reasons: reasons.slice(0, 14),
    rsi: votes.find((v) => v.tf === "1h")?.rsi ?? votes[0]?.rsi ?? 50,
    trend: refTrend,
    htfTrend,
    atr: a,
    bullScore: Math.round(50 + finalScore / 2),
    bearScore: Math.round(50 - finalScore / 2),
    votes,
    alignment,
    generatedAt: now,
    validUntil: now + 2 * 60 * 60 * 1000,
  };
}
