import { describe, expect, it } from "vitest";
import { diagnosticReportSchema, redactDiagnosticText } from "./diagnosticReport";

const report = {
  id: "a163d9e2-0ed1-4a5c-9bb3-b64072b9462b",
  timestamp: "2026-10-20T13:00:00.000Z",
  level: "error",
  source: "BrowserRuntime",
  message: "Failed to render",
};

describe("browser diagnostic privacy and limits", () => {
  it("redacts common credentials and URL parameters", () => {
    const text = 'password=secret123 {"token":"token123"} Bearer eyJabc.def https://user:pass@host/api?customer=123#private';
    const sanitized = redactDiagnosticText(text, 2000);
    for (const secret of ["secret123", "token123", "eyJabc.def", "user:pass", "customer=123", "#private"]) {
      expect(sanitized).not.toContain(secret);
    }
    expect(sanitized).toContain("[REDACTED]");
  });

  it("removes private keys, terminal control characters, and bounds text", () => {
    expect(redactDiagnosticText("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----", 2000)).not.toContain("abc");
    expect(redactDiagnosticText("abc\u001bdef", 5)).toBe("abcde");
  });

  it("allows bounded error reports but rejects arbitrary context and large batches", () => {
    expect(diagnosticReportSchema.safeParse({ reports: [report] }).success).toBe(true);
    expect(diagnosticReportSchema.safeParse({ reports: [{ ...report, context: { password: "secret" } }] }).success).toBe(false);
    expect(diagnosticReportSchema.safeParse({ reports: Array(6).fill(report) }).success).toBe(false);
    expect(diagnosticReportSchema.safeParse({ reports: [{ ...report, message: "x".repeat(2001) }] }).success).toBe(false);
  });
});
