import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Lightbulb, PlugZap, RefreshCw, Save, Signal, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stoplightService, type StoplightState } from "@/services/stoplightService";

type StoplightPresetValue = "tasmota" | "shelly_gen1" | "shelly_gen2" | "custom";

interface StoplightAdminConfig {
  preset: StoplightPresetValue;
  host: string;
  redChannel: number;
  greenChannel: number;
  username?: string;
  hasPassword?: boolean;
  redOnUrl?: string;
  redOffUrl?: string;
  greenOnUrl?: string;
  greenOffUrl?: string;
}

interface StoplightAdminSnapshot {
  config: StoplightAdminConfig | null;
  status: {
    configured: boolean;
    state: StoplightState;
    relayReachable: boolean | null;
    lastError?: string;
    lastCommandAt?: string;
    updatedAt: string;
  };
  presets: Array<{ value: StoplightPresetValue; label: string; urlExample: string }>;
  checkedAt: string;
}

const PRESET_LABELS: Record<StoplightPresetValue, string> = {
  tasmota: "Tasmota",
  shelly_gen1: "Shelly Gen 1",
  shelly_gen2: "Shelly Gen 2 / Plus",
  custom: "Custom HTTP URLs",
};

const CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8];

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
  return body?.statusMessage || body?.message || fallback;
}

export function StoplightServerManager() {
  const [snapshot, setSnapshot] = useState<StoplightAdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [switching, setSwitching] = useState<StoplightState | null>(null);

  const [preset, setPreset] = useState<StoplightPresetValue>("tasmota");
  const [host, setHost] = useState("");
  const [redChannel, setRedChannel] = useState("1");
  const [greenChannel, setGreenChannel] = useState("2");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customUrls, setCustomUrls] = useState({ redOn: "", redOff: "", greenOn: "", greenOff: "" });

  const applySnapshot = useCallback((next: StoplightAdminSnapshot) => {
    setSnapshot(next);
    if (next.config) {
      setPreset(next.config.preset);
      setHost(next.config.host);
      setRedChannel(String(next.config.redChannel));
      setGreenChannel(String(next.config.greenChannel));
      setUsername(next.config.username ?? "");
      setPassword("");
      setCustomUrls({
        redOn: next.config.redOnUrl ?? "",
        redOff: next.config.redOffUrl ?? "",
        greenOn: next.config.greenOnUrl ?? "",
        greenOff: next.config.greenOffUrl ?? "",
      });
    }
  }, []);

  const loadStoplight = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin/stoplight", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response, "Unable to inspect the stoplight relay"));
      applySnapshot(await response.json() as StoplightAdminSnapshot);
    } catch (error) {
      if (!quiet) toast.error("Stoplight status unavailable", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void loadStoplight();
    const interval = window.setInterval(() => void loadStoplight(true), 5_000);
    return () => window.clearInterval(interval);
  }, [loadStoplight]);

  const saveConnection = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        preset,
        host: host.trim(),
        redChannel: Number(redChannel),
        greenChannel: Number(greenChannel),
        username: username.trim(),
        password,
      };
      if (preset === "custom") {
        body.redOnUrl = customUrls.redOn.trim();
        body.redOffUrl = customUrls.redOff.trim();
        body.greenOnUrl = customUrls.greenOn.trim();
        body.greenOffUrl = customUrls.greenOff.trim();
      }

      const response = await fetch("/api/admin/stoplight/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not activate the stoplight relay"));
      toast.success("Stoplight relay activated", {
        description: `${PRESET_LABELS[preset]} board at ${host.trim()} — both lamps set to a safe OFF.`,
      });
      setPassword("");
      await loadStoplight(true);
    } catch (error) {
      toast.error("Stoplight configuration failed", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/admin/stoplight/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(await readError(response, "The test sequence failed"));
      toast.success("Test sequence complete", { description: "Red and green each lit for about a second." });
      await Promise.all([loadStoplight(true), stoplightService.refresh()]);
    } catch (error) {
      toast.error("Stoplight test failed", {
        description: error instanceof Error ? error.message : "Unknown server error",
      });
    } finally {
      setTesting(false);
    }
  };

  const quickSwitch = async (state: StoplightState, label: string) => {
    setSwitching(state);
    try {
      await stoplightService.setState(state);
      toast.success(label);
      await loadStoplight(true);
    } catch (error) {
      toast.error("Stoplight command failed", {
        description: error instanceof Error ? error.message : "The relay board did not answer.",
      });
    } finally {
      setSwitching(null);
    }
  };

  const presetExample = snapshot?.presets.find((option) => option.value === preset)?.urlExample;
  const stateLabel = snapshot?.status.state === "red" ? "RED" : snapshot?.status.state === "green" ? "GREEN" : "OFF";
  const busy = saving || testing || switching !== null;

  const canSave = host.trim().length > 0
    && redChannel !== greenChannel
    && (preset !== "custom" || [customUrls.redOn, customUrls.redOff, customUrls.greenOn, customUrls.greenOff].every((value) => value.trim().length > 0));

  return (
    <section className="mt-5">
      <Card className="overflow-hidden rounded-3xl border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
        <CardHeader className="gap-4 border-b border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PlugZap className="h-5 w-5 text-emerald-400" /> Stoplight relay output
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Drive the red/green scale stoplight through a WiFi or Ethernet relay board with an HTTP API.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadStoplight()} disabled={loading || busy} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button onClick={() => void runTest()} disabled={loading || busy || !snapshot?.status.configured} className="rounded-xl bg-sky-500 font-bold text-slate-950 hover:bg-sky-400">
              <Lightbulb className={`mr-2 h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "Flashing lights…" : "Run test sequence"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5 sm:p-6">
          {snapshot?.status.lastError ? (
            <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <span>{snapshot.status.lastError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Current state + quick switches */}
            <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Live signal state</p>
                  <p className={`mt-2 text-2xl font-black tracking-tight ${
                    snapshot?.status.state === "red" ? "text-red-400" : snapshot?.status.state === "green" ? "text-emerald-400" : "text-slate-300"
                  }`}>
                    {stateLabel}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {snapshot?.config ? `${PRESET_LABELS[snapshot.config.preset]} · ${snapshot.config.host}` : "No relay configured"}
                  </p>
                </div>
                <Badge className={`rounded-full border ${
                  snapshot?.status.relayReachable
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : snapshot?.status.relayReachable === false
                      ? "border-red-500/40 bg-red-500/15 text-red-300"
                      : "border-slate-600 bg-slate-800 text-slate-300"
                }`}>
                  {snapshot?.status.relayReachable ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Relay online</>
                    : snapshot?.status.relayReachable === false ? "Relay unreachable"
                    : <><Signal className="mr-1 h-3 w-3" /> Standing by</>}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button onClick={() => void quickSwitch("red", "Stoplight set to RED")} disabled={busy || !snapshot?.status.configured} className="rounded-xl bg-red-600 font-bold text-white hover:bg-red-500">
                  {switching === "red" ? "…" : "Red"}
                </Button>
                <Button onClick={() => void quickSwitch("green", "Stoplight set to GREEN")} disabled={busy || !snapshot?.status.configured} className="rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500">
                  {switching === "green" ? "…" : "Green"}
                </Button>
                <Button onClick={() => void quickSwitch("off", "Stoplight lamps off")} disabled={busy || !snapshot?.status.configured} variant="outline" className="rounded-xl border-slate-700 bg-slate-900 font-bold text-slate-300 hover:bg-slate-800 hover:text-white">
                  {switching === "off" ? "…" : "Off"}
                </Button>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Saving a configuration always parks both lamps OFF first. The scale desk gets Red/Green buttons from the
                intake weighing screen.
              </p>
            </div>

            {/* Configuration form */}
            <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Relay board type</Label>
                  <Select value={preset} onValueChange={(value) => setPreset(value as StoplightPresetValue)} disabled={busy}>
                    <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {Object.entries(PRESET_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Relay IP or hostname</Label>
                  <Input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.1.75" disabled={busy} className="rounded-xl border-slate-700 bg-slate-900 font-mono text-slate-100" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Red light relay #</Label>
                  <Select value={redChannel} onValueChange={setRedChannel} disabled={busy}>
                    <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {CHANNELS.map((channel) => <SelectItem key={channel} value={String(channel)}>Relay {channel}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Green light relay #</Label>
                  <Select value={greenChannel} onValueChange={setGreenChannel} disabled={busy}>
                    <SelectTrigger className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                      {CHANNELS.map((channel) => <SelectItem key={channel} value={String(channel)}>Relay {channel}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Username (optional)</Label>
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" disabled={busy} className="rounded-xl border-slate-700 bg-slate-900 text-slate-100" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-400">Password (optional)</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={snapshot?.config?.hasPassword ? "Saved — leave blank to keep" : "none"}
                    disabled={busy}
                    className="rounded-xl border-slate-700 bg-slate-900 text-slate-100"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {preset === "custom" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([["redOn", "Red ON URL"], ["redOff", "Red OFF URL"], ["greenOn", "Green ON URL"], ["greenOff", "Green OFF URL"]] as const).map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs text-slate-400">{label}</Label>
                      <Input
                        value={customUrls[key]}
                        onChange={(event) => setCustomUrls((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="http://{host}/relay/{ch}?on=1"
                        disabled={busy}
                        className="rounded-xl border-slate-700 bg-slate-900 font-mono text-xs text-slate-100"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] leading-relaxed text-slate-500 sm:col-span-2">
                    <strong className="text-slate-400">{"{host}"}</strong> becomes the relay IP and <strong className="text-slate-400">{"{ch}"}</strong> becomes that light's relay number.
                  </p>
                </div>
              ) : presetExample ? (
                <p className="mt-3 break-all rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[11px] text-slate-400">
                  Example command: {presetExample}
                </p>
              ) : null}

              <Button onClick={() => void saveConnection()} disabled={!canSave || busy} className="mt-4 w-full rounded-xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
                <Save className={`mr-2 h-4 w-4 ${saving ? "animate-pulse" : ""}`} />
                {saving ? "Testing & activating…" : "Save & activate relay"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
