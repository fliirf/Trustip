import { randomUUID } from "node:crypto";
import type { TrustipClient } from "@trustip/database";
import { getServiceClient } from "@trustip/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabasePaymentStore } from "../src/adapters/supabase-store.js";
import type { PaymentStore } from "../src/ports.js";

// ---------------------------------------------------------------------------
// Integration harness for the SECURITY-CRITICAL Supabase adapter guards. It is
// SKIPPED by default and only runs against a live local Supabase stack. Run it
// with the migrations applied (including confirm_funded_payment):
//
//   supabase db reset
//   TRUSTIP_DB_TEST=1 \
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
//   pnpm --filter @trustip/payments test
//
// Nothing here touches the DB (or reads env) unless TRUSTIP_DB_TEST=1, so the
// default `pnpm test` run stays hermetic and green.
// ---------------------------------------------------------------------------

const LIVE = process.env.TRUSTIP_DB_TEST === "1";

const BUYER = "GDD4RGXYIEDKCA7YSCBOLUOUCWKKDBNOYFEHZZ5H3QVT7YWDQDLKRGA7";
const SELLER = "GDROYCO5IZUTNIW3KYXY6A4NI7LR33RPVPB757KCUVT4NFTESKOCFBT7";
const CONTRACT_ID = "CDJO4D3R34KGLXHTD6ZVGERKOIKM66JVICY6RJABWWL2CXII7PCTBD3L";

describe.skipIf(!LIVE)("supabase-store integration (live local DB)", () => {
  let client: TrustipClient;
  let store: PaymentStore;
  let sellerProfileId: string;
  let sellerUserId: string;
  const createdOrderIds: string[] = [];
  const createdCheckoutLinkIds: string[] = [];

  async function seedOrder(): Promise<{ orderId: string }> {
    const orderId = randomUUID();
    const { error } = await client.from("orders").insert({
      id: orderId,
      order_no: `IT-${randomUUID()}`,
      seller_profile_id: sellerProfileId,
      status: "awaiting_payment",
      total_usdc: 10.5,
    });
    if (error) throw error;
    createdOrderIds.push(orderId);
    return { orderId };
  }

  beforeAll(async () => {
    client = getServiceClient();
    store = createSupabasePaymentStore(client);

    const email = `seller_${randomUUID()}@example.com`;
    const { data: created, error: authErr } =
      await client.auth.admin.createUser({ email, email_confirm: true });
    if (authErr || !created.user) throw authErr ?? new Error("no auth user");
    sellerUserId = created.user.id;
    await client
      .from("users")
      .upsert({ id: sellerUserId, role: "seller", email });

    const { data: profile, error: profErr } = await client
      .from("seller_profiles")
      .insert({ user_id: sellerUserId, store_name: "IT Store" })
      .select("id")
      .single();
    if (profErr) throw profErr;
    sellerProfileId = profile.id;
  });

  afterAll(async () => {
    for (const id of createdOrderIds) {
      await client.from("orders").delete().eq("id", id);
    }
    for (const id of createdCheckoutLinkIds) {
      await client.from("checkout_links").delete().eq("id", id);
    }
    if (sellerProfileId) {
      await client.from("seller_profiles").delete().eq("id", sellerProfileId);
    }
    if (sellerUserId) {
      await client.from("users").delete().eq("id", sellerUserId);
      await client.auth.admin.deleteUser(sellerUserId);
    }
  });

  it("preparePaymentRow does not reset a submitted/confirmed payment", async () => {
    const { orderId } = await seedOrder();
    const p = await store.preparePaymentRow({
      orderId,
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
    });
    await client
      .from("payments")
      .update({ status: "submitted", tx_hash: `it-${randomUUID()}` })
      .eq("id", p.id);

    const again = await store.preparePaymentRow({
      orderId,
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
    });
    expect(again.status).toBe("submitted");
  });

  it("linkEscrowRow does not downgrade a funded escrow", async () => {
    const { orderId } = await seedOrder();
    const e = await store.linkEscrowRow({
      orderId,
      contractId: CONTRACT_ID,
      contractOrderId: randomUUID().replace(/-/g, "").padEnd(64, "0"),
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      onChainStatus: "created",
    });
    await client.from("escrows").update({ status: "funded" }).eq("id", e.id);

    const again = await store.linkEscrowRow({
      orderId,
      contractId: CONTRACT_ID,
      contractOrderId: e.contractOrderId!,
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      onChainStatus: "created",
    });
    expect(again.status).toBe("funded");
  });

  it("recordSubmission sets tx_hash once and does not overwrite it", async () => {
    const { orderId } = await seedOrder();
    const p = await store.preparePaymentRow({
      orderId,
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
    });
    const e = await store.linkEscrowRow({
      orderId,
      contractId: CONTRACT_ID,
      contractOrderId: randomUUID().replace(/-/g, "").padEnd(64, "0"),
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      onChainStatus: "created",
    });
    const firstHash = `it-${randomUUID()}`;
    await store.recordSubmission({
      paymentId: p.id,
      orderId,
      escrowId: e.id,
      txHash: firstHash,
      sourceAccount: BUYER,
      amountUsdc: "10.5",
      network: "testnet",
    });
    // Second attempt with a different hash must NOT overwrite.
    await store.recordSubmission({
      paymentId: p.id,
      orderId,
      escrowId: e.id,
      txHash: `it-${randomUUID()}`,
      sourceAccount: BUYER,
      amountUsdc: "10.5",
      network: "testnet",
    });
    const ctx = await store.loadByPaymentId(p.id);
    expect(ctx?.payment?.txHash).toBe(firstHash);
    expect(ctx?.order.status).toBe("payment_submitted");
  });

  it("recordFundConfirmed applies once, heals, and is idempotent", async () => {
    const { orderId } = await seedOrder();
    const p = await store.preparePaymentRow({
      orderId,
      amountUsdc: "10.5",
      network: "testnet",
      payerPublicKey: BUYER,
    });
    const e = await store.linkEscrowRow({
      orderId,
      contractId: CONTRACT_ID,
      contractOrderId: randomUUID().replace(/-/g, "").padEnd(64, "0"),
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      onChainStatus: "created",
    });
    const txHash = `it-${randomUUID()}`;
    await store.recordSubmission({
      paymentId: p.id,
      orderId,
      escrowId: e.id,
      txHash,
      sourceAccount: BUYER,
      amountUsdc: "10.5",
      network: "testnet",
    });

    const first = await store.recordFundConfirmed({
      paymentId: p.id,
      orderId,
      escrowId: e.id,
      txHash,
      ledger: 100,
      buyerPublicKey: BUYER,
      amountUsdc: "10.5",
      network: "testnet",
    });
    expect(first.applied).toBe(true);

    const ctx = await store.loadByPaymentId(p.id);
    expect(ctx?.payment?.status).toBe("confirmed");
    expect(ctx?.escrow?.status).toBe("funded");
    expect(ctx?.order.status).toBe("escrow_locked");

    // Idempotent repeat: no new transition.
    const second = await store.recordFundConfirmed({
      paymentId: p.id,
      orderId,
      escrowId: e.id,
      txHash,
      ledger: 100,
      buyerPublicKey: BUYER,
      amountUsdc: "10.5",
      network: "testnet",
    });
    expect(second.applied).toBe(false);
  });

  it("recordEscrowCreationTx logs the create tx + event idempotently", async () => {
    const { orderId } = await seedOrder();
    const e = await store.linkEscrowRow({
      orderId,
      contractId: CONTRACT_ID,
      contractOrderId: randomUUID().replace(/-/g, "").padEnd(64, "0"),
      amountUsdc: "10.5",
      buyerPublicKey: BUYER,
      sellerPublicKey: SELLER,
      onChainStatus: "created",
    });
    const txHash = `it-create-${randomUUID()}`;
    const args = {
      escrowId: e.id,
      orderId,
      txHash,
      sourceAccount: SELLER, // operator/admin stand-in
      amountUsdc: "10.5",
      network: "testnet" as const,
      ledger: 200,
      buyerPublicKey: BUYER,
    };
    await store.recordEscrowCreationTx(args);
    await store.recordEscrowCreationTx(args); // idempotent repeat — no throw

    const { data: txs } = await client
      .from("blockchain_transactions")
      .select("tx_type, status, source_account")
      .eq("tx_hash", txHash);
    expect(txs?.length).toBe(1);
    expect(txs?.[0]?.tx_type).toBe("escrow_create");
    expect(txs?.[0]?.status).toBe("confirmed");

    const { data: events } = await client
      .from("escrow_events")
      .select("event_type, escrow_id")
      .eq("tx_hash", txHash);
    expect(events?.length).toBe(1);
    expect(events?.[0]?.event_type).toBe("create");
    expect(events?.[0]?.escrow_id).toBe(e.id);
  });

  it("loadCheckoutOrderForIssuance resolves only within the checkout link", async () => {
    const slug = `slug-${randomUUID()}`;
    const { data: link, error: linkErr } = await client
      .from("checkout_links")
      .insert({
        seller_profile_id: sellerProfileId,
        slug,
        title: "Issuance IT",
        price_usdc: 10.5,
        status: "active",
      })
      .select("id")
      .single();
    if (linkErr) throw linkErr;
    createdCheckoutLinkIds.push(link.id);

    const orderId = randomUUID();
    const orderNo = `ON-${randomUUID()}`;
    const { error: ordErr } = await client.from("orders").insert({
      id: orderId,
      order_no: orderNo,
      seller_profile_id: sellerProfileId,
      checkout_link_id: link.id,
      status: "awaiting_payment",
      total_usdc: 10.5,
    });
    if (ordErr) throw ordErr;
    createdOrderIds.push(orderId);

    const found = await store.loadCheckoutOrderForIssuance({ slug, orderNo });
    expect(found?.orderId).toBe(orderId);
    expect(found?.orderNo).toBe(orderNo);
    expect(found?.orderStatus).toBe("awaiting_payment");
    expect(found?.linkStatus).toBe("active");
    expect(found?.totalUsdc).toBe("10.5");

    // Wrong slug and unknown order_no both resolve to null (no oracle/leak).
    expect(
      await store.loadCheckoutOrderForIssuance({
        slug: "does-not-exist",
        orderNo,
      }),
    ).toBeNull();
    expect(
      await store.loadCheckoutOrderForIssuance({ slug, orderNo: "ON-missing" }),
    ).toBeNull();
  });
});
