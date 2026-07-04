"use client";

// Payment progress timeline + status banner. Text reflects backend truth only.

import type { CheckoutError, CheckoutPhase } from "./useCheckoutFlow";
import { errorLabel, isRetryable, PHASE_LABEL, TIMELINE_STEPS } from "./labels";

/** How far along the timeline each phase has progressed (index into steps). */
function stepIndex(phase: CheckoutPhase): number {
  switch (phase) {
    case "form":
    case "creating-order":
      return -1;
    case "order-ready":
    case "connecting":
      return 0;
    case "connected":
    case "requesting-token":
    case "creating-escrow":
    case "preparing":
      return 1;
    case "awaiting-signature":
      return 2;
    case "submitting":
    case "confirming":
      return 3;
    case "confirmed":
      return 4;
    case "failed":
      return 3;
  }
}

export function CheckoutStatus({
  phase,
  error,
  txHash,
  onRetry,
}: {
  phase: CheckoutPhase;
  error: CheckoutError | null;
  txHash: string | null;
  onRetry: (() => void) | null;
}) {
  const active = stepIndex(phase);
  const busy =
    phase !== "confirmed" &&
    phase !== "failed" &&
    error === null &&
    active >= 0;
  const confirmed = phase === "confirmed";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="micro-label text-mist">03 · Pembayaran</span>
        <span className="h-px flex-1 bg-hairline" aria-hidden />
      </div>

      {/* Timeline */}
      <ol className="flex items-start gap-2">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < active || confirmed;
          const current = i === active && !confirmed;
          return (
            <li key={step.key} className="flex flex-1 flex-col gap-2">
              <span
                className={`h-px w-full transition-colors duration-500 ${
                  done ? "bg-bone/70" : current ? "bg-blood" : "bg-hairline"
                }`}
              />
              <span
                className={`micro-label leading-tight ${
                  done ? "text-mist" : current ? "text-blood" : "text-bone/25"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Status banner */}
      <div
        className={`border px-4 py-3.5 text-sm ${
          confirmed
            ? "border-bone/30 bg-surface text-bone"
            : error
              ? "border-blood/40 bg-surface text-blood"
              : "border-hairline bg-surface text-mist"
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          {confirmed && (
            <span aria-hidden className="text-blood">
              ◈
            </span>
          )}
          {error ? errorLabel(error.code, error.message) : PHASE_LABEL[phase]}
        </div>
        {busy && (
          <div className="micro-label mt-2 text-ash">
            Jangan tutup halaman ini
          </div>
        )}
        {confirmed && (
          <div className="mt-2 text-xs leading-relaxed text-mist/80">
            Dana kamu ditahan aman sampai pesanan diterima.
          </div>
        )}
        {error?.retryAfterSeconds != null && (
          <div className="mt-2 text-xs text-mist/70">
            Coba lagi dalam ±{error.retryAfterSeconds} detik.
          </div>
        )}
        {error && onRetry && isRetryable(error.code) && (
          <button
            type="button"
            onClick={onRetry}
            className="micro-label mt-4 border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood active:scale-[0.99]"
          >
            Coba Lagi
          </button>
        )}
      </div>

      {txHash && (
        <p className="break-all font-mono text-[10px] leading-relaxed text-ash">
          <span className="micro-label text-ash">Bukti transaksi</span>
          <br />
          {txHash}
        </p>
      )}
    </div>
  );
}
