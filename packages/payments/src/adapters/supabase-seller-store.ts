import type { TrustipClient } from "@trustip/database";
import { unwrap } from "../errors.js";
import { usdcAmountToString } from "../money.js";
import {
  toBuyerSummary,
  type PublicOrderStatusRecord,
  type SellerCheckoutLinkRecord,
  type SellerOrderRecord,
  type SellerProfileRecord,
  type SellerStore,
  type SellerWalletRecord,
  type ShipmentSummary,
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

type ShipmentRow = {
  status: string;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
};

/** shipments.order_id is not unique, so PostgREST embeds an array; the app
 * writes exactly one row per order (upsert) — take the newest defensively. */
function toShipmentSummary(
  rows: ShipmentRow[] | null | undefined,
): ShipmentSummary | null {
  const row = rows?.[rows.length - 1];
  if (!row) return null;
  return {
    status: row.status,
    courier: row.courier_name,
    trackingNumber: row.tracking_number,
    shippedAt: row.shipped_at,
  };
}

const LINK_COLUMNS =
  "id, seller_profile_id, slug, title, description, price_usdc, status, created_at, requires_shipping";

type LinkRow = {
  id: string;
  seller_profile_id: string;
  slug: string;
  title: string;
  description: string | null;
  price_usdc: number;
  status: string;
  created_at: string;
  requires_shipping: boolean;
};

function toLinkRecord(row: LinkRow): SellerCheckoutLinkRecord {
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceUsdc: usdcAmountToString(row.price_usdc),
    status: row.status,
    createdAt: row.created_at,
    requiresShipping: row.requires_shipping,
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
      const existing = unwrap(
        await client.from("users").select("id").eq("id", userId).maybeSingle(),
      );
      if (existing) return;
      const { error } = await client
        .from("users")
        .insert({ id: userId, email });
      // A concurrent insert (or an email collision on an already-provisioned
      // row) is fine — the row exists; anything else is a real failure.
      if (error && error.code !== UNIQUE_VIOLATION) throw error;
    },

    async getSellerProfile(userId) {
      const data = unwrap(
        await client
          .from("seller_profiles")
          .select(PROFILE_COLUMNS)
          .eq("user_id", userId)
          .maybeSingle(),
      );
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
      const data = unwrap(
        await client
          .from("user_wallets")
          .select(WALLET_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
      );
      return ((data ?? []) as WalletRow[]).map(toWalletRecord);
    },

    async findWallet({ userId, publicKey, network }) {
      const data = unwrap(
        await client
          .from("user_wallets")
          .select(WALLET_COLUMNS)
          .eq("user_id", userId)
          .eq("public_key", publicKey)
          .eq("network", network)
          .maybeSingle(),
      );
      return data ? toWalletRecord(data as WalletRow) : null;
    },

    async findWalletById({ userId, walletId }) {
      const data = unwrap(
        await client
          .from("user_wallets")
          .select(WALLET_COLUMNS)
          .eq("id", walletId)
          .eq("user_id", userId)
          .maybeSingle(),
      );
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

    async listCheckoutLinks(sellerProfileId) {
      const data = unwrap(
        await client
          .from("checkout_links")
          .select(LINK_COLUMNS)
          .eq("seller_profile_id", sellerProfileId)
          .order("created_at", { ascending: false }),
      );
      return ((data ?? []) as LinkRow[]).map(toLinkRecord);
    },

    async insertCheckoutLink(input) {
      const { data, error } = await client
        .from("checkout_links")
        .insert({
          seller_profile_id: input.sellerProfileId,
          slug: input.slug,
          title: input.title,
          description: input.description,
          // Canonical decimal string into numeric — never Number() float math.
          price_usdc: usdcAmountToString(input.priceUsdc) as unknown as number,
          status: "active",
          requires_shipping: input.requiresShipping,
        })
        .select(LINK_COLUMNS)
        .single();
      if (error) {
        // slug is the only unique constraint this insert can hit
        if (error.code === UNIQUE_VIOLATION) return null;
        throw error;
      }
      return toLinkRecord(data as LinkRow);
    },

    async listSellerOrders(sellerProfileId) {
      // READ-ONLY, seller-scoped by the service-derived profile id. Selected
      // columns are the safe seller-facing set only — no tokens, no secrets.
      const { data, error } = await client
        .from("orders")
        .select(
          `id, order_no, status, total_usdc, created_at, completed_at, requires_shipping,
           checkout_links ( title, slug ),
           order_items ( quantity, metadata ),
           payments ( status, tx_hash ),
           escrows ( status, funded_tx_hash, release_tx_hash ),
           shipments ( status, courier_name, tracking_number, shipped_at )`,
        )
        .eq("seller_profile_id", sellerProfileId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // payments/escrows have a UNIQUE order_id, so PostgREST embeds them as
      // object-or-null (one-to-one), while order_items embeds as an array.
      type Row = {
        id: string;
        order_no: string;
        status: string;
        total_usdc: number;
        created_at: string;
        completed_at: string | null;
        requires_shipping: boolean;
        checkout_links: { title: string; slug: string } | null;
        order_items: Array<{ quantity: number; metadata: unknown }> | null;
        payments: { status: string; tx_hash: string | null } | null;
        escrows: {
          status: string;
          funded_tx_hash: string | null;
          release_tx_hash: string | null;
        } | null;
        shipments: ShipmentRow[] | null;
      };
      return ((data ?? []) as unknown as Row[]).map((row) => {
        const item = row.order_items?.[0] ?? null;
        const payment = row.payments;
        const escrow = row.escrows;
        const record: SellerOrderRecord = {
          orderId: row.id,
          orderNo: row.order_no,
          status: row.status,
          totalUsdc: usdcAmountToString(row.total_usdc),
          quantity: item?.quantity ?? null,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          requiresShipping: row.requires_shipping,
          link: row.checkout_links
            ? { title: row.checkout_links.title, slug: row.checkout_links.slug }
            : null,
          buyer: item ? toBuyerSummary(item.metadata) : null,
          payment: payment
            ? { status: payment.status, txHash: payment.tx_hash }
            : null,
          escrow: escrow
            ? {
                status: escrow.status,
                fundedTxHash: escrow.funded_tx_hash,
                releaseTxHash: escrow.release_tx_hash,
              }
            : null,
          shipment: toShipmentSummary(row.shipments),
        };
        return record;
      });
    },

    async getPublicOrderStatus({ slug, orderNo }) {
      // Resolve by PUBLIC identifiers only, requiring the order to belong to
      // that exact link (mirrors loadCheckoutOrderForIssuance).
      const link = unwrap(
        await client
          .from("checkout_links")
          .select("id, slug, title, description, seller_profiles ( store_name )")
          .eq("slug", slug)
          .maybeSingle(),
      );
      if (!link) return null;

      const order = unwrap(
        await client
          .from("orders")
          .select(
            `order_no, status, total_usdc, created_at, completed_at, checkout_link_id, requires_shipping,
           order_items ( quantity, metadata ),
           payments ( status, tx_hash ),
           escrows ( status, funded_tx_hash, release_tx_hash ),
           shipments ( status, courier_name, tracking_number, shipped_at )`,
          )
          .eq("order_no", orderNo)
          .maybeSingle(),
      );
      if (!order || order.checkout_link_id !== link.id) return null;

      // payments/escrows embed as object-or-null (unique order_id).
      type OrderRow = {
        order_no: string;
        status: string;
        total_usdc: number;
        created_at: string;
        completed_at: string | null;
        requires_shipping: boolean;
        order_items: Array<{ quantity: number; metadata: unknown }> | null;
        payments: { status: string; tx_hash: string | null } | null;
        escrows: {
          status: string;
          funded_tx_hash: string | null;
          release_tx_hash: string | null;
        } | null;
        shipments: ShipmentRow[] | null;
      };
      const row = order as unknown as OrderRow;
      const profile = link.seller_profiles as unknown as {
        store_name: string;
      } | null;
      const item = row.order_items?.[0] ?? null;
      const record: PublicOrderStatusRecord = {
        orderNo: row.order_no,
        status: row.status,
        totalUsdc: usdcAmountToString(row.total_usdc),
        quantity: item?.quantity ?? null,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        requiresShipping: row.requires_shipping,
        link: {
          title: link.title,
          description: link.description,
          slug: link.slug,
        },
        storeName: profile?.store_name ?? null,
        buyer: item ? toBuyerSummary(item.metadata) : null,
        payment: row.payments
          ? { status: row.payments.status, txHash: row.payments.tx_hash }
          : null,
        escrow: row.escrows
          ? {
              status: row.escrows.status,
              fundedTxHash: row.escrows.funded_tx_hash,
              releaseTxHash: row.escrows.release_tx_hash,
            }
          : null,
        shipment: toShipmentSummary(row.shipments),
      };
      return record;
    },

    async getSellerOrderForShipment({ sellerProfileId, orderNo }) {
      // Ownership is part of the WHERE clause — a non-owner resolves to null
      // exactly like a nonexistent order (no oracle).
      const data = unwrap(
        await client
          .from("orders")
          .select(`id, order_no, status, requires_shipping, escrows ( status )`)
          .eq("order_no", orderNo)
          .eq("seller_profile_id", sellerProfileId)
          .maybeSingle(),
      );
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        order_no: string;
        status: string;
        requires_shipping: boolean;
        escrows: { status: string } | null;
      };
      return {
        orderId: row.id,
        orderNo: row.order_no,
        status: row.status,
        escrowStatus: row.escrows?.status ?? null,
        requiresShipping: row.requires_shipping,
      };
    },

    async applyShipmentUpdate(input) {
      // 1) Guarded lifecycle gate: only fromStatus→toStatus, nothing else.
      //    Touches orders.status ONLY — payment/escrow columns are never
      //    written by this store method.
      const { data: updated, error: orderError } = await client
        .from("orders")
        .update({ status: input.toStatus })
        .eq("id", input.orderId)
        .eq("status", input.fromStatus)
        .select("id");
      if (orderError) throw orderError;
      if (!updated || updated.length === 0) {
        return {
          applied: false,
          shipment: {
            status: input.toStatus,
            courier: input.courier,
            trackingNumber: input.trackingNumber,
            shippedAt: input.shippedAt,
          },
        };
      }

      // 2) Upsert the single shipment row for this order. Fields only move
      //    forward: courier/tracking/note overwrite only when provided;
      //    shipped_at is set once, server-side.
      const existing = unwrap(
        await client
          .from("shipments")
          .select("id, courier_name, tracking_number, shipped_at, seller_note")
          .eq("order_id", input.orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );

      const fields = {
        status: input.toStatus,
        courier_name: input.courier ?? existing?.courier_name ?? null,
        tracking_number:
          input.trackingNumber ?? existing?.tracking_number ?? null,
        seller_note: input.note ?? existing?.seller_note ?? null,
        shipped_at: existing?.shipped_at ?? input.shippedAt,
      };
      const write = existing
        ? client.from("shipments").update(fields).eq("id", existing.id)
        : client
            .from("shipments")
            .insert({ order_id: input.orderId, ...fields });
      const { error: shipmentError } = await write;
      if (shipmentError) throw shipmentError;

      // 3) Audit event (best-effort ordering; orders.status is the truth).
      const { error: eventError } = await client
        .from("order_status_events")
        .insert({
          order_id: input.orderId,
          status: input.toStatus,
          actor_user_id: input.actorUserId,
          actor_type: "seller",
          metadata: {
            courier: fields.courier_name,
            trackingNumber: fields.tracking_number,
          },
        });
      if (eventError) throw eventError;

      return {
        applied: true,
        shipment: {
          status: input.toStatus,
          courier: fields.courier_name,
          trackingNumber: fields.tracking_number,
          shippedAt: fields.shipped_at,
        },
      };
    },
  };
}
