import { useEffect, useRef, memo } from "react";

interface Props {
  symbol: string; // e.g. "BTCUSDT"
  interval?: string; // TradingView interval, default "5"
  height?: number;
}

function TradingViewChartBase({ symbol, interval = "5", height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = `${height}px`;
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: false,
      width: "100%",
      height,
      symbol: `BINANCE:${symbol}`,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      details: false,
      hotlist: false,
      calendar: false,
      studies: ["STD;EMA", "STD;RSI"],
      backgroundColor: "rgba(10,12,20,0)",
      gridColor: "rgba(120,130,160,0.08)",
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval, height]);

  return (
    <div className="bg-card/60 backdrop-blur rounded-xl p-2 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {symbol} • TradingView Live • {interval}m
        </span>
        <span className="text-[10px] font-mono text-bull animate-pulse">● LIVE</span>
      </div>
      <div ref={containerRef} className="tradingview-widget-container" style={{ height }} />
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartBase);
