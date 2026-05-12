import type { Candle } from "./signal-engine";

const BASE = "https://api.binance.com";

export async function fetchKlines(symbol = "BTCUSDT", interval = "15m", limit = 200): Promise<Candle[]> {
  const res = await fetch(`${BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch klines");
  const data: any[] = await res.json();
  return data.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchPrice(symbol = "BTCUSDT"): Promise<number> {
  const res = await fetch(`${BASE}/api/v3/ticker/price?symbol=${symbol}`);
  if (!res.ok) throw new Error("price fetch failed");
  const d = await res.json();
  return parseFloat(d.price);
}

export async function fetch24h(symbol = "BTCUSDT") {
  const res = await fetch(`${BASE}/api/v3/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) throw new Error("24h fetch failed");
  const d = await res.json();
  return {
    change: parseFloat(d.priceChange),
    changePercent: parseFloat(d.priceChangePercent),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
  };
}
