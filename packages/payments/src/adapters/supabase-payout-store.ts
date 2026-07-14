import type { TrustipClient } from "@trustip/database";
import { usdcAmountToString } from "../money.js";
import type { ConversionStore } from "../payout-conversion.js";
import type {
  PayoutDetail,
  PayoutMethodRecord,
  PayoutMethodStore,
  PayoutMethodType,
  PayoutRecord,
  PayoutTransactionRecord,
} from "../payout-methods.js";

/** A decimal string sent through a numeric column/arg — PostgREST casts
 * string->numeric server-side, so no JS float precision is lost. */
const numeric = (v: string): number => v as unknown as number;

const PAYOUT_COLUMNS = `id, route_type, status, release_mode, amount_usdc,
  requested_at, completed_at, orders ( order_no ),
  payout_transactions ( transaction_type, status, network, amount, tx_hash, created_at )`;

type PayoutRow = {
  id: string;
  route_type: string;
  status: string;
  release_mode: string;
  amount_usdc: number | null;
  requested_at: string | null;
  completed_at: string | null;
  orders: { order_no: string } | null;
  payout_transactions: Array<{
    transaction_type: string;
    status: string;
    network: string;
    amount: number | null;
    tx_hash: string | null;
    created_at: string;
  }> | null;
};

const money = (v: number | null): string | null =>
  v === null ? null : usdcAmountToString(v);

function toPayoutRecord(row: PayoutRow): PayoutRecord {
  const txs = row.payout_transactions ?? [];
  const release = txs.find((t) => t.transaction_type === "escrow_release");
  return {
    id: row.id,
    orderNo: row.orders?.order_no ?? "",
    routeType: row.route_type,
    status: row.status,
    releaseMode: row.release_mode,
    amountUsdc: money(row.amount_usdc),
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    releaseTxHash: release?.tx_hash ?? null,
  };
}

const METHOD_COLUMNS =
  "id, method_type, display_name, is_default, status, stellar_address, asset_code, cashout_country, cashout_currency, created_at";

/**
 * SERVICE-ROLE adapter for seller payout methods. Server-only — clients hold no
 * DML grants on seller_payout_methods, so this adapter (behind the seller-auth
 * service) is the only write path. Config only: no escrow/release/money writes.
 */
export function createSupabasePayoutStore(
  client: TrustipClient,
): PayoutMethodStore & ConversionStore {
  return {
    async loadConversionContext({ sellerProfileId, payoutId }) {
      const { data, error } = await client
        .from("payout_requests")
        .select(
          "id, order_id, route_type, status, amount_usdc, escrows ( seller_public_key )",
        )
        .eq("id", payoutId)
        .eq("seller_profile_id", sellerProfileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as unknown as {
        order_id: string;
        route_type: string;
        status: string;
        amount_usdc: number | null;
        escrows: { seller_public_key: string | null } | null;
      };

      const [{ data: xlmMethod }, { data: existing }] = await Promise.all([
        client
          .from("seller_payout_methods")
          .select("id")
          .eq("seller_profile_id", sellerProfileId)
          .eq("method_type", "xlm_wallet")
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        client
          .from("payout_requests")
          .select("id")
          .eq("idempotency_key", `convert:${payoutId}`)
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        orderId: row.order_id,
        sourcePublicKey: row.escrows?.seller_public_key ?? null,
        amountUsdc: row.amount_usdc === null ? null : usdcAmountToString(row.amount_usdc),
        routeType: row.route_type,
        status: row.status,
        hasActiveXlmMethod: !!xlmMethod,
        alreadyConverted: !!existing,
      };
    },

    async recordXlmConversion({ sourcePayoutId, txHash, sendUsdc, recvXlm, network }) {
      const { error } = await client.rpc("record_xlm_conversion", {
        p_source_payout_id: sourcePayoutId,
        p_tx_hash: txHash,
        p_send_usdc: numeric(sendUsdc),
        p_recv_xlm: numeric(recvXlm),
        p_network: network,
      });
      if (error) throw error;
    },

    async getSellerProfileIdForUser(userId) {
      const { data, error } = await client
        .from("seller_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },

    async findVerifiedWallet({ userId, walletId }) {
      const { data, error } = await client
        .from("user_wallets")
        .select("public_key")
        .eq("id", walletId)
        .eq("user_id", userId)
        .not("verified_at", "is", null)
        .maybeSingle();
      if (error) throw error;
      return data ? { publicKey: data.public_key } : null;
    },

    async listPayouts(sellerProfileId) {
      const { data, error } = await client
        .from("payout_requests")
        .select(PAYOUT_COLUMNS)
        .eq("seller_profile_id", sellerProfileId)
        .order("requested_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return ((data ?? []) as unknown as PayoutRow[]).map(toPayoutRecord);
    },

    async getPayout({ sellerProfileId, payoutId }) {
      const { data, error } = await client
        .from("payout_requests")
        .select(PAYOUT_COLUMNS)
        .eq("id", payoutId)
        .eq("seller_profile_id", sellerProfileId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as PayoutRow;
      const detail: PayoutDetail = {
        ...toPayoutRecord(row),
        transactions: (row.payout_transactions ?? []).map(
          (t): PayoutTransactionRecord => ({
            transactionType: t.transaction_type,
            status: t.status,
            network: t.network,
            amountUsdc: money(t.amount),
            txHash: t.tx_hash,
            createdAt: t.created_at,
          }),
        ),
      };
      return detail;
    },

    async listPayoutMethods(sellerProfileId) {
      const { data, error } = await client
        .from("seller_payout_methods")
        .select(METHOD_COLUMNS)
        .eq("seller_profile_id", sellerProfileId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toRecord);
    },

    async insertPayoutMethod(input) {
      const { data, error } = await client
        .from("seller_payout_methods")
        .insert({
          seller_profile_id: input.sellerProfileId,
          method_type: input.methodType,
          display_name: input.displayName,
          status: input.status,
          wallet_id: input.walletId,
          stellar_address: input.stellarAddress,
          asset_code: input.assetCode,
          cashout_country: input.cashoutCountry,
          cashout_currency: input.cashoutCurrency,
        })
        .select(METHOD_COLUMNS)
        .single();
      if (error) throw error;
      return toRecord(data);
    },

    async setDefaultPayoutMethod({ sellerProfileId, payoutMethodId }) {
      // Must be one of the seller's own, non-disabled methods.
      const { data: method, error: findError } = await client
        .from("seller_payout_methods")
        .select("id, status")
        .eq("id", payoutMethodId)
        .eq("seller_profile_id", sellerProfileId)
        .maybeSingle();
      if (findError) throw findError;
      if (!method || method.status === "disabled") return { applied: false };

      // Clear BEFORE set so the partial unique index (one default per seller)
      // never sees two defaults. Low-frequency single-seller config, so the two
      // statements not being atomic is acceptable. ponytail: no RPC needed.
      const { error: clearError } = await client
        .from("seller_payout_methods")
        .update({ is_default: false })
        .eq("seller_profile_id", sellerProfileId)
        .eq("is_default", true);
      if (clearError) throw clearError;

      const { error: setError } = await client
        .from("seller_payout_methods")
        .update({ is_default: true })
        .eq("id", payoutMethodId)
        .eq("seller_profile_id", sellerProfileId);
      if (setError) throw setError;

      // Keep the denormalized FK on seller_profiles in step (ERD models both).
      const { error: profileError } = await client
        .from("seller_profiles")
        .update({ default_payout_method_id: payoutMethodId })
        .eq("id", sellerProfileId);
      if (profileError) throw profileError;

      return { applied: true };
    },

    async disablePayoutMethod({ sellerProfileId, payoutMethodId }) {
      const { data: updated, error } = await client
        .from("seller_payout_methods")
        .update({ status: "disabled", is_default: false })
        .eq("id", payoutMethodId)
        .eq("seller_profile_id", sellerProfileId)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) return { applied: false };

      // Drop the denormalized default pointer if it referenced this method.
      const { error: profileError } = await client
        .from("seller_profiles")
        .update({ default_payout_method_id: null })
        .eq("id", sellerProfileId)
        .eq("default_payout_method_id", payoutMethodId);
      if (profileError) throw profileError;

      return { applied: true };
    },
  };
}

function toRecord(row: {
  id: string;
  method_type: string;
  display_name: string;
  is_default: boolean;
  status: string;
  stellar_address: string | null;
  asset_code: string | null;
  cashout_country: string | null;
  cashout_currency: string | null;
  created_at: string;
}): PayoutMethodRecord {
  return {
    id: row.id,
    methodType: row.method_type as PayoutMethodType,
    displayName: row.display_name,
    isDefault: row.is_default,
    status: row.status,
    stellarAddress: row.stellar_address,
    assetCode: row.asset_code,
    cashoutCountry: row.cashout_country,
    cashoutCurrency: row.cashout_currency,
    createdAt: row.created_at,
  };
}
