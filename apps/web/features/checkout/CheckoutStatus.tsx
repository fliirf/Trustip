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

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <ol className="flex items-center gap-2">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < active || phase === "confirmed";
          const current = i === active && phase !== "confirmed";
          return (
            <li
              key={step.key}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  done
                    ? "bg-emerald-400"
                    : current
                      ? "bg-sky-400 animate-pulse"
                      : "bg-white/15"
                }`}
              />
              <span
                className={`text-center text-[10px] leading-tight ${
                  done || current ? "text-gray-300" : "text-gray-600"
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
        className={`rounded-md border px-4 py-3 text-sm ${
          phase === "confirmed"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : error
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-white/10 bg-white/[0.03] text-gray-300"
        }`}
      >
        <div className="font-medium">
          {error ? errorLabel(error.code, error.message) : PHASE_LABEL[phase]}
        </div>
        {busy && (
          <div className="mt-1 text-xs text-gray-500">
            Jangan tutup halaman ini.
          </div>
        )}
        {phase === "confirmed" && (
          <div className="mt-1 text-xs text-emerald-400/80">
            Dana kamu ditahan aman sampai pesanan diterima.
          </div>
        )}
        {error?.retryAfterSeconds != null && (
          <div className="mt-1 text-xs">
            Coba lagi dalam ±{error.retryAfterSeconds} detik.
          </div>
        )}
        {error && onRetry && isRetryable(error.code) && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-white/20 px-4 py-1.5 text-xs font-medium text-gray-100 transition-colors hover:border-white/50"
          >
            Coba Lagi
          </button>
        )}
      </div>

      {txHash && (
        <p className="break-all font-mono text-[10px] text-gray-600">
          Bukti transaksi: {txHash}
        </p>
      )}
    </div>
  );
}
