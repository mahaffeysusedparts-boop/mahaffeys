import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const log = {
  id: "a163d9e2-0ed1-4a5c-9bb3-b64072b9462b",
  timestamp: "2026-10-20T13:00:00.000Z",
  level: "error",
  source: "Test",
  message: "password=secret123",
  context: { error: "Failed", stack: "at render", customer: "must not upload" },
};

describe("server diagnostic reporter", () => {
  it("only sends warnings/errors and omits arbitrary context", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { queueServerDiagnostic } = await import("./serverDiagnosticReporter");
    queueServerDiagnostic({ ...log, level: "info" });
    queueServerDiagnostic(log);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/diagnostics/browser");
    expect(request.credentials).toBe("same-origin");
    expect(request.body).not.toContain("secret123");
    expect(request.body).not.toContain("must not upload");
    expect(JSON.parse(request.body).reports[0].stack).toBe("at render");
  });

  it("retries unauthorized delivery after one minute without losing the batch", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { queueServerDiagnostic } = await import("./serverDiagnosticReporter");
    queueServerDiagnostic(log);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });

  it("does not send offline and caps pending reports", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { queueServerDiagnostic } = await import("./serverDiagnosticReporter");
    for (let index = 0; index < 60; index++) queueServerDiagnostic({ ...log, message: `failure ${index}` });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal("navigator", { onLine: true });
    await vi.advanceTimersByTimeAsync(60_000);
    const reports = JSON.parse(fetchMock.mock.calls[0][1].body).reports;
    expect(reports).toHaveLength(5);
    expect(reports[0].message).toBe("failure 10");
  });
});
