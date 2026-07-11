/**
 * Structured JSON logger (Part 5 — Observability). One line per event so log
 * shippers (Loki/Datadog/CloudWatch) can parse without a grep dance. Pure and
 * edge-safe: no Node builtins, so it runs in middleware, route handlers, and
 * workers alike. OpenTelemetry is intentionally NOT wired here — the shape below
 * (severity + fields + error classification) is the seam a future OTel exporter
 * plugs into without touching call sites.
 */
export type Severity = "debug" | "info" | "warn" | "error";

/**
 * Coarse error classification so dashboards can separate "our fault" from
 * "caller/chain/db hiccup" without string-matching messages. Not an HTTP status
 * — it is the *cause* bucket.
 */
export type ErrorClass =
  | "user" // malformed request from the caller
  | "validation" // failed schema/precondition
  | "business" // a rule said no (e.g. wrong status transition)
  | "chain" // Stellar RPC / contract failure
  | "database" // Supabase/Postgres failure
  | "unexpected"; // anything we did not anticipate

export interface LogFields {
  requestId?: string;
  route?: string;
  method?: string;
  /** Milliseconds; set on request-complete lines. */
  durationMs?: number;
  /** HTTP status or worker result code. */
  result?: string | number;
  errorClass?: ErrorClass;
  [key: string]: unknown;
}

function emit(severity: Severity, message: string, fields: LogFields): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    severity,
    message,
    ...redact(fields),
  });
  // stdout for info/debug, stderr for warn/error — standard 12-factor split.
  if (severity === "error" || severity === "warn") console.error(line);
  else console.log(line);
}

// Defense-in-depth: never let a secret-looking field reach a log sink even if a
// caller passes one by mistake. Keys are matched case-insensitively.
const SECRET_KEY = /(secret|password|token|signature|seed|private|authorization|apikey|api_key)/i;
function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

export const log = {
  debug: (message: string, fields: LogFields = {}) =>
    emit("debug", message, fields),
  info: (message: string, fields: LogFields = {}) =>
    emit("info", message, fields),
  warn: (message: string, fields: LogFields = {}) =>
    emit("warn", message, fields),
  error: (message: string, fields: LogFields = {}) =>
    emit("error", message, fields),
};

/** Best-effort classification for an unknown thrown value. Never throws. */
export function classifyError(err: unknown): ErrorClass {
  const name = (err as { name?: string })?.name ?? "";
  const code = String((err as { code?: unknown })?.code ?? "");
  const msg = ((err as { message?: string })?.message ?? "").toLowerCase();
  if (name === "PaymentError" || name === "StoreError") {
    // Payment/store errors already carry a code; map the common buckets.
    if (code === "InvalidInput") return "validation";
    if (code === "NotFound" || code === "Conflict" || code === "Forbidden")
      return "business";
    if (code === "Unavailable" || code === "DatabaseError") return "database";
    return "business";
  }
  if (msg.includes("rpc") || msg.includes("simulate") || msg.includes("ledger"))
    return "chain";
  if (msg.includes("postgr") || msg.includes("supabase") || msg.includes("relation"))
    return "database";
  return "unexpected";
}
