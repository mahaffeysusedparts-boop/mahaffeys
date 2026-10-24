import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createError } from "nitro/h3";
import { query } from "./db";

const execFileAsync = promisify(execFile);
const HOST_PATTERN = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?)$/;
const QUEUE_PATH_PATTERN = /^\/[a-zA-Z0-9_./-]{1,180}$/;

type PrinterKind = "standard" | "sticker";
interface PrinterRow {
  id: string;
  name: string;
  host: string;
  queue: string;
  kind: PrinterKind;
  created_at: Date | string;
}

export interface NetworkPrinter {
  id: string;
  name: string;
  host: string;
  kind: PrinterKind;
  createdAt: string;
}

function toPublicPrinter(row: PrinterRow): NetworkPrinter {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    kind: row.kind,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function cupsEnv() {
  return process.env;
}

async function runCups(program: string, args: string[]) {
  try {
    const server = process.env.NITRO_CUPS_SERVER;
    const serverArgs = server ? ["-h", server] : [];
    // Local PeerCred requires the CUPS username to match the executing UID.
    return await execFileAsync(program, [...serverArgs, ...args], {
      env: { ...cupsEnv(), LC_ALL: "C", CUPS_USER: userInfo().username },
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const failure = error as { code?: string; killed?: boolean; stderr?: string; message?: string } | null;
    // execFile messages include command arguments; never return them to the browser.
    const detail = String(failure?.stderr || failure?.message || "").slice(0, 8192);
    console.error("[printer-diagnostic] " + JSON.stringify({ operation: program, failed: true, timedOut: Boolean(failure?.killed) }));
    if (failure?.code === "ENOENT") {
      throw createError({ statusCode: 503, statusMessage: "CUPS client tools are not installed on the application server" });
    }
    if (/forbidden|unauthori[sz]ed|not[- ]authori[sz]ed|authori[sz]ation (?:failed|cancell?ed)|authentication (?:failed|required)|password for/i.test(detail)) {
      throw createError({ statusCode: 502, statusMessage: "The server printing identity is not authorized by CUPS. Ask the server administrator to verify the deployed identity and CUPS administration/access policy. Do not change the printer address to fix authorization." });
    }
    if (failure?.killed) {
      throw createError({ statusCode: 504, statusMessage: "CUPS did not complete the request within 30 seconds. Ask the server administrator to check scheduler and printer connectivity." });
    }
    if (failure?.code === "EACCES" || /permission denied/i.test(detail)) {
      throw createError({ statusCode: 502, statusMessage: "The application cannot access the CUPS client or connection. Ask the server administrator to check the printing identity and socket permissions." });
    }
    if (/unable to connect|connection refused|host is down|no such file or directory/i.test(detail)) {
      throw createError({ statusCode: 502, statusMessage: "The application cannot connect to the CUPS scheduler. Ask the server administrator to check the configured CUPS transport and service." });
    }
    if (/unable to query printer|unable to get.*attributes|ipp.*(?:failed|error)|does not support.*ipp/i.test(detail)) {
      throw createError({ statusCode: 502, statusMessage: "CUPS could not negotiate IPP with the printer. Ask the server administrator to verify printer reachability and IPP support separately from CUPS authorization." });
    }
    throw createError({ statusCode: 502, statusMessage: "CUPS could not complete the request. Ask the server administrator to inspect the CUPS logs; queue setup is not proof of physical printing." });
  }
}

export async function listNetworkPrinters(): Promise<NetworkPrinter[]> {
  const result = await query<PrinterRow>("SELECT id, name, host, queue, kind, created_at FROM network_printers ORDER BY name");
  return result.rows.map(toPublicPrinter);
}

export async function addNetworkPrinter(input: {
  name?: string;
  host?: string;
  queuePath?: string;
  kind?: string;
}): Promise<NetworkPrinter> {
  const name = (input.name || "").trim().slice(0, 80);
  const host = (input.host || "").trim();
  const queuePath = (input.queuePath || "/ipp/print").trim();
  const kind = input.kind;
  if (!name) throw createError({ statusCode: 400, statusMessage: "Enter a printer name" });
  if (!HOST_PATTERN.test(host) || (host.match(/\./g)?.length === 3 && host.split(".").some((part) => Number(part) > 255))) {
    throw createError({ statusCode: 400, statusMessage: "Enter a valid printer IP address or hostname" });
  }
  if (!QUEUE_PATH_PATTERN.test(queuePath) || queuePath.includes("..")) {
    throw createError({ statusCode: 400, statusMessage: "Enter a valid IPP queue path, such as /ipp/print" });
  }
  if (kind !== "standard" && kind !== "sticker") {
    throw createError({ statusCode: 400, statusMessage: "Choose a standard or sticker printer" });
  }

  const id = randomUUID();
  const queue = `yard_${id.replaceAll("-", "")}`;
  await runCups("lpadmin", ["-p", queue, "-E", "-v", `ipp://${host}:631${queuePath}`, "-m", "everywhere"]);
  const inserted = await query<PrinterRow>(
    "INSERT INTO network_printers (id, name, host, queue, kind, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, name, host, queue, kind, created_at",
    [id, name, host, queue, kind],
  );
  return toPublicPrinter(inserted.rows[0]);
}

export async function removeNetworkPrinter(id: string) {
  const result = await query<PrinterRow>("SELECT id, name, host, queue, kind, created_at FROM network_printers WHERE id = $1", [id]);
  const printer = result.rows[0];
  if (!printer) throw createError({ statusCode: 404, statusMessage: "Printer not found" });
  await runCups("lpadmin", ["-x", printer.queue]);
  await query("DELETE FROM network_printers WHERE id = $1", [id]);
  return { removed: true };
}

function cleanHtml(html: string) {
  return html
    .replace(/<(script|iframe|object|embed|base|form|input|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|iframe|object|embed|base|form|input|button)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:src|href)\s*=\s*(["'])\s*(?:javascript:|https?:\/\/|\/\/)[\s\S]*?\1/gi, "")
    .replace(/@import\s+(?:url\([^)]*\)|[^;]+);?/gi, "");
}

export async function submitPrintJob(printerId: string, html: string) {
  if (html.length > 15_000_000) throw createError({ statusCode: 413, statusMessage: "Print document is too large" });
  const result = await query<PrinterRow>("SELECT id, name, queue FROM network_printers WHERE id = $1", [printerId]);
  const printer = result.rows[0];
  if (!printer) throw createError({ statusCode: 404, statusMessage: "Choose a configured network printer" });

  const directory = await mkdtemp(join(tmpdir(), "mahaffeys-print-"));
  const htmlPath = join(directory, "document.html");
  const pdfPath = join(directory, "document.pdf");
  try {
    const document = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:0.35in}*{box-sizing:border-box}</style></head><body>${cleanHtml(html)}</body></html>`;
    await writeFile(htmlPath, document, { mode: 0o600 });
    try {
      await execFileAsync("/usr/bin/chromium", [
        "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
        "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`,
      ], { timeout: 45_000, maxBuffer: 2 * 1024 * 1024, env: cupsEnv() });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown rendering error";
      if (detail.includes("ENOENT")) {
        throw createError({ statusCode: 503, statusMessage: "Chromium PDF printing is not installed on the application server" });
      }
      throw createError({ statusCode: 500, statusMessage: `Could not render the print document: ${detail.slice(0, 300)}` });
    }
    const pdf = await readFile(pdfPath);
    if (pdf.length < 5 || pdf.toString("ascii", 0, 5) !== "%PDF-") {
      throw createError({ statusCode: 500, statusMessage: "Print document could not be converted to PDF" });
    }
    await runCups("lp", ["-d", printer.queue, "-o", "fit-to-page", "-o", "print-color-mode=color", pdfPath]);
    return { queued: true, printer: printer.name };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
