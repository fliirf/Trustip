/**
 * scripts/pause-contract.ts — emergency pause / unpause for the escrow
 * contract (CLAUDE.md §14: emergency pause must be one command).
 *
 * Signs with the configured operator (the contract admin), same fail-closed
 * policy as the payment gateway: on mainnet the env signer is refused unless
 * TRUSTIP_ALLOW_MAINNET_OPERATOR=true.
 *
 * Usage:
 *   STELLAR_NETWORK=testnet pnpm pause:contract pause
 *   STELLAR_NETWORK=testnet pnpm pause:contract unpause
 */
import { createEscrowClient } from "../packages/stellar/src/network.js";
import { createOperatorSigner } from "../packages/stellar/src/operator.js";
import { currentNetwork } from "@trustip/config";

async function main(): Promise<void> {
  const action = process.argv[2];
  if (action !== "pause" && action !== "unpause") {
    console.error("usage: pause-contract.ts <pause|unpause>");
    process.exit(2);
  }
  if (!process.env.STELLAR_NETWORK) {
    // Explicit network only — an emergency command must never guess.
    console.error("STELLAR_NETWORK must be set explicitly (testnet|mainnet)");
    process.exit(2);
  }

  const client = createEscrowClient();
  const operator = createOperatorSigner();
  console.log(
    `[pause-contract] ${action} on ${process.env.STELLAR_NETWORK} as ${operator.publicKey}`,
  );

  const tx =
    action === "pause"
      ? await client.buildPause(operator.publicKey)
      : await client.buildUnpause(operator.publicKey);
  const signedXdr = await operator.signXdr(
    tx.toXDR(),
    currentNetwork.networkPassphrase,
  );
  const res = await client.submit(signedXdr);
  console.log(`[pause-contract] submitted: ${res.hash} (${res.status})`);

  // Poll until the tx lands so the operator KNOWS the contract state changed.
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const result = await client.getTransaction(res.hash);
    if (result.status === "SUCCESS") {
      console.log(`[pause-contract] ${action} CONFIRMED (ledger ${result.ledger})`);
      return;
    }
    if (result.status === "FAILED") {
      console.error("[pause-contract] transaction FAILED on-chain");
      process.exit(1);
    }
  }
  console.error(
    `[pause-contract] not confirmed yet — check tx ${res.hash} manually before assuming the contract is ${action}d`,
  );
  process.exit(1);
}

main().catch((e) => {
  console.error("[pause-contract] error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
