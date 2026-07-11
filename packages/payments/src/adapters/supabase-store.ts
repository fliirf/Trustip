import type { Json, TablesInsert, TrustipClient } from "@trustip/database";
import { unwrap } from "../errors.js";
import { usdcAmountToString } from "../money.js";
import type {
  CheckoutLinkForOrder,
  CheckoutOrderForIssuance,
  EscrowRecord,
  NetworkName,
  OrderRecord,
  PaymentContext,
  PaymentRecord,
  PaymentStore,
} from "../ports.js";

const UNIQUE_VIOLATION = "23505";

/**
 * Write a USDC amount to a `numeric` column as a canonical decimal STRING (never
 * via `Number()`), preserving precision end-to-end. PostgREST accepts a string
 * for a numeric column. The generated Insert types expect `number`, so we cast
 * at the boundary only.
 */
function moneyValue(amount: string): number {
  return usdcAmountToString(amount) as unknown as number;
}

type OrderRow = {
  id: string;
  status: OrderRecord["status"];
  total_usdc: number;
  buyer_user_id: string | null;
  seller_profile_id: string;
  buyer_wallet_id: string | null;
  seller_wallet_id: string | null;
};

type PaymentRow = {
  id: string;
  order_id: string;
  status: PaymentRecord["status"];
  amount_usdc: number;
  network: NetworkName;
  payer_public_key: string | null;
  tx_hash: string | null;
  ledger: number | null;
  confirmed_at: string | null;
};

type EscrowRow = {
  id: string;
  order_id: string;
  status: EscrowRecord["status"];
  contract_id: string | null;
  contract_order_id: string | null;
  amount_usdc: number;
  buyer_public_key: string | null;
  seller_public_key: string | null;
  funded_tx_hash: string | null;
};

function toOrderRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    status: row.status,
    totalUsdc: money(row.total_usdc),
    buyerUserId: row.buyer_user_id,
    sellerProfileId: row.seller_profile_id,
    buyerWalletId: row.buyer_wallet_id,
    sellerWalletId: row.seller_wallet_id,
  };
}

function money(value: number): string {
  return usdcAmountToString(value);
}

function toPaymentRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    amountUsdc: money(row.amount_usdc),
    network: row.network,
    payerPublicKey: row.payer_public_key,
    txHash: row.tx_hash,
    ledger: row.ledger,
    confirmedAt: row.confirmed_at,
  };
}

function toEscrowRecord(row: EscrowRow): EscrowRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    contractId: row.contract_id,
    contractOrderId: row.contract_order_id,
    amountUsdc: money(row.amount_usdc),
    buyerPublicKey: row.buyer_public_key,
    sellerPublicKey: row.seller_public_key,
    fundedTxHash: row.funded_tx_hash,
  };
}

/**
 * Pick the seller payout wallet from the seller's VERIFIED wallets on the
 * target network (the query pre-filters user/network/verified). Deterministic
 * and fail-closed: exactly one primary wins; with no primary, a single wallet
 * wins; anything ambiguous (several primaries, or several non-primaries)
 * returns null rather than guessing an on-chain payout recipient.
 */
export function pickSellerWalletId(
  wallets: ReadonlyArray<{ id: string; is_primary: boolean }>,
): string | null {
  const primaries = wallets.filter((w) => w.is_primary);
  if (primaries.length === 1) return primaries[0]!.id;
  if (primaries.length === 0 && wallets.length === 1) return wallets[0]!.id;
  return null;
}

/**
 * Supabase-backed PaymentStore. Uses the service-role client (server-only) so
 * it can write the money/escrow tables that clients cannot (RLS deny). All
 * writes are idempotent and status-guarded, with unique constraints on tx
 * hashes as the final backstop against double-processing.
 */
export function createSupabasePaymentStore(
  client: TrustipClient,
): PaymentStore {
  async function buildContext(order: OrderRow): Promise<PaymentContext> {
    const [paymentResult, escrowResult] = await Promise.all([
      client
        .from("payments")
        .select(
          "id, order_id, status, amount_usdc, network, payer_public_key, tx_hash, ledger, confirmed_at",
        )
        .eq("order_id", order.id)
        .maybeSingle(),
      client
        .from("escrows")
        .select(
          "id, order_id, status, contract_id, contract_order_id, amount_usdc, buyer_public_key, seller_public_key, funded_tx_hash",
        )
        .eq("order_id", order.id)
        .maybeSingle(),
    ]);
    const payment = unwrap(paymentResult);
    const escrow = unwrap(escrowResult);

    const buyerWalletPublicKey = await walletPublicKey(order.buyer_wallet_id);
    const sellerWalletPublicKey = await walletPublicKey(order.seller_wallet_id);

    return {
      order: toOrderRecord(order),
      payment: payment ? toPaymentRecord(payment as PaymentRow) : null,
      escrow: escrow ? toEscrowRecord(escrow as EscrowRow) : null,
      buyerWalletPublicKey,
      sellerWalletPublicKey,
    };
  }

  async function walletPublicKey(
    walletId: string | null,
  ): Promise<string | null> {
    if (!walletId) return null;
    const data = unwrap(
      await client
        .from("user_wallets")
        .select("public_key")
        .eq("id", walletId)
        .maybeSingle(),
    );
    return data?.public_key ?? null;
  }

  return {
    async loadByOrderId(orderId) {
      const order = unwrap(
        await client
          .from("orders")
          .select(
            "id, status, total_usdc, buyer_user_id, seller_profile_id, buyer_wallet_id, seller_wallet_id",
          )
          .eq("id", orderId)
          .maybeSingle(),
      );
      if (!order) return null;
      return buildContext(order as OrderRow);
    },

    async loadByPaymentId(paymentId) {
      const payment = unwrap(
        await client
          .from("payments")
          .select("order_id")
          .eq("id", paymentId)
          .maybeSingle(),
      );
      if (!payment) return null;
      const order = unwrap(
        await client
          .from("orders")
          .select(
            "id, status, total_usdc, buyer_user_id, seller_profile_id, buyer_wallet_id, seller_wallet_id",
          )
          .eq("id", payment.order_id)
          .maybeSingle(),
      );
      if (!order) return null;
      return buildContext(order as OrderRow);
    },

    async loadCheckoutOrderForIssuance({
      slug,
      orderNo,
    }): Promise<CheckoutOrderForIssuance | null> {
      // Resolve the checkout link by its PUBLIC slug first, then the order by its
      // PUBLIC order_no, and require the order to actually belong to that link.
      // A raw order UUID can never satisfy this (no UUID is accepted), and an
      // order_no from a different link is rejected by the linkage check.
      const link = unwrap(
        await client
          .from("checkout_links")
          .select("id, status, expires_at")
          .eq("slug", slug)
          .maybeSingle(),
      );
      if (!link) return null;

      const order = unwrap(
        await client
          .from("orders")
          .select("id, order_no, status, total_usdc, checkout_link_id")
          .eq("order_no", orderNo)
          .maybeSingle(),
      );
      if (!order || order.checkout_link_id !== link.id) return null;

      return {
        orderId: order.id,
        orderNo: order.order_no,
        orderStatus: order.status,
        totalUsdc: money(order.total_usdc),
        linkStatus: link.status,
        linkExpiresAt: link.expires_at,
      };
    },

    async loadCheckoutLinkBySlug(slug): Promise<CheckoutLinkForOrder | null> {
      const link = unwrap(
        await client
          .from("checkout_links")
          .select(
            "id, seller_profile_id, title, price_usdc, price_idr_reference, status, expires_at",
          )
          .eq("slug", slug)
          .maybeSingle(),
      );
      if (!link) return null;
      return {
        id: link.id,
        sellerProfileId: link.seller_profile_id,
        title: link.title,
        priceUsdc: money(link.price_usdc),
        // numeric(20,2) display reference — 2-decimal string, no exponent.
        priceIdrReference:
          link.price_idr_reference === null
            ? null
            : link.price_idr_reference.toFixed(2),
        status: link.status,
        expiresAt: link.expires_at,
      };
    },

    async resolveSellerWalletId({ sellerProfileId, network }) {
      const profile = unwrap(
        await client
          .from("seller_profiles")
          .select("user_id")
          .eq("id", sellerProfileId)
          .maybeSingle(),
      );
      if (!profile) return null;

      const wallets = unwrap(
        await client
          .from("user_wallets")
          .select("id, is_primary")
          .eq("user_id", profile.user_id)
          .eq("network", network)
          .not("verified_at", "is", null),
      );
      return pickSellerWalletId(wallets ?? []);
    },

    async insertCheckoutOrder(input) {
      const orderRow: TablesInsert<"orders"> = {
        order_no: input.orderNo,
        checkout_link_id: input.checkoutLinkId,
        seller_profile_id: input.sellerProfileId,
        seller_wallet_id: input.sellerWalletId,
        status: "awaiting_payment",
        total_usdc: moneyValue(input.totalUsdc),
        total_idr_reference:
          input.totalIdrReference === null
            ? null
            : (input.totalIdrReference as unknown as number),
      };
      const { data: order, error } = await client
        .from("orders")
        .insert(orderRow)
        .select("id, order_no")
        .single();
      if (error) {
        // order_no is the only unique constraint hit by this insert — signal a
        // collision so the service retries with a fresh order_no.
        if (error.code === UNIQUE_VIOLATION) return null;
        throw error;
      }

      const itemRow: TablesInsert<"order_items"> = {
        order_id: order.id,
        name: input.item.name,
        quantity: input.item.quantity,
        unit_price_usdc: moneyValue(input.item.unitPriceUsdc),
        subtotal_usdc: moneyValue(input.item.subtotalUsdc),
        metadata: input.item.metadata as Json,
      };
      const { error: itemError } = await client
        .from("order_items")
        .insert(itemRow);
      if (itemError) {
        // Best-effort rollback: an awaiting_payment order without its item row
        // is never payable UI-wise; remove it so no dangling order remains.
        await client.from("orders").delete().eq("id", order.id);
        throw itemError;
      }
      return { orderId: order.id, orderNo: order.order_no };
    },

    async preparePaymentRow(input) {
      const existing = await client
        .from("payments")
        .select(
          "id, order_id, status, amount_usdc, network, payer_public_key, tx_hash, ledger, confirmed_at",
        )
        .eq("order_id", input.orderId)
        .maybeSingle();
      // Never reset a payment that already progressed past signing.
      if (
        existing.data &&
        (existing.data.status === "submitted" ||
          existing.data.status === "confirmed")
      ) {
        return toPaymentRecord(existing.data as PaymentRow);
      }

      const row: TablesInsert<"payments"> = {
        order_id: input.orderId,
        status: "awaiting_signature",
        method: "stellar_wallet",
        asset_code: "USDC",
        network: input.network,
        amount_usdc: moneyValue(input.amountUsdc),
        payer_public_key: input.payerPublicKey,
      };
      const { data, error } = await client
        .from("payments")
        .upsert(row, { onConflict: "order_id" })
        .select(
          "id, order_id, status, amount_usdc, network, payer_public_key, tx_hash, ledger, confirmed_at",
        )
        .single();
      if (error) throw error;
      return toPaymentRecord(data as PaymentRow);
    },

    async linkEscrowRow(input) {
      const existing = await client
        .from("escrows")
        .select(
          "id, order_id, status, contract_id, contract_order_id, amount_usdc, buyer_public_key, seller_public_key, funded_tx_hash",
        )
        .eq("order_id", input.orderId)
        .maybeSingle();
      // Never downgrade an escrow that already reached a terminal/funded state.
      if (
        existing.data &&
        (existing.data.status === "funded" ||
          existing.data.status === "released" ||
          existing.data.status === "refunded")
      ) {
        return toEscrowRecord(existing.data as EscrowRow);
      }

      const row: TablesInsert<"escrows"> = {
        order_id: input.orderId,
        status: input.onChainStatus,
        asset_code: "USDC",
        amount_usdc: moneyValue(input.amountUsdc),
        contract_id: input.contractId,
        contract_order_id: input.contractOrderId,
        buyer_public_key: input.buyerPublicKey,
        seller_public_key: input.sellerPublicKey,
      };
      const { data, error } = await client
        .from("escrows")
        .upsert(row, { onConflict: "order_id" })
        .select(
          "id, order_id, status, contract_id, contract_order_id, amount_usdc, buyer_public_key, seller_public_key, funded_tx_hash",
        )
        .single();
      if (error) throw error;
      return toEscrowRecord(data as EscrowRow);
    },

    async findPaymentByTxHash(txHash) {
      // This is the DuplicateTx guard. A swallowed store error here reads as
      // "no payment with that hash" and waves a replay through to the unique
      // constraint; fail loudly instead.
      const data = unwrap(
        await client
          .from("payments")
          .select(
            "id, order_id, status, amount_usdc, network, payer_public_key, tx_hash, ledger, confirmed_at",
          )
          .eq("tx_hash", txHash)
          .maybeSingle(),
      );
      return data ? toPaymentRecord(data as PaymentRow) : null;
    },

    async recordSubmission(input) {
      // Only set tx_hash when not already set, so concurrent submits for the
      // same payment cannot orphan an earlier on-chain tx.
      await client
        .from("payments")
        .update({ status: "submitted", tx_hash: input.txHash })
        .eq("id", input.paymentId)
        .in("status", ["pending", "awaiting_signature"])
        .is("tx_hash", null);

      await client
        .from("orders")
        .update({ status: "payment_submitted" })
        .eq("id", input.orderId)
        .eq("status", "awaiting_payment");

      const txRow: TablesInsert<"blockchain_transactions"> = {
        tx_hash: input.txHash,
        tx_type: "escrow_fund",
        network: input.network,
        status: "submitted",
        source_account: input.sourceAccount,
        amount: moneyValue(input.amountUsdc),
        asset_code: "USDC",
        order_id: input.orderId,
        escrow_id: input.escrowId,
        payment_id: input.paymentId,
        raw_response: (input.rawResponse ?? null) as Json,
      };
      const { error } = await client
        .from("blockchain_transactions")
        .insert(txRow);
      if (error && error.code !== UNIQUE_VIOLATION) throw error;
    },

    async recordFundConfirmed(input) {
      // Atomic single-transaction confirm via a security-definer RPC (migration
      // 20260701000000): payment→confirmed, escrow→funded, order→escrow_locked,
      // blockchain tx→confirmed, escrow_event(fund) inserted idempotently — all
      // or nothing. Guarded inside the function so a repeat/heal call is a safe
      // no-op and returns whether the payment newly transitioned to confirmed.
      //
      // The call is now typed against the generated `confirm_funded_payment`
      // signature (function + arg names checked). Two boundary casts remain
      // intentional: p_amount_usdc is sent as a canonical STRING to preserve
      // numeric precision (PostgREST casts string→numeric; `moneyValue` returns
      // that string), and p_ledger/p_buyer_public_key are nullable at runtime
      // though the generated arg types are non-null.
      const { data, error } = await client.rpc("confirm_funded_payment", {
        p_payment_id: input.paymentId,
        p_order_id: input.orderId,
        p_escrow_id: input.escrowId,
        p_tx_hash: input.txHash,
        p_ledger: input.ledger as number,
        p_buyer_public_key: input.buyerPublicKey as string,
        p_amount_usdc: moneyValue(input.amountUsdc),
        p_network: input.network,
      });
      if (error) throw error;
      return { applied: data === true };
    },

    async recordEscrowCreationTx(input) {
      // Idempotent, money-neutral: log the admin create_order tx + a 'create'
      // escrow event, both keyed on the create tx hash (unique) so a repeat is a
      // no-op. The escrow row/status is written separately via linkEscrowRow.
      const txRow: TablesInsert<"blockchain_transactions"> = {
        tx_hash: input.txHash,
        tx_type: "escrow_create",
        network: input.network,
        status: "confirmed",
        ledger: input.ledger,
        source_account: input.sourceAccount,
        amount: moneyValue(input.amountUsdc),
        asset_code: "USDC",
        order_id: input.orderId,
        escrow_id: input.escrowId,
        confirmed_at: new Date().toISOString(),
      };
      const txRes = await client.from("blockchain_transactions").insert(txRow);
      if (txRes.error && txRes.error.code !== UNIQUE_VIOLATION)
        throw txRes.error;

      const eventRow: TablesInsert<"escrow_events"> = {
        escrow_id: input.escrowId,
        event_type: "create",
        tx_hash: input.txHash,
        ledger: input.ledger,
        from_public_key: input.buyerPublicKey,
        amount_usdc: moneyValue(input.amountUsdc),
      };
      const evRes = await client.from("escrow_events").insert(eventRow);
      if (evRes.error && evRes.error.code !== UNIQUE_VIOLATION)
        throw evRes.error;
    },

    async recordFailure(input) {
      await client
        .from("payments")
        .update({ status: "failed", failure_reason: input.reason })
        .eq("id", input.paymentId)
        .neq("status", "confirmed");

      if (input.txHash) {
        await client
          .from("blockchain_transactions")
          .update({ status: "failed" })
          .eq("tx_hash", input.txHash);
      }
    },
  };
}
