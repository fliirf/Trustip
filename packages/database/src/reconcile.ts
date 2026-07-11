/**
 * Payment reconciliation (Phase 19, Part 3/9). Heals money-state drift between
 * what the chain did (recorded by the indexer in blockchain_transactions) and
 * the local payments/escrows/orders rows — the classic "crashed after the chain
 * write, before the DB write" gap.
 *
 * It repairs ONLY through the existing idempotent, status-guarded RPCs
 * (confirm_funded_payment / confirm_released_payment). Those RPCs never move a
 * row backwards or overwrite a newer state, so reconciliation cannot corrupt
 * state — at worst it is a no-op. Driven off indexed transactions (not live
 * RPC), so it is cheap and does not depend on @trustip/stellar.
 */
import type { TrustipClient, Database } from "./index.js";

type Network = Database["public"]["Enums"]["network"];

export interface ReconcileRepair {
  orderId: string;
  escrowId: string;
  kind: "funded" | "released";
  txHash: string;
}

export interface ReconcileSummary {
  scanned: number;
  repairs: ReconcileRepair[];
}

async function latestConfirmedTx(
  client: TrustipClient,
  orderId: string,
  txType: "escrow_fund" | "escrow_release",
) {
  const { data } = await client
    .from("blockchain_transactions")
    .select("tx_hash, ledger, source_account, destination_account, amount")
    .eq("order_id", orderId)
    .eq("tx_type", txType)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Scan escrows that may lag the chain and repair them idempotently. Returns the
 * repairs it actually applied (RPC reported a real transition) so the caller can
 * emit one audit event per repair. `limit` bounds the scan per run.
 */
export async function reconcilePayments(
  client: TrustipClient,
  network: Network,
  limit = 200,
): Promise<ReconcileSummary> {
  const repairs: ReconcileRepair[] = [];

  // Candidates: anything not yet in a terminal-for-its-tx state. 'created' may be
  // funded on-chain; 'funded' may be released on-chain. Repeated runs heal
  // multi-step lags (created→funded this run, funded→released the next).
  const { data: escrows, error } = await client
    .from("escrows")
    .select("id, order_id, status, buyer_public_key, amount_usdc")
    .in("status", ["created", "funded"])
    .limit(limit);
  if (error) throw new Error(`reconcile scan failed: ${error.message}`);

  const rows = escrows ?? [];
  for (const escrow of rows) {
    if (escrow.status === "created") {
      const fund = await latestConfirmedTx(client, escrow.order_id, "escrow_fund");
      if (!fund) continue;
      const { data: payment } = await client
        .from("payments")
        .select("id")
        .eq("order_id", escrow.order_id)
        .maybeSingle();
      if (!payment) continue;
      const { data: applied } = await client.rpc("confirm_funded_payment", {
        p_payment_id: payment.id,
        p_order_id: escrow.order_id,
        p_escrow_id: escrow.id,
        p_tx_hash: fund.tx_hash,
        p_ledger: (fund.ledger ?? null) as number,
        p_buyer_public_key: (escrow.buyer_public_key ?? fund.source_account) as string,
        p_amount_usdc: fund.amount ?? escrow.amount_usdc,
        p_network: network,
      });
      if (applied === true)
        repairs.push({ orderId: escrow.order_id, escrowId: escrow.id, kind: "funded", txHash: fund.tx_hash });
    } else if (escrow.status === "funded") {
      const rel = await latestConfirmedTx(client, escrow.order_id, "escrow_release");
      if (!rel) continue;
      const { data: applied } = await client.rpc("confirm_released_payment", {
        p_order_id: escrow.order_id,
        p_escrow_id: escrow.id,
        p_tx_hash: rel.tx_hash,
        p_ledger: (rel.ledger ?? null) as number,
        p_to_public_key: (rel.destination_account ?? "") as string,
        p_amount_usdc: rel.amount ?? escrow.amount_usdc,
        p_network: network,
      });
      if (applied === true)
        repairs.push({ orderId: escrow.order_id, escrowId: escrow.id, kind: "released", txHash: rel.tx_hash });
    }
  }

  return { scanned: rows.length, repairs };
}
