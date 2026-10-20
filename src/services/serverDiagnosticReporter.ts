import { redactDiagnosticText, type BrowserDiagnosticReport } from "@/lib/diagnosticReport";

const pending: BrowserDiagnosticReport[] = [];
let sending = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retryAfter = 0;

export function queueServerDiagnostic(log: {
  id: string;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  context?: Record<string, unknown>;
  networkStatus?: string;
}) {
  if (log.level !== "warn" && log.level !== "error") return;
  const report: BrowserDiagnosticReport = {
    id: log.id,
    timestamp: log.timestamp,
    level: log.level,
    source: redactDiagnosticText(log.source, 100),
    message: redactDiagnosticText(log.message, 2000),
    networkStatus: log.networkStatus === "offline" ? "offline" : "online",
  };
  for (const [key, limit] of [["error", 2000], ["stack", 4000], ["componentStack", 2000]] as const) {
    const value = log.context?.[key];
    if (typeof value === "string") report[key] = redactDiagnosticText(value, limit);
  }
  pending.push(report);
  if (pending.length > 50) pending.shift();
  schedule();
}

function schedule() {
  if (timer || sending || !pending.length) return;
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, Math.max(2000, retryAfter - Date.now()));
}

async function flush() {
  if (sending || !pending.length) return;
  if (!navigator.onLine) {
    retryAfter = Date.now() + 60_000;
    schedule();
    return;
  }
  sending = true;
  const batch = pending.splice(0, 5);
  try {
    const response = await fetch("/api/diagnostics/browser", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: batch }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && (response.status === 401 || response.status === 429 || response.status >= 500)) {
      pending.unshift(...batch);
      retryAfter = Date.now() + 60_000;
    } else {
      retryAfter = Date.now() + 10_000;
    }
  } catch {
    // Reporting must never interrupt the app or recursively report its own failure.
    pending.unshift(...batch);
    retryAfter = Date.now() + 60_000;
  } finally {
    if (pending.length > 50) pending.splice(0, pending.length - 50);
    sending = false;
    schedule();
  }
}
