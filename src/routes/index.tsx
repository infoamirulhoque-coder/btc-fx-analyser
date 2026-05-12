import { createFileRoute } from "@tanstack/react-router";
import { PinLock } from "@/components/PinLock";
import { SignalDashboard } from "@/components/SignalDashboard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BTC-FX-Analyser — Pro BTC Forex Signal Bot" },
      { name: "description", content: "Live BTC/USDT trading signals with entry, SL, TP. Powered by Binance API and pro-grade confluence strategy." },
    ],
  }),
});

function Index() {
  return (
    <PinLock>
      <SignalDashboard />
    </PinLock>
  );
}
