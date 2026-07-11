import { log } from "@trustip/config";

/**
 * Payout Sync Worker — DISABLED FRAMEWORK (out of Phase 19 scope).
 *
 * Seller payout route sync (USDC / XLM / MoneyGram) is a future feature. Like
 * the refund worker, it stays honestly idle instead of spinning a fake loop:
 * it logs its disabled state and exits. Enable + implement `syncPayouts` when
 * the payout flow lands (TRUSTIP_PAYOUT_WORKER_ENABLED=true).
 */

const WORKER = "payout-sync";
const ENABLED = process.env.TRUSTIP_PAYOUT_WORKER_ENABLED === "true";

async function syncPayouts(): Promise<void> {
  throw new Error(
    "payout sync worker is enabled but syncPayouts() is not implemented",
  );
}

async function main(): Promise<void> {
  if (!ENABLED) {
    log.warn("payout sync worker disabled (feature not implemented in v1.1)", {
      route: WORKER,
      result: "disabled",
    });
    process.exit(0);
  }
  log.info("payout sync worker starting", { route: WORKER });
  await syncPayouts();
}

main().catch((err) => {
  log.error("payout sync worker fatal", {
    route: WORKER,
    errorClass: "unexpected",
    detail: (err as Error).message,
  });
  process.exit(1);
});
