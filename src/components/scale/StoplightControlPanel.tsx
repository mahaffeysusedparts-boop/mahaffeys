import { useEffect, useState } from "react";
import { ArrowRight, Hand, PowerOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stoplightService, type StoplightState, type StoplightStatus } from "@/services/stoplightService";

export function StoplightControlPanel() {
  const [status, setStatus] = useState<StoplightStatus>(stoplightService.getStatus());
  const [sending, setSending] = useState<StoplightState | null>(null);

  useEffect(() => stoplightService.subscribe(setStatus), []);

  const change = async (state: StoplightState, successLabel: string) => {
    setSending(state);
    try {
      await stoplightService.setState(state);
      toast.success(successLabel);
    } catch (error) {
      toast.error("Stoplight command failed", {
        description: error instanceof Error ? error.message : "The relay board did not answer.",
      });
    } finally {
      setSending(null);
    }
  };

  const redOn = status.state === "red";
  const greenOn = status.state === "green";
  const disabled = !status.configured || sending !== null;

  const relayBadge = !status.configured
    ? { label: "Not set up", className: "border border-amber-500/40 bg-amber-500/15 text-amber-300" }
    : status.relayReachable === false
      ? { label: "Relay error", className: "border border-red-500/40 bg-red-500/15 text-red-300" }
      : status.relayReachable
        ? { label: "Relay online", className: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300" }
        : { label: "Standing by", className: "border border-slate-600 bg-slate-800 text-slate-300" };

  return (
    <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
      <CardHeader className="border-b border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <span className="flex h-9 w-9 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950">
              <span className={`h-3 w-3 rounded-full transition-colors ${redOn ? "bg-red-500" : "bg-red-950"}`} />
              <span className={`h-3 w-3 rounded-full transition-colors ${greenOn ? "bg-emerald-500" : "bg-emerald-950"}`} />
            </span>
            Stoplight
          </CardTitle>
          <Badge className={relayBadge.className}>{relayBadge.label}</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Signal the driver at the scale platform — switches the red/green lights over the relay.
        </p>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-5">
          {/* Two-lamp signal head */}
          <div
            aria-hidden
            className="flex shrink-0 flex-col items-center gap-3 rounded-3xl border border-slate-700 bg-slate-950 px-4 py-5"
          >
            <span
              className={`h-14 w-14 rounded-full border-2 transition-all duration-300 ${
                redOn
                  ? "border-red-300 bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                  : "border-slate-700 bg-slate-800"
              }`}
            />
            <span
              className={`h-14 w-14 rounded-full border-2 transition-all duration-300 ${
                greenOn
                  ? "border-emerald-300 bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)]"
                  : "border-slate-700 bg-slate-800"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Showing driver</p>
            <p className={`mt-1 text-xl font-black tracking-tight ${
              redOn ? "text-red-400" : greenOn ? "text-emerald-400" : "text-slate-400"
            }`}>
              {redOn ? "HOLD — DO NOT ENTER" : greenOn ? "PULL AHEAD ONTO SCALE" : "LIGHTS OFF"}
            </p>
            {status.lastCommandAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Last switched {new Date(status.lastCommandAt).toLocaleTimeString()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          <Button
            onClick={() => void change("red", "Stoplight set to RED — hold")}
            disabled={disabled || redOn}
            className="h-12 w-full rounded-2xl bg-red-600 text-base font-black tracking-wide text-white hover:bg-red-500 disabled:opacity-60"
          >
            <Hand className="mr-2 h-5 w-5" />
            {sending === "red" ? "Switching…" : "RED — HOLD TRAFFIC"}
          </Button>
          <Button
            onClick={() => void change("green", "Stoplight set to GREEN — pull ahead")}
            disabled={disabled || greenOn}
            className="h-12 w-full rounded-2xl bg-emerald-600 text-base font-black tracking-wide text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            <ArrowRight className="mr-2 h-5 w-5" />
            {sending === "green" ? "Switching…" : "GREEN — PULL AHEAD"}
          </Button>
          <Button
            onClick={() => void change("off", "Stoplight lamps switched off")}
            disabled={disabled || status.state === "off"}
            variant="outline"
            className="h-10 w-full rounded-2xl border-slate-700 bg-slate-900 font-bold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-60"
          >
            <PowerOff className="mr-2 h-4 w-4" />
            All lights off
          </Button>
        </div>

        {!status.configured ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              No relay is configured yet. An administrator can connect the stoplight relay board on the
              <strong className="font-bold text-amber-200"> Server Admin</strong> page.
            </span>
          </div>
        ) : status.lastError ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {status.lastError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
