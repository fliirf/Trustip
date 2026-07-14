import type { TrustipClient } from "@trustip/database";
import { randomUUID } from "node:crypto";
import { usdcAmountToString } from "../money.js";
import type {
  AdminRefundRow,
  RefundEvidenceItem,
  RefundReasonCode,
  RefundRequestRecord,
  RefundStore,
} from "../refund.js";
import { createSupabaseReleaseStore } from "./supabase-release-store.js";

const EVIDENCE_BUCKET = "refund-evidence";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

/** Keep only a filesystem-safe tail of the client-supplied name (defence in
 * depth — the object key is otherwise a server UUID). */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80) || "file";
}

const OPEN_STATUSES = [
  "submitted",
  "under_review",
  "seller_response_needed",
] as const;

function moneyValue(amount: string): number {
  return usdcAmountToString(amount) as unknown as number;
}

/**
 * SERVICE-ROLE adapter for the REFUND-1/REFUND-2 store port. Server-only —
 * clients hold no DML grants on refund_requests/admin_actions/escrows, so this
 * adapter (behind the guarded service) is the only refund write path.
 */
export function createSupabaseRefundStore(client: TrustipClient): RefundStore {
  const releaseStore = createSupabaseReleaseStore(client);

  return {
    // Same public (slug, order_no) context load as RELEASE-1 — one derivation.
    loadReleaseContext: releaseStore.loadReleaseContext,
    recomputeTrustProfile: releaseStore.recomputeTrustProfile,

    async findOpenRefundForOrder(orderId) {
      const { data, error } = await client
        .from("refund_requests")
        .select("id")
        .eq("order_id", orderId)
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { refundRequestId: data.id } : null;
    },

    async addRefundEvidence({ refundRequestId, fileType, evidenceType, file }) {
      // Object key is a server UUID under the request folder; the client name is
      // only a sanitized suffix. Private bucket → no public URL is ever formed.
      const objectPath = `${refundRequestId}/${randomUUID()}-${safeFileName(file.fileName)}`;
      const { error: uploadError } = await client.storage
        .from(EVIDENCE_BUCKET)
        .upload(objectPath, Buffer.from(file.bytes), {
          contentType: file.mimeType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await client
        .from("refund_evidence")
        .insert({
          refund_request_id: refundRequestId,
          actor_type: "buyer",
          file_url: objectPath,
          file_type: fileType,
          evidence_type: evidenceType,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async listRefundEvidence(refundRequestId) {
      const { data, error } = await client
        .from("refund_evidence")
        .select("id, file_url, file_type, evidence_type, note, created_at")
        .eq("refund_request_id", refundRequestId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const items: RefundEvidenceItem[] = [];
      for (const row of data ?? []) {
        const { data: signed } = await client.storage
          .from(EVIDENCE_BUCKET)
          .createSignedUrl(row.file_url, SIGNED_URL_TTL_SECONDS);
        items.push({
          id: row.id,
          fileType: row.file_type,
          evidenceType: row.evidence_type,
          note: row.note,
          createdAt: row.created_at,
          signedUrl: signed?.signedUrl ?? "",
        });
      }
      return items;
    },

    async createRefundRequest({ orderId, reasonCode, description }) {
      // seller_profile_id / requested amount come from the order row itself —
      // never from client input.
      const { data: order, error: orderError } = await client
        .from("orders")
        .select("id, order_no, seller_profile_id, buyer_user_id, total_usdc")
        .eq("id", orderId)
        .single();
      if (orderError) throw orderError;

      const { data: created, error: insertError } = await client
        .from("refund_requests")
        .insert({
          order_id: order.id,
          buyer_user_id: order.buyer_user_id,
          seller_profile_id: order.seller_profile_id,
          reason_code: reasonCode,
          description,
          requested_amount_usdc: order.total_usdc,
        })
        .select(
          "id, order_id, status, decision, reason_code, description, requested_amount_usdc, created_at, resolved_at",
        )
        .single();
      if (insertError) throw insertError;

      const { error: eventError } = await client
        .from("order_status_events")
        .insert({
          order_id: order.id,
          status: "refund_requested",
          actor_type: "buyer",
          metadata: { refundRequestId: created.id, reasonCode },
        });
      if (eventError) throw eventError;

      return toRecord(created, order.order_no);
    },

    async listAdminRefunds({ onlyOpen }) {
      let query = client
        .from("refund_requests")
        .select(
          `id, order_id, status, decision, reason_code, description,
           requested_amount_usdc, created_at, resolved_at, seller_profile_id,
           orders ( order_no, status,
                    escrows ( status, amount_usdc ),
                    shipments ( status, created_at ) )`,
        )
        .order("created_at", { ascending: true });
      if (onlyOpen) query = query.in("status", OPEN_STATUSES);
      const { data, error } = await query;
      if (error) throw error;

      type Row = {
        id: string;
        order_id: string;
        status: string;
        decision: string;
        reason_code: RefundReasonCode;
        description: string | null;
        requested_amount_usdc: number | null;
        created_at: string;
        resolved_at: string | null;
        seller_profile_id: string;
        orders: {
          order_no: string;
          status: string;
          escrows: { status: string; amount_usdc: number } | null;
          shipments: Array<{ status: string; created_at: string }> | null;
        } | null;
      };
      return ((data ?? []) as unknown as Row[]).map((row): AdminRefundRow => {
        const latestShipment =
          (row.orders?.shipments ?? [])
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ??
          null;
        return {
          ...toRecord(row, row.orders?.order_no ?? ""),
          sellerProfileId: row.seller_profile_id,
          orderStatus: row.orders?.status ?? "",
          escrowStatus: row.orders?.escrows?.status ?? null,
          amountUsdc: row.orders?.escrows
            ? usdcAmountToString(row.orders.escrows.amount_usdc)
            : null,
          shipmentStatus: latestShipment?.status ?? null,
        };
      });
    },

    async loadRefundResolutionContext(refundRequestId) {
      const { data, error } = await client
        .from("refund_requests")
        .select(
          `id, status, decision, order_id,
           orders ( order_no, status,
                    escrows ( id, status, contract_order_id, buyer_public_key,
                              amount_usdc, refund_tx_hash ) )`,
        )
        .eq("id", refundRequestId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      type Row = {
        id: string;
        status: string;
        decision: string;
        order_id: string;
        orders: {
          order_no: string;
          status: string;
          escrows: {
            id: string;
            status: string;
            contract_order_id: string | null;
            buyer_public_key: string | null;
            amount_usdc: number;
            refund_tx_hash: string | null;
          } | null;
        } | null;
      };
      const row = data as unknown as Row;
      return {
        refund: { id: row.id, status: row.status, decision: row.decision },
        orderId: row.order_id,
        orderNo: row.orders?.order_no ?? "",
        orderStatus: row.orders?.status ?? "",
        escrow: row.orders?.escrows
          ? {
              id: row.orders.escrows.id,
              status: row.orders.escrows.status,
              contractOrderId: row.orders.escrows.contract_order_id,
              buyerPublicKey: row.orders.escrows.buyer_public_key,
              amountUsdc: usdcAmountToString(row.orders.escrows.amount_usdc),
              refundTxHash: row.orders.escrows.refund_tx_hash,
            }
          : null,
      };
    },

    async markRefundRejected({ refundRequestId, adminUserId, note }) {
      const { data: updated, error } = await client
        .from("refund_requests")
        .update({
          status: "rejected",
          decision: "release_seller",
          decision_note: note,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", refundRequestId)
        .in("status", OPEN_STATUSES)
        .select("id, order_id");
      if (error) throw error;
      if (!updated || updated.length === 0) return { applied: false };

      await insertAdminAction(client, {
        adminUserId,
        orderId: updated[0]!.order_id,
        refundRequestId,
        actionType: "reject_refund",
        note,
      });
      return { applied: true };
    },

    async markRefundApproved({ refundRequestId, adminUserId, note }) {
      const { data: updated, error } = await client
        .from("refund_requests")
        .update({ status: "approved", decision_note: note })
        .eq("id", refundRequestId)
        .in("status", OPEN_STATUSES)
        .select("id, order_id");
      if (error) throw error;
      if (!updated || updated.length === 0) return { applied: false };

      await insertAdminAction(client, {
        adminUserId,
        orderId: updated[0]!.order_id,
        refundRequestId,
        actionType: "approve_refund",
        note,
      });
      return { applied: true };
    },

    async recordRefundSubmitted(input) {
      const { error } = await client.from("blockchain_transactions").upsert(
        {
          order_id: input.orderId,
          escrow_id: input.escrowId,
          tx_hash: input.txHash,
          tx_type: "escrow_refund",
          network: input.network,
          status: "submitted",
          source_account: input.sourceAccount,
          amount: moneyValue(input.amountUsdc),
          asset_code: "USDC",
        },
        { onConflict: "tx_hash", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async findRefundTxHash(orderId) {
      const { data, error } = await client
        .from("blockchain_transactions")
        .select("tx_hash")
        .eq("order_id", orderId)
        .eq("tx_type", "escrow_refund")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.tx_hash ?? null;
    },

    async confirmRefunded(input) {
      const { data, error } = await client.rpc("confirm_refunded_payment", {
        p_order_id: input.orderId,
        p_escrow_id: input.escrowId,
        p_refund_request_id: input.refundRequestId,
        p_tx_hash: input.txHash,
        p_ledger: input.ledger as number,
        p_to_public_key: input.toPublicKey as string,
        p_amount_usdc: moneyValue(input.amountUsdc),
        p_network: input.network,
      });
      if (error) throw error;
      return { applied: data === true };
    },
  };
}

function toRecord(
  row: {
    id: string;
    order_id: string;
    status: string;
    decision: string;
    reason_code: RefundReasonCode;
    description: string | null;
    requested_amount_usdc: number | null;
    created_at: string;
    resolved_at: string | null;
  },
  orderNo: string,
): RefundRequestRecord {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNo,
    status: row.status,
    decision: row.decision,
    reasonCode: row.reason_code,
    description: row.description,
    requestedAmountUsdc:
      row.requested_amount_usdc === null
        ? null
        : usdcAmountToString(row.requested_amount_usdc),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

async function insertAdminAction(
  client: TrustipClient,
  input: {
    adminUserId: string;
    orderId: string;
    refundRequestId: string;
    actionType: "approve_refund" | "reject_refund";
    note: string | null;
  },
): Promise<void> {
  const { error } = await client.from("admin_actions").insert({
    admin_user_id: input.adminUserId,
    order_id: input.orderId,
    refund_request_id: input.refundRequestId,
    action_type: input.actionType,
    note: input.note,
  });
  if (error) throw error;
}
