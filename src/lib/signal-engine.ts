// Pro signal engine: multi-indicator confluence (EMA, RSI, MACD, BB, ATR)
export type Candle = { openTime: number; open: number; high: number; low: number; close: number; volume: number };
export type SignalSide = "BUY" | "SELL" | "NEUTRAL";

export interface Signal {
  side: SignalSide;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number; // 0-100
  rr: number;
  reasons: string[];
  rsi: number;
  trend: "BULLISH" | "BEARISH" | "RANGING";
  atr: number;
  validUntil: number;
  generatedAt: number;
}

const ema = (values: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

const rsi = (closes: number[], period = 14): number => {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgG = gains / period, avgL = losses / period;
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
};

const atr = (candles: Candle[], period = 14): number => {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

const macd = (closes: number[]) => {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const signal = ema(line, 9);
  const hist = line[line.length - 1] - signal[signal.length - 1];
  return { hist, line: line[line.length - 1], signal: signal[signal.length - 1] };
};

const bollinger = (closes: number[], period = 20, mult = 2) => {
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return { mid: mean, upper: mean + mult * sd, lower: mean - mult * sd };
};

export function generateSignal(candles: Candle[], livePrice: number): Signal {
  const closes = candles.map((c) => c.close);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const r = rsi(closes);
  const m = macd(closes);
  const bb = bollinger(closes);
  const a = atr(candles);
  const price = livePrice;

  const e9 = ema9[ema9.length - 1];
  const e21 = ema21[ema21.length - 1];
  const e50 = ema50[ema50.length - 1];

  let bullScore = 0, bearScore = 0;
  const reasons: string[] = [];

  if (e9 > e21 && e21 > e50) { bullScore += 25; reasons.push("EMA stack bullish (9>21>50)"); }
  else if (e9 < e21 && e21 < e50) { bearScore += 25; reasons.push("EMA stack bearish (9<21<50)"); }

  if (price > e50) { bullScore += 10; reasons.push("Price above EMA50"); }
  else { bearScore += 10; reasons.push("Price below EMA50"); }

  if (r < 35) { bullScore += 18; reasons.push(`RSI oversold (${r.toFixed(1)})`); }
  else if (r > 65) { bearScore += 18; reasons.push(`RSI overbought (${r.toFixed(1)})`); }
  else if (r > 50) { bullScore += 6; }
  else { bearScore += 6; }

  if (m.hist > 0) { bullScore += 15; reasons.push("MACD histogram positive"); }
  else { bearScore += 15; reasons.push("MACD histogram negative"); }

  if (price < bb.lower) { bullScore += 15; reasons.push("Price below lower Bollinger band"); }
  else if (price > bb.upper) { bearScore += 15; reasons.push("Price above upper Bollinger band"); }

  const lastClose = closes[closes.length - 1];
  const mom = ((lastClose - closes[closes.length - 5]) / closes[closes.length - 5]) * 100;
  if (mom > 0.3) { bullScore += 10; reasons.push(`Momentum +${mom.toFixed(2)}%`); }
  else if (mom < -0.3) { bearScore += 10; reasons.push(`Momentum ${mom.toFixed(2)}%`); }

  const total = bullScore + bearScore;
  let side: SignalSide = "NEUTRAL";
  let confidence = 50;
  if (bullScore > bearScore && bullScore - bearScore >= 12) {
    side = "BUY";
    confidence = Math.min(98, 55 + (bullScore - bearScore));
  } else if (bearScore > bullScore && bearScore - bullScore >= 12) {
    side = "SELL";
    confidence = Math.min(98, 55 + (bearScore - bullScore));
  } else {
    side = bullScore >= bearScore ? "BUY" : "SELL";
    confidence = 60 + Math.abs(bullScore - bearScore);
  }

  const trend: Signal["trend"] = e9 > e21 && e21 > e50 ? "BULLISH" : e9 < e21 && e21 < e50 ? "BEARISH" : "RANGING";

  // Risk model — ATR-based SL, multi-target TP
  const slDist = a * 1.5;
  const tp1Dist = a * 1.5;
  const tp2Dist = a * 3;
  const tp3Dist = a * 5;

  const entry = price;
  const stopLoss = side === "BUY" ? entry - slDist : entry + slDist;
  const takeProfit1 = side === "BUY" ? entry + tp1Dist : entry - tp1Dist;
  const takeProfit2 = side === "BUY" ? entry + tp2Dist : entry - tp2Dist;
  const takeProfit3 = side === "BUY" ? entry + tp3Dist : entry - tp3Dist;
  const rr = Math.abs(takeProfit2 - entry) / Math.abs(entry - stopLoss);

  return {
    side, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3,
    confidence, rr, reasons, rsi: r, trend, atr: a,
    generatedAt: Date.now(),
    validUntil: Date.now() + 15 * 60 * 1000,
  };
}
