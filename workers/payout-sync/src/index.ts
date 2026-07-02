async function startPayoutSync() {
  console.log("[Payout Sync] Starting payout sync worker...");

  setInterval(() => {
    console.log(
      "[Payout Sync] Checking pending multi-route payouts (USDC, XLM, MoneyGram)...",
    );
    // Payout sync logic will be implemented in a future phase
  }, 60000);
}

startPayoutSync().catch((err) => {
  console.error("[Payout Sync] Fatal error:", err);
  process.exit(1);
});
