async function startRefundReviewSync() {
  console.log("[Refund Review Sync] Starting refund review sync worker...");

  setInterval(() => {
    console.log(
      "[Refund Review Sync] Checking admin dispute review timers and refund requests...",
    );
    // Refund review status sync logic will be implemented in a future phase
  }, 60000);
}

startRefundReviewSync().catch((err) => {
  console.error("[Refund Review Sync] Fatal error:", err);
  process.exit(1);
});
