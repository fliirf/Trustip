import {
  assertProductionConfig,
  currentNetwork,
  getEscrowContractId,
  log,
} from "@trustip/config";
import {
  getCheckpoint,
  getServiceClient,
  persistEscrowEvent,
  reconcilePayments,
  recordAuditEvent,
  setCheckpoint,
  type TrustipClient,
} from "@trustip/database";
import { getRpcServer, networkName, readEscrowEvents } from "@trustip/stellar";

/**
 * Escrow Event Indexer + Payment Reconciliation (Phase 19, Part 3/9).
 *
 * Indexer pass: reads escrow contract events from Soroban RPC, persists them
 * idempotently (blockchain_transactions + escrow_events, tx_hash unique), and
 * advances a durable checkpoint so a restart resumes instead of re-scanning.
 *
 * Reconciliation pass: heals money-state drift (payments/escrows/orders) against
 * the events the indexer recorded — the "crashed after chain, before DB write"
 * gap — via the idempotent confirm_* RPCs. Both passes are safe to re-run: every
 * write is on-conflict-ignore or status-guarded, so duplicate events, partial
 * writes, and restarts converge instead of corrupting.
 *
 * Runs both passes in one process for operational simplicity; the reconciliation
 * pass is a pure function of the DB and can be lifted into its own worker later
 * without code change.
 */

const WORKER = "escrow-event-indexer";
const POLL_MS = Number(process.env.INDEXER_POLL_MS) || 30_000;
const RECONCILE_EVERY = Number(process.env.INDEXER_RECONCILE_EVERY) || 4; // passes
// Cold-start lookback in ledgers when no checkpoint exists yet. Kept modest so
// startLedger stays inside RPC event retention.
const START_LOOKBACK = Number(process.env.INDEXER_START_LOOKBACK) || 17_280;

const network = networkName();
const contractId = getEscrowContractId();
const server = getRpcServer();

async function indexPass(client: TrustipClient): Promise<void> {
  const checkpoint = await getCheckpoint(client, WORKER, network);
  let startLedger = checkpoint.lastLedger;
  if (startLedger <= 0) {
    const latest = await server.getLatestLedger();
    startLedger = Math.max(1, latest.sequence - START_LOOKBACK);
  }

  const { events, latestLedger } = await readEscrowEvents(server, contractId, {
    startLedger,
    limit: 200,
  });

  let maxLedger = startLedger;
  let applied = 0;
  for (const event of events) {
    maxLedger = Math.max(maxLedger, event.ledger);
    if (event.name === "contract_paused" || event.name === "contract_unpaused") {
      await recordAuditEvent(client, {
        action: "admin.action",
        actorRole: "admin",
        reason: event.name,
        result: "observed",
        metadata: { txHash: event.txHash, ledger: event.ledger },
      });
      continue;
    }
    const res = await persistEscrowEvent(client, network, event);
    if (res.applied) applied += 1;
  }

  // Re-read the boundary ledger next tick (idempotent) so no event is skipped.
  const nextLedger = events.length > 0 ? maxLedger : latestLedger;
  await setCheckpoint(client, WORKER, network, {
    lastLedger: nextLedger,
    cursor: null,
  });

  log.info("index pass complete", {
    route: WORKER,
    result: "ok",
    startLedger,
    nextLedger,
    read: events.length,
    applied,
  });
}

async function reconcilePass(client: TrustipClient): Promise<void> {
  const summary = await reconcilePayments(client, network);
  for (const repair of summary.repairs) {
    await recordAuditEvent(client, {
      action: "worker.recovery",
      actorRole: "system",
      orderId: repair.orderId,
      reason: `reconcile.${repair.kind}`,
      result: "repaired",
      metadata: { escrowId: repair.escrowId, txHash: repair.txHash },
    });
  }
  log.info("reconcile pass complete", {
    route: WORKER,
    result: "ok",
    scanned: summary.scanned,
    repaired: summary.repairs.length,
  });
}

async function main(): Promise<void> {
  assertProductionConfig(); // fail closed on prod misconfig before doing any work
  const client = getServiceClient();
  log.info("indexer starting", {
    route: WORKER,
    network,
    usdc: currentNetwork.usdcAssetCode,
    pollMs: POLL_MS,
  });

  let stopping = false;
  const stop = () => {
    stopping = true;
    log.info("indexer stopping", { route: WORKER });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  let pass = 0;
  // Resilient loop: any pass failure is logged and retried next tick — a
  // transient RPC/DB blip never advances the checkpoint or crashes the process.
  while (!stopping) {
    try {
      await indexPass(client);
      if (pass % RECONCILE_EVERY === 0) await reconcilePass(client);
    } catch (err) {
      log.error("pass failed, will retry", {
        route: WORKER,
        errorClass: "unexpected",
        detail: (err as Error).message,
      });
    }
    pass += 1;
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
    // ponytail: 250ms shutdown-poll granularity is plenty for a background worker.
  });
}

main().catch((err) => {
  log.error("indexer fatal", {
    route: WORKER,
    errorClass: "unexpected",
    detail: (err as Error).message,
  });
  process.exit(1);
});
