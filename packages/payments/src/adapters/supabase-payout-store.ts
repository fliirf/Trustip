import type { TrustipClient } from "@trustip/database";
import type {
  PayoutMethodRecord,
  PayoutMethodStore,
  PayoutMethodType,
} from "../payout-methods.js";

const METHOD_COLUMNS =
  "id, method_type, display_name, is_default, status, stellar_address, asset_code, cashout_country, cashout_currency, created_at";

/**
 * SERVICE-ROLE adapter for seller payout methods. Server-only — clients hold no
 * DML grants on seller_payout_methods, so this adapter (behind the seller-auth
 * service) is the only write path. Config only: no escrow/release/money writes.
 */
export function createSupabasePayoutStore(
  client: TrustipClient,
): PayoutMethodStore {
  return {
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
