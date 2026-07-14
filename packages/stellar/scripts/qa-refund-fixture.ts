/**
 * QA fixture — build a REAL on-chain Funded escrow for the refund flow test.
 * TESTNET ONLY. create_order (tt-admin) + fund_order (tt-buyer) via CLI keys,
 * stopping at Funded (does NOT release). Prints the contract_order_id (hex),
 * buyer pubkey, seller pubkey and amount for the DB seed step.
 *
 * Usage (from repo root):
 *   AMOUNT=15000000 REF=qa-refund-1 \
 *   NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=C... \
 *   npx tsx packages/stellar/scripts/qa-refund-fixture.ts
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
} from "../src/index.js";

const cli = (args: string[]): string =>
  execFileSync("stellar", args, { encoding: "utf8" }).trim();
const addr = (name: string): string => cli(["keys", "address", name]);
const secret = (name: string): string => cli(["keys", "secret", name]);
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

async function signSubmitPoll(
  client: EscrowClient,
  tx: { sign: (k: Keypair) => void; toXDR: () => string },
  signerSecret: string,
  label: string,
): Promise<void> {
  tx.sign(Keypair.fromSecret(signerSecret));
  const sent = await client.submit(tx.toXDR());
  if (sent.status === "ERROR") {
    throw new Error(`${label} send ERROR: ${JSON.stringify(sent.errorResult ?? sent)}`);
  }
  let res = await client.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    res = await client.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") {
    throw new Error(`${label} not SUCCESS: ${res.status}`);
  }
  console.error(`  OK ${label}: ${explorerTxUrl("testnet", sent.hash)}`);
}

async function main(): Promise<void> {
  if (networkName() !== "testnet") {
    throw new Error(`refusing: network is ${networkName()}, not testnet`);
  }
  const escrowId = process.env.NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID;
  if (!escrowId) throw new Error("NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID required");

  const amount = BigInt(process.env.AMOUNT || "15000000"); // 1.5 USDC
  const ref = `${process.env.REF || "qa-refund"}-${Date.now()}`;
  const admin = addr("tt-admin");
  const buyer = addr("tt-buyer");
  const seller = addr("tt-seller");

  const client = new EscrowClient({
    server: getRpcServer() as rpc.Server,
    networkPassphrase: currentNetwork.networkPassphrase,
    contractId: escrowId,
  });

  const orderId = deriveContractOrderId(ref);
  const orderIdHex = Buffer.from(orderId).toString("hex");
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.error(`\n=== QA refund fixture ref=${ref} amount=${amount} ===`);
  const created = await client.buildCreateOrder({
    admin, orderId, buyer, seller, payoutRecipient: seller, amount, expiresAt,
  });
  await signSubmitPoll(client, created, secret("tt-admin"), "create_order");

  const funded = await client.buildFundOrder({ buyer, orderId, amount });
  await signSubmitPoll(client, funded, secret("tt-buyer"), "fund_order");

  const view = await client.readOrder(orderId);
  if (view?.status !== "Funded") {
    throw new Error(`expected Funded, got ${view?.status}`);
  }
  console.error(`  OK get_order == Funded\n`);

  // Machine-readable line for the seed step (stdout only).
  console.log(
    JSON.stringify({
      contractOrderIdHex: orderIdHex,
      buyer, seller, amountStroops: amount.toString(),
      amountUsdc: (Number(amount) / 1e7).toFixed(7),
    }),
  );
}

main().catch((e) => {
  console.error("FIXTURE FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
