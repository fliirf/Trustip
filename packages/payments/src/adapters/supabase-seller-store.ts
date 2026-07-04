import type { TrustipClient } from "@trustip/database";
import type {
  SellerProfileRecord,
  SellerStore,
  SellerWalletRecord,
} from "../seller-onboarding.js";

const UNIQUE_VIOLATION = "23505";

const WALLET_COLUMNS =
  "id, user_id, wallet_provider, public_key, network, is_primary, verified_at";
const PROFILE_COLUMNS = "id, user_id, store_name, category, social_url";

type WalletRow = {
  id: string;
  user_id: string;
  wallet_provider: SellerWalletRecord["walletProvider"];
  public_key: string;
  network: SellerWalletRecord["network"];
  is_primary: boolean;
  verified_at: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  store_name: string;
  category: string | null;
  social_url: string | null;
};

function toWalletRecord(row: WalletRow): SellerWalletRecord {
  return {
    id: row.id,
    userId: row.user_id,
    walletProvider: row.wallet_provider,
    publicKey: row.public_key,
    network: row.network,
    isPrimary: row.is_primary,
    verifiedAt: row.verified_at,
  };
}

function toProfileRecord(row: ProfileRow): SellerProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    category: row.category,
    socialUrl: row.social_url,
  };
}

/**
 * Supabase-backed SellerStore (SERVICE-ROLE client, server-only). Clients hold
 * no DML grants on these tables — every seller write flows through here, which
 * is what makes `verified_at` and `is_primary` unforgeable from the browser.
 */
export function createSupabaseSellerStore(client: TrustipClient): SellerStore {
  return {
    async ensureUserRow({ userId, email }) {
      const { data: existing } = await client
        .from("users")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (existing) return;
      const { error } = await client
        .from("users")
        .insert({ id: userId, email });
      // A concurrent insert (or an email collision on an already-provisioned
      // row) is fine — the row exists; anything else is a real failure.
      if (error && error.code !== UNIQUE_VIOLATION) throw error;
    },

    async getSellerProfile(userId) {
      const { data } = await client
        .from("seller_profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      return data ? toProfileRecord(data as ProfileRow) : null;
    },

    async upsertSellerProfile(input) {
      const { data, error } = await client
        .from("seller_profiles")
        .upsert(
          {
            user_id: input.userId,
            store_name: input.storeName,
            category: input.category,
            social_url: input.socialUrl,
          },
          { onConflict: "user_id" },
        )
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw error;
      return toProfileRecord(data as ProfileRow);
    },

    async listWallets(userId) {
      const { data } = await client
        .from("user_wallets")
        .select(WALLET_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      return ((data ?? []) as WalletRow[]).map(toWalletRecord);
    },

    async findWallet({ userId, publicKey, network }) {
      const { data } = await client
        .from("user_wallets")
        .select(WALLET_COLUMNS)
        .eq("user_id", userId)
        .eq("public_key", publicKey)
        .eq("network", network)
        .maybeSingle();
      return data ? toWalletRecord(data as WalletRow) : null;
    },

    async findWalletById({ userId, walletId }) {
      const { data } = await client
        .from("user_wallets")
        .select(WALLET_COLUMNS)
        .eq("id", walletId)
        .eq("user_id", userId)
        .maybeSingle();
      return data ? toWalletRecord(data as WalletRow) : null;
    },

    async insertWallet(input) {
      // verified_at and is_primary stay at their column defaults (null/false);
      // this insert deliberately cannot set them.
      const { data, error } = await client
        .from("user_wallets")
        .insert({
          user_id: input.userId,
          wallet_provider: input.walletProvider,
          public_key: input.publicKey,
          network: input.network,
        })
        .select(WALLET_COLUMNS)
        .single();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          // Concurrent registration of the same wallet — return the winner.
          const existing = await this.findWallet(input);
          if (existing) return existing;
        }
        throw error;
      }
      return toWalletRecord(data as WalletRow);
    },

    async setWalletVerified({ walletId, verifiedAt }) {
      const { error } = await client
        .from("user_wallets")
        .update({ verified_at: verifiedAt })
        .eq("id", walletId)
        .is("verified_at", null);
      if (error) throw error;
    },

    async clearPrimary({ userId, network, exceptWalletId }) {
      const { error } = await client
        .from("user_wallets")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("network", network)
        .eq("is_primary", true)
        .neq("id", exceptWalletId);
      if (error) throw error;
    },

    async setPrimary({ walletId }) {
      const { error } = await client
        .from("user_wallets")
        .update({ is_primary: true })
        .eq("id", walletId);
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { conflict: true };
        throw error;
      }
      return { conflict: false };
    },
  };
}
