import { getNetworkConfig } from "@trustip/stellar";

async function startIndexer() {
  const config = getNetworkConfig();
  console.log(
    `[Indexer] Starting indexer on network: ${config.usdcAssetCode} on ${currentNetworkName()}`,
  );

  setInterval(() => {
    console.log("[Indexer] Syncing Soroban contract events...");
    // Sync logic will be implemented in a future phase
  }, 30000);
}

function currentNetworkName(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
}

startIndexer().catch((err) => {
  console.error("[Indexer] Fatal error:", err);
  process.exit(1);
});
