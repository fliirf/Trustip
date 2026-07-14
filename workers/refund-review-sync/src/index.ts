import { log } from "@trustip/config";
import { getServiceClient } from "@trustip/database";
import {
  createSupabaseRefundStore,
  PaymentError,
  resolveRefundRequest,
  type RefundDeps,
} from "@trustip/payments";
import { createEscrowGateway, networkName } from "@trustip/stellar";

/**
 * Refund Review Sync Worker (REFUND-2 heal pass).
 *
 * An admin "approve" can partially fail: approved is recorded, the on-chain
 * refund submits, then the process crashes before the DB confirm. This worker
 * converges those rows: every refund_request stuck in 'approved' whose escrow
 * is not yet 'refunded' is re-driven through the SAME service path the admin
 * route uses (`resolveRefundRequest` treats 'approved' as a legal re-entry;
 * double refund is impossible — contract InvalidStatus + RPC funded-guard).
 *
 * It never decides anything: only requests an admin already approved are
 * touched. Loop conventions mirror the escrow-event-indexer.
 */

const WORKER = "refund-review-sync";
const POLL_MS = Number(process.env.TRUSTIP_REFUND_WORKER_POLL_MS ?? 60_000);

// ponytail: synthetic system actor — resolveRefundRequest only writes
// admin_actions on the FIRST approval (status still open), which never happens
// here (we only touch rows already 'approved'), so the fake id never lands in
// a FK column. Give the worker a real users row if that ever changes.
const SYSTEM_ACTOR = { userId: "system", isAdmin: true };

async function healPass(deps: RefundDeps): Promise<void> {
  const client = getServiceClient();
  // Approved refunds whose escrow has not reached 'refunded' yet.
  const { data, error } = await client
    .from("refund_requests")
    .select("id, order_id, orders ( escrows ( status ) )")
    .eq("status", "approved");
  if (error) throw error;

  type Row = {
    id: string;
    order_id: string;
    orders: { escrows: { status: string } | null } | null;
  };
  const stuck = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.orders?.escrows?.status !== "refunded",
  );

  let healed = 0;
  for (const row of stuck) {
    try {
      const res = await resolveRefundRequest(deps, SYSTEM_ACTOR, {
        refundRequestId: row.id,
        action: "approve",
      });
      healed += 1;
      log.info("healed stuck approved refund", {
        route: WORKER,
        result: "repaired",
        refundRequestId: row.id,
        txHash: res.refundTxHash,
      });
    } catch (err) {
      // Expected while a refund is mid-flight (tx not confirmed yet) — logged
      // and retried next pass; the service only ever converges, never forks.
      log.warn("stuck refund not healable yet", {
        route: WORKER,
        result: "retry",
        refundRequestId: row.id,
        detail:
          err instanceof PaymentError
            ? `${err.code}: ${err.message}`
            : (err as Error).message,
      });
    }
  }
  log.info("heal pass complete", {
    route: WORKER,
    result: "ok",
    stuck: stuck.length,
    healed,
  });
}

async function main(): Promise<void> {
  const deps: RefundDeps = {
    store: createSupabaseRefundStore(getServiceClient()),
    gateway: createEscrowGateway(),
    config: { networkName: networkName() },
  };
  log.info("refund review worker starting", {
    route: WORKER,
    network: networkName(),
    pollMs: POLL_MS,
  });

  let stopping = false;
  const stop = () => {
    stopping = true;
    log.info("refund review worker stopping", { route: WORKER });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  while (!stopping) {
    try {
      await healPass(deps);
    } catch (err) {
      log.error("pass failed, will retry", {
        route: WORKER,
        errorClass: "unexpected",
        detail: (err as Error).message,
      });
    }
    await sleep(POLL_MS, () => stopping);
  }
  process.exit(0);
}

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const check = setInterval(() => {
      if (cancelled()) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 250);
  });
}

main().catch((err) => {
  log.error("refund review worker fatal", {
    route: WORKER,
    errorClass: "unexpected",
    detail: (err as Error).message,
  });
  process.exit(1);
});
