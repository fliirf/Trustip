/**
 * Persistent audit logging (Phase 19, Part 4). Writes to the existing
 * `audit_logs` table. Sensitive actions call `recordAuditEvent` with a stable
 * action name plus context (actor, order, wallet, request id, reason, result),
 * which is stored in `metadata`. NEVER pass secrets, raw signatures, or private
 * keys — a defensive key filter drops anything that looks like one, but callers
 * should not rely on it.
 *
 * Best-effort: a failed audit write is logged and swallowed so it can never fail
 * the primary action it is recording. Audit gaps are a monitoring signal, not a
 * user-facing error.
 */
import type { Json, TrustipClient } from "./index.js";

/** Canonical action names for the sensitive operations in Part 4. */
export type AuditAction =
  | "order.create"
  | "checkout.token_issued"
  | "payment.submitted"
  | "payment.confirmed"
  | "escrow.locked"
  | "shipment.updated"
  | "buyer.confirmed"
  | "release.requested"
  | "release.completed"
  | "worker.recovery"
  | "verification.failed"
  | "admin.action";

export type AuditActorRole = "buyer" | "seller" | "admin" | "system";

export interface AuditEvent {
  action: AuditAction;
  actorRole?: AuditActorRole;
  actorUserId?: string | null;
  /** Order (or other entity) the action concerns. */
  orderId?: string | null;
  entityType?: string;
  entityId?: string | null;
  /** Extra context: wallet public key, request id, reason, result, tx hash, … */
  wallet?: string | null;
  requestId?: string | null;
  reason?: string | null;
  result?: string | null;
  metadata?: Record<string, unknown>;
}

const SECRET_KEY = /(secret|password|token|signature|seed|private|authorization|apikey|api_key)/i;
function stripSecrets(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

export async function recordAuditEvent(
  client: TrustipClient,
  event: AuditEvent,
): Promise<void> {
  const metadata = stripSecrets({
    wallet: event.wallet ?? undefined,
    requestId: event.requestId ?? undefined,
    reason: event.reason ?? undefined,
    result: event.result ?? undefined,
    ...(event.metadata ?? {}),
  });
  const { error } = await client.from("audit_logs").insert({
    action: event.action,
    actor_role: event.actorRole ?? "system",
    actor_user_id: event.actorUserId ?? null,
    entity_type: event.entityType ?? (event.orderId ? "order" : null),
    entity_id: event.entityId ?? event.orderId ?? null,
    metadata: metadata as Json,
  });
  if (error) {
    // Do not throw — the audited action already happened. Surface for alerting.
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        severity: "error",
        message: "audit write failed",
        action: event.action,
        detail: error.message,
      }),
    );
  }
}
