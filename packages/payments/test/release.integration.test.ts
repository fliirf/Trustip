import { randomUUID } from "node:crypto";
import type { TrustipClient } from "@trustip/database";
import { getServiceClient } from "@trustip/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Integration tests for the SECURITY-CRITICAL confirm_released_payment RPC.
// Skipped by default; runs only against a live local Supabase stack with the
// migrations applied (see supabase-store.integration.test.ts for the recipe):
//
//   supabase db reset
//   TRUSTIP_DB_TEST=1 NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//   pnpm --filter @trustip/payments test
// ---------------------------------------------------------------------------

const LIVE = process.env.TRUSTIP_DB_TEST === "1";

const BUYER = "GDD4RGXYIEDKCA7YSCBOLUOUCWKKDBNOYFEHZZ5H3QVT7YWDQDLKRGA7";
const SELLER = "GDROYCO5IZUTNIW3KYXY6A4NI7LR33RPVPB757KCUVT4NFTESKOCFBT7";

describe.skipIf(!LIVE)("confirm_released_payment RPC (live local DB)", () => {
  let client: TrustipClient;
  let sellerUserId: string;
  let sellerProfileId: string;
  const createdOrderIds: string[] = [];

  async function seedReleasableOrder(input: {
    orderStatus: string;
    escrowStatus: string;
  }): Promise<{ orderId: string; escrowId: string }> {
    const orderId = randomUUID();
    const { error: orderErr } = await client.from("orders").insert({
      id: orderId,
      order_no: `IT-REL-${randomUUID()}`,
      seller_profile_id: sellerProfileId,
      status: input.orderStatus as never,
      total_usdc: 10.5,
    });
    if (orderErr) throw orderErr;
    createdOrderIds.push(orderId);

    const { data: escrow, error: escrowErr } = await client
      .from("escrows")
      .insert({
        order_id: orderId,
        status: input.escrowStatus as never,
        amount_usdc: 10.5,
        buyer_public_key: BUYER,
        seller_public_key: SELLER,
      })
      .select("id")
      .single();
    if (escrowErr) throw escrowErr;
    return { orderId, escrowId: escrow.id };
  }

  function callRpc(ids: { orderId: string; escrowId: string }, txHash: string) {
    return client.rpc("confirm_released_payment", {
      p_order_id: ids.orderId,
      p_escrow_id: ids.escrowId,
      p_tx_hash: txHash,
      p_ledger: 99,
      p_to_public_key: SELLER,
      p_amount_usdc: 10.5,
      p_network: "testnet",
    });
  }

  beforeAll(async () => {
    client = getServiceClient();
    const email = `seller_rel_${randomUUID()}@example.com`;
    const { data: created, error: authErr } =
      await client.auth.admin.createUser({ email, email_confirm: true });
    if (authErr || !created.user) throw authErr ?? new Error("no auth user");
    sellerUserId = created.user.id;
    await client
      .from("users")
      .upsert({ id: sellerUserId, role: "seller", email });
    const { data: profile, error: profErr } = await client
      .from("seller_profiles")
      .insert({ user_id: sellerUserId, store_name: "IT Release Store" })
      .select("id")
      .single();
    if (profErr) throw profErr;
    sellerProfileId = profile.id;
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await client.from("blockchain_transactions").delete().eq("order_id", id);
      await client.from("orders").delete().eq("id", id);
    }
    if (sellerProfileId) {
      await client.from("seller_profiles").delete().eq("id", sellerProfileId);
    }
    if (sellerUserId) {
      await client.from("users").delete().eq("id", sellerUserId);
      await client.auth.admin.deleteUser(sellerUserId);
    }
  });

  it("releases atomically from delivered+funded and is idempotent on tx hash", async () => {
    const ids = await seedReleasableOrder({
      orderStatus: "delivered",
      escrowStatus: "funded",
    });
    const txHash = `it-rel-${randomUUID()}`;

    const first = await callRpc(ids, txHash);
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);

    const { data: escrow } = await client
      .from("escrows")
      .select("status, release_tx_hash, released_at")
      .eq("id", ids.escrowId)
      .single();
    expect(escrow?.status).toBe("released");
    expect(escrow?.release_tx_hash).toBe(txHash);
    expect(escrow?.released_at).toBeTruthy();

    const { data: order } = await client
      .from("orders")
      .select("status, completed_at")
      .eq("id", ids.orderId)
      .single();
    expect(order?.status).toBe("completed");
    expect(order?.completed_at).toBeTruthy();

    const { data: chainTx } = await client
      .from("blockchain_transactions")
      .select("tx_type, status")
      .eq("tx_hash", txHash)
      .single();
    expect(chainTx).toEqual({ tx_type: "escrow_release", status: "confirmed" });

    const { data: events } = await client
      .from("escrow_events")
      .select("event_type")
      .eq("tx_hash", txHash);
    expect(events).toEqual([{ event_type: "release" }]);

    const { data: statusEvents } = await client
      .from("order_status_events")
      .select("status, actor_type")
      .eq("order_id", ids.orderId);
    expect(statusEvents).toEqual([
      { status: "completed", actor_type: "system" },
    ]);

    // Repeat with the SAME tx hash: legal no-op, nothing duplicated.
    const second = await callRpc(ids, txHash);
    expect(second.error).toBeNull();
    expect(second.data).toBe(false);
    const { data: eventsAfter } = await client
      .from("escrow_events")
      .select("id")
      .eq("tx_hash", txHash);
    expect(eventsAfter).toHaveLength(1);
    const { data: statusEventsAfter } = await client
      .from("order_status_events")
      .select("id")
      .eq("order_id", ids.orderId);
    expect(statusEventsAfter).toHaveLength(1);
  });

  it("rejects when the escrow is not funded (and rolls back everything)", async () => {
    const ids = await seedReleasableOrder({
      orderStatus: "delivered",
      escrowStatus: "created",
    });
    const res = await callRpc(ids, `it-rel-${randomUUID()}`);
    expect(res.error).not.toBeNull();
    const { data: order } = await client
      .from("orders")
      .select("status")
      .eq("id", ids.orderId)
      .single();
    expect(order?.status).toBe("delivered");
  });

  it("rejects when the order is not delivered", async () => {
    const ids = await seedReleasableOrder({
      orderStatus: "shipped",
      escrowStatus: "funded",
    });
    const res = await callRpc(ids, `it-rel-${randomUUID()}`);
    expect(res.error).not.toBeNull();
    const { data: escrow } = await client
      .from("escrows")
      .select("status")
      .eq("id", ids.escrowId)
      .single();
    // the raise rolled the escrow update back
    expect(escrow?.status).toBe("funded");
  });

  it("rejects a released escrow re-confirmed with a DIFFERENT tx hash", async () => {
    const ids = await seedReleasableOrder({
      orderStatus: "delivered",
      escrowStatus: "funded",
    });
    const first = await callRpc(ids, `it-rel-${randomUUID()}`);
    expect(first.error).toBeNull();
    const res = await callRpc(ids, `it-rel-${randomUUID()}`);
    expect(res.error).not.toBeNull();
  });
});
