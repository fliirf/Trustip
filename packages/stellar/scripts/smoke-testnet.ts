/**
 * Phase 3.5 — live testnet smoke test for the Phase 3 EscrowClient.
 *
 * TESTNET ONLY. Refuses to run against mainnet. Reads participant secret keys
 * from the Stellar CLI keystore (`stellar keys secret <name>`) in-memory only —
 * never writes or logs secrets.
 *
 * Env:
 *   NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID  escrow contract to test
 *   TOKEN_LABEL          human label for the token (e.g. "USDC" | "TEST-SAC")
 *   MODE                 "usdc" (create + prepare-only) | "full" (create→fund→release)
 *   AMOUNT               i128 stroops (default 100000)
 *
 * Usage:
 *   NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=C... MODE=usdc npx tsx packages/stellar/scripts/smoke-testnet.ts
 */
import { execFileSync } from "node:child_process";
import { Keypair, rpc } from "@stellar/stellar-sdk";
import {
  currentNetwork,
  deriveContractOrderId,
  EscrowClient,
  explorerTxUrl,
  getRpcServer,
  networkName,
  type EscrowOrderView,
} from "../src/index.js";

function cli(args: string[]): string {
  return execFileSync("stellar", args, { encoding: "utf8" }).trim();
}
const addr = (name: string): string => cli(["keys", "address", name]);
const secret = (name: string): string => cli(["keys", "secret", name]);
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function signSubmitPoll(
  client: EscrowClient,
  tx: Awaited<ReturnType<EscrowClient["buildCreateOrder"]>>,
  signerSecret: string,
): Promise<{ hash: string; status: string }> {
  tx.sign(Keypair.fromSecret(signerSecret));
  const sent = await client.submit(tx.toXDR());
  if (sent.status === "ERROR") {
    throw new Error(`send ERROR: ${JSON.stringify(sent.errorResult ?? sent)}`);
  }
  let res = await client.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    res = await client.getTransaction(sent.hash);
  }
  return { hash: sent.hash, status: res.status };
}

function logStep(name: string, hash: string): void {
  console.log(`  ✅ ${name}: ${hash}`);
  console.log(`     ${explorerTxUrl("testnet", hash)}`);
}

function logOrder(o: EscrowOrderView | null): void {
  if (!o) {
    console.log("     get_order -> null");
    return;
  }
  console.log(
    `     get_order -> status=${o.status} amount=${o.amount} buyer=${o.buyer.slice(0, 6)}… recipient=${o.payoutRecipient.slice(0, 6)}…`,
  );
}

async function main(): Promise<void> {
  // --- Safety: never touch mainnet ---
  if (networkName() !== "testnet") {
    throw new Error(
      `refusing to run: network is ${networkName()}, not testnet`,
    );
  }

  const escrowId = process.env.NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID;
  if (!escrowId) {
    throw new Error("NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID required");
  }
  const tokenLabel = process.env.TOKEN_LABEL || "TOKEN";
  const mode = process.env.MODE || "usdc";
  const amount = BigInt(process.env.AMOUNT || "100000");

  const admin = addr("tt-admin");
  const buyer = addr("tt-buyer");
  const seller = addr("tt-seller");
  const recipient = addr("tt-recipient");

  console.log(`\n=== Smoke test [${tokenLabel}] mode=${mode} ===`);
  console.log(`escrow=${escrowId}`);
  console.log(
    `admin=${admin}\nbuyer=${buyer}\nseller=${seller}\nrecipient=${recipient}`,
  );

  const server: rpc.Server = getRpcServer();
  const client = new EscrowClient({
    server,
    networkPassphrase: currentNetwork.networkPassphrase,
    contractId: escrowId,
  });

  const orderId = deriveContractOrderId(`smoke-${tokenLabel}-${Date.now()}`);
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

  // Constructor initialization is atomic with deployment; fail closed if the
  // smoke-test signer is not the deployed contract admin.
  const onChainAdmin = await client.readAdmin();
  if (onChainAdmin !== admin) {
    throw new Error(`admin mismatch: expected ${admin}, got ${onChainAdmin}`);
  }
  console.log("  ✅ constructor admin verified");

  // --- create_order ---
  const created = await client.buildCreateOrder({
    admin,
    orderId,
    buyer,
    seller,
    payoutRecipient: recipient,
    amount,
    expiresAt,
  });
  const cr = await signSubmitPoll(client, created, secret("tt-admin"));
  logStep("create_order", cr.hash);

  // --- get_order == Created ---
  const afterCreate = await client.readOrder(orderId);
  logOrder(afterCreate);
  if (afterCreate?.status !== "Created") {
    throw new Error(`expected Created, got ${afterCreate?.status}`);
  }
  console.log("  ✅ get_order == Created");

  // --- fund_order prepare/simulate ---
  let fundTx: Awaited<ReturnType<EscrowClient["buildFundOrder"]>> | null = null;
  try {
    fundTx = await client.buildFundOrder({ buyer, orderId, amount });
    console.log("  ✅ fund_order prepared/simulated OK");
  } catch (e) {
    console.log(
      `  ⛔ fund_order prepare BLOCKED: ${(e as Error).message.slice(0, 300)}`,
    );
  }

  if (mode !== "full") {
    console.log("  (mode=usdc: not submitting fund_order — real USDC needed)");
    return;
  }

  if (!fundTx)
    throw new Error("cannot proceed to full flow: fund prepare failed");

  // --- submit fund_order -> Funded ---
  const fr = await signSubmitPoll(client, fundTx, secret("tt-buyer"));
  logStep("fund_order", fr.hash);
  const afterFund = await client.readOrder(orderId);
  logOrder(afterFund);
  if (afterFund?.status !== "Funded") {
    throw new Error(`expected Funded, got ${afterFund?.status}`);
  }
  console.log("  ✅ get_order == Funded");

  // --- release_to_recipient -> Released ---
  const releaseTx = await client.buildReleaseToRecipient(admin, orderId);
  const rr = await signSubmitPoll(client, releaseTx, secret("tt-admin"));
  logStep("release_to_recipient", rr.hash);
  const afterRelease = await client.readOrder(orderId);
  logOrder(afterRelease);
  if (afterRelease?.status !== "Released") {
    throw new Error(`expected Released, got ${afterRelease?.status}`);
  }
  console.log("  ✅ get_order == Released");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
