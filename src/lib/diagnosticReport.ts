import { z } from "zod";

export const diagnosticReportSchema = z.object({
  reports: z.array(z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    level: z.enum(["warn", "error"]),
    source: z.string().max(100),
    message: z.string().max(2000),
    error: z.string().max(2000).optional(),
    stack: z.string().max(4000).optional(),
    componentStack: z.string().max(2000).optional(),
    networkStatus: z.enum(["online", "offline"]).optional(),
  }).strict()).min(1).max(5),
}).strict();

export type BrowserDiagnosticReport = z.infer<typeof diagnosticReportSchema>["reports"][number];

// Do not transmit arbitrary context, request bodies, cookies, or page query strings.
export function redactDiagnosticText(text: string, limit: number): string {
  return text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s/@]+:[^\s/@]+@/gi, "[REDACTED CREDENTIALS]@")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/((?:password|passwd|secret|token|api[_-]?key|authorization|cookie)["']?\s*[=:]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/((?:https?:\/\/|\/)[^\s?#]*)(?:\?[^\s#]*)?(?:#[^\s]*)?/gi, "$1")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, limit);
}
