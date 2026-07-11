/**
 * Indexer persistence + checkpointing (Phase 19, Part 3/9). Idempotent writes so
 * the escrow event indexer can crash/restart/replay without duplicating rows or
 * losing its place. The chain-reading side lives in @trustip/stellar; this side
 * only touches Supabase, so @trustip/database stays a leaf package.
 *
 * Idempotency contract:
 *   - checkpoints: upsert on (worker, network) PK, and never move backwards.
 *   - events: insert into blockchain_transactions (tx_hash UNIQUE) and
 *     escrow_events (tx_hash UNIQUE) with on-conflict-ignore, so replaying the
 *     same event is a no-op.
 */
import type { TrustipClient, Database } from "./index.js";

type Network = Database["public"]["Enums"]["network"];
type EscrowEventType = Database["public"]["Enums"]["escrow_event_type"];
type BlockchainTxType = Database["public"]["Enums"]["blockchain_tx_type"];

export interface Checkpoint {
  lastLedger: number;
  cursor: string | null;
}

export async function getCheckpoint(
  client: TrustipClient,
  worker: string,
  network: Network,
): Promise<Checkpoint> {
  const { data, error } = await client
    .from("indexer_checkpoints")
    .select("last_ledger, cursor")
    .eq("worker", worker)
    .eq("network", network)
    .maybeSingle();
  if (error) throw new Error(`checkpoint read failed: ${error.message}`);
  return { lastLedger: data?.last_ledger ?? 0, cursor: data?.cursor ?? null };
}

/** Persist forward progress. Refuses to move `last_ledger` backwards so a
 * late/duplicate page can never rewind the checkpoint. */
export async function setCheckpoint(
  client: TrustipClient,
  worker: string,
  network: Network,
  next: Checkpoint,
): Promise<void> {
  const current = await getCheckpoint(client, worker, network);
  const lastLedger = Math.max(current.lastLedger, next.lastLedger);
  const { error } = await client.from("indexer_checkpoints").upsert(
    {
      worker,
      network,
      last_ledger: lastLedger,
      cursor: next.cursor ?? current.cursor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "worker,network" },
  );
  if (error) throw new Error(`checkpoint write failed: ${error.message}`);
}

/** Structural shape of a decoded escrow event (matches @trustip/stellar's
 * EscrowChainEvent without importing it — keeps this package stellar-free). */
export interface IndexableEscrowEvent {
  name: string;
  contractOrderIdHex: string | null;
  txHash: string;
  ledger: number;
  from: string | null;
  to: string | null;
  amount: bigint | null;
}

const EVENT_TYPE: Record<string, EscrowEventType> = {
  escrow_created: "create",
  escrow_funded: "fund",
  escrow_released: "release",
  escrow_refunded: "refund",
  escrow_cancelled: "cancel",
};
const TX_TYPE: Record<string, BlockchainTxType> = {
  escrow_created: "escrow_create",
  escrow_funded: "escrow_fund",
  escrow_released: "escrow_release",
  escrow_refunded: "escrow_refund",
  escrow_cancelled: "escrow_cancel",
};

/** Contract amounts are i128 stroops (7 dp). Render as a fixed-7 decimal string
 * for numeric(20,7) columns without floating-point loss. */
function stroopsToUsdc(amount: bigint | null): string | null {
  if (amount == null) return null;
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / 10_000_000n;
  const frac = (abs % 10_000_000n).toString().padStart(7, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export interface PersistResult {
  applied: boolean;
  reason?: string;
}

/**
 * Idempotently persist one escrow event: a blockchain_transactions row + an
 * escrow_events row, both keyed on tx_hash so replays are no-ops. Resolves the
 * local escrow by contract_order_id. Pause/unpause events carry no order and are
 * skipped here (the worker records them to the audit log instead).
 */
export async function persistEscrowEvent(
  client: TrustipClient,
  network: Network,
  event: IndexableEscrowEvent,
): Promise<PersistResult> {
  const txType = TX_TYPE[event.name];
  const eventType = EVENT_TYPE[event.name];
  if (!txType || !eventType || !event.contractOrderIdHex) {
    return { applied: false, reason: `non-order event ${event.name}` };
  }

  const { data: escrow, error: escrowErr } = await client
    .from("escrows")
    .select("id, order_id")
    .eq("contract_order_id", event.contractOrderIdHex)
    .maybeSingle();
  if (escrowErr) throw new Error(`escrow lookup failed: ${escrowErr.message}`);
  if (!escrow) {
    // Event for an order this instance has no local row for. Do NOT invent one —
    // reconciliation/ordering will catch it once the create tx is indexed.
    return { applied: false, reason: "no local escrow for contract_order_id" };
  }

  const amountUsdc = stroopsToUsdc(event.amount);

  // blockchain_transactions: tx_hash is UNIQUE → ignore on conflict.
  const { error: txErr } = await client.from("blockchain_transactions").insert({
    order_id: escrow.order_id,
    escrow_id: escrow.id,
    tx_hash: event.txHash,
    tx_type: txType,
    network,
    status: "confirmed",
    ledger: event.ledger,
    source_account: event.from,
    destination_account: event.to,
    // Send the canonical decimal STRING to PostgREST (casts string→numeric with
    // no float drift); the generated column type is `number`, hence the cast.
    amount: amountUsdc as unknown as number | null,
    asset_code: "USDC",
    confirmed_at: new Date().toISOString(),
  });
  // 23505 = unique_violation → already indexed, treat as no-op.
  if (txErr && txErr.code !== "23505")
    throw new Error(`blockchain_tx insert failed: ${txErr.message}`);

  // escrow_events: tx_hash is UNIQUE (partial) → ignore on conflict.
  const { error: evErr } = await client.from("escrow_events").insert({
    escrow_id: escrow.id,
    event_type: eventType,
    tx_hash: event.txHash,
    ledger: event.ledger,
    from_public_key: event.from,
    to_public_key: event.to,
    amount_usdc: amountUsdc as unknown as number | null,
    raw_event: { name: event.name },
  });
  if (evErr && evErr.code !== "23505")
    throw new Error(`escrow_event insert failed: ${evErr.message}`);

  const wasNew = !(txErr?.code === "23505" && evErr?.code === "23505");
  return { applied: wasNew, reason: wasNew ? undefined : "already indexed" };
}
