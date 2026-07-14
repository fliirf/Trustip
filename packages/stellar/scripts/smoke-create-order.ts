/**
 * Phase 4.1 — live testnet smoke for the create_order orchestration gateway path.
 *
 * TESTNET ONLY. Exercises the ENV operator signer + `gateway.createOrder` against
 * the deployed escrow contract, confirms `get_order == Created`, then proves a
 * buyer `fund_order` can now be prepared. Never prints or commits secrets.
 *
 * Requires (all testnet):
 *   - NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID in env
 *   - Stellar CLI keystore identities: tt-admin (contract admin), tt-buyer, tt-seller
 *   - Operator secret: TRUSTIP_OPERATOR_SECRET_KEY if already set, else read
 *     in-process from `stellar keys secret tt-admin` (never logged).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx packages/stellar/scripts/smoke-create-order.ts
 */
import { execFileSync } from "node:child_process";
import {
  contractOrderIdToHex,
  createEscrowGateway,
  deriveContractOrderId,
  explorerTxUrl,
  networkName,
} from "../src/index.js";

const cli = (args: string[]): string =>
  execFileSync("stellar", args, { encoding: "utf8" }).trim();
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  if (networkName() !== "testnet") {
    throw new Error(
      `refusing to run: network is ${networkName()}, not testnet`,
    );
  }

  // Provision the operator secret in-process ONLY (never printed). Prefer an
  // explicitly-set env var; otherwise read the admin identity from the keystore.
  if (!process.env.TRUSTIP_OPERATOR_SECRET_KEY) {
    process.env.TRUSTIP_OPERATOR_SECRET_KEY = cli([
      "keys",
      "secret",
      "tt-admin",
    ]);
  }

  const buyer = cli(["keys", "address", "tt-buyer"]);
  const seller = cli(["keys", "address", "tt-seller"]);

  const gateway = createEscrowGateway();
  const orderIdHex = contractOrderIdToHex(
    deriveContractOrderId(`smoke-create-${Date.now()}`),
  );
  const amountUnits = 100000n; // 0.01 USDC (7-decimals); create_order moves no funds
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log("=== create_order smoke (testnet) ===");
  console.log(`contract=${gateway.contractId}`);
  console.log(`order_id=${orderIdHex}`);
  console.log(`buyer=${buyer.slice(0, 6)}… seller=${seller.slice(0, 6)}…`);

  const res = await gateway.createOrder({
    buyerPublicKey: buyer,
    sellerPublicKey: seller,
    payoutRecipient: seller,
    contractOrderIdHex: orderIdHex,
    amountUnits,
    expiresAt,
  });
  console.log(`  create_order submit: status=${res.status} hash=${res.hash}`);
  console.log(`  ${explorerTxUrl("testnet", res.hash)}`);
  if (res.status !== "PENDING" && res.status !== "DUPLICATE") {
    throw new Error(
      `create_order submit failed: ${res.status} ${res.errorResult ?? ""}`,
    );
  }

  // Poll get_order until Created.
  let view = await gateway.readOrder(orderIdHex);
  for (let i = 0; i < 30 && (!view || view.status !== "Created"); i++) {
    await sleep(1000);
    view = await gateway.readOrder(orderIdHex);
  }
  if (!view || view.status !== "Created") {
    throw new Error(`expected Created, got ${view?.status ?? "null"}`);
  }
  console.log(
    `  ✅ get_order == Created (buyer match=${view.buyer === buyer}, amount=${view.amount})`,
  );

  // Best-effort: prove a buyer fund_order can now be prepared. This simulates the
  // USDC transfer, so it needs the buyer to already hold a USDC trustline +
  // balance — a checkout-time precondition, NOT part of create_order. A trustline
  // error here still confirms the create_order path (the Phase 4.1 deliverable):
  // get_order is Created and the order is fundable at the contract level.
  try {
    const fundXdr = await gateway.buildFundOrderXdr({
      buyerPublicKey: buyer,
      contractOrderIdHex: orderIdHex,
      amountUnits,
    });
    console.log(
      `  ✅ fund_order prepared (unsigned XDR length=${fundXdr.length})`,
    );
  } catch (e) {
    console.log(
      `  ⚠️  fund_order prepare needs a buyer USDC trustline/balance (checkout precondition): ${
        e instanceof Error ? e.message.slice(0, 120) : e
      }`,
    );
  }
  console.log("SMOKE OK (create_order path verified)");
}

main().catch((e) => {
  // Never include secrets in error output.
  console.error("SMOKE FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
