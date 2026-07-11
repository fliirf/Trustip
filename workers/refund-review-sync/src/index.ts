import { log } from "@trustip/config";

/**
 * Refund Review Worker (Phase 19, Part 3) — DISABLED FRAMEWORK.
 *
 * The buyer/admin refund feature is not implemented in v1.1, so this worker does
 * NOT pretend to process refunds. It stays explicitly disabled: it logs its
 * disabled state once and exits, rather than spinning a fake "checking…" loop.
 * When the refund flow lands, set TRUSTIP_REFUND_WORKER_ENABLED=true and fill in
 * `reviewRefunds` below — the loop scaffold mirrors the escrow indexer's
 * resilient pattern (checkpoint, idempotent repair, audit events).
 */

const WORKER = "refund-review-sync";
const ENABLED = process.env.TRUSTIP_REFUND_WORKER_ENABLED === "true";

async function reviewRefunds(): Promise<void> {
  // Intentionally empty: no refund state machine exists to drive yet. Do not add
  // simulated work here — a disabled worker must be honestly idle.
  throw new Error(
    "refund review worker is enabled but reviewRefunds() is not implemented",
  );
}

async function main(): Promise<void> {
  if (!ENABLED) {
    log.warn("refund review worker disabled (feature not implemented in v1.1)", {
      route: WORKER,
      result: "disabled",
    });
    process.exit(0);
  }
  log.info("refund review worker starting", { route: WORKER });
  await reviewRefunds();
}

main().catch((err) => {
  log.error("refund review worker fatal", {
    route: WORKER,
    errorClass: "unexpected",
    detail: (err as Error).message,
  });
  process.exit(1);
});
