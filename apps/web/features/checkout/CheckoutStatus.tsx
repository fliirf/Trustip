"use client";

// Payment progress timeline + status banner. Text reflects backend truth only.

import { explorerTxUrl, networkName } from "@trustip/stellar";
import { ErrorState } from "../ui/ErrorState";
import type { CheckoutError, CheckoutPhase } from "./useCheckoutFlow";
import {
  errorHint,
  errorLabel,
  isRetryable,
  PHASE_DETAIL,
  PHASE_LABEL,
  TIMELINE_STEPS,
} from "./labels";

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
    // No section rule: the stage label lives on the terminal's progression rail.
    <div className="space-y-6">
      {/* The payment channel. Horizontal, milled, and segmented: each step is a
          length of channel that lights when the backend says it is lit. This is
          the machine's own progress bar, not a row of cards. */}
      <ol aria-label="Progres pembayaran" className="flex items-start gap-1.5">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < active || confirmed;
          const current = i === active && !confirmed;
          return (
            <li
              key={step.key}
              aria-current={current ? "step" : undefined}
              className="flex flex-1 flex-col gap-2.5"
            >
              <span
                className={`os-settle h-[3px] w-full ${
                  done
                    ? "bg-bone/70"
                    : current
                      ? "mat-emissive bg-blood"
                      : "bg-hairline"
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

      {/* Status readout. A failure never silently ends the flow: it states what
          happened, what to do, and offers the retry when retrying is safe. */}
      {error ? (
        <ErrorState
          surface="checkout"
          title={PHASE_LABEL.failed}
          detail={errorLabel(error.code, error.message)}
          hint={
            error.retryAfterSeconds != null
              ? `Coba lagi dalam ±${error.retryAfterSeconds} detik.`
              : errorHint(error.code)
          }
          action={
            onRetry && isRetryable(error.code)
              ? { label: "Coba Lagi", onClick: onRetry }
              : undefined
          }
        />
      ) : (
        // role="status": the phase headline changes as the backend advances, and
        // a screen-reader user waiting on their money hears each change without
        // hunting for it.
        <div role="status" className="terminal-panel relative px-5 py-4 text-sm">
          {/* The machine's state lamp: a lit edge, not a glyph. Only powered
              while the network is actually being waited on. */}
          <span
            aria-hidden
            className={`absolute inset-y-0 left-0 w-[2px] ${
              confirmed ? "bg-bone/60" : busy ? "bg-blood" : "bg-hairline"
            }`}
          />
          <div className={`font-medium ${confirmed ? "text-bone" : "text-mist"}`}>
            {PHASE_LABEL[phase]}
          </div>
          {busy && (
            <>
              <div className="os-note mt-2 text-mist/80">
                {PHASE_DETAIL[phase] ?? "Menunggu jaringan Stellar"}
              </div>
              <div className="micro-label mt-2 text-ash">Jangan tutup halaman ini</div>
              <div aria-hidden className="mt-4 h-[2px] w-full overflow-hidden bg-hairline">
                <span className="boot-bar block h-full w-full origin-left bg-blood" />
              </div>
            </>
          )}
          {confirmed && (
            <div className="os-note mt-2 text-mist/80">
              Dana kamu ditahan aman sampai pesanan diterima. Selanjutnya
              penjual menyiapkan pesanan kamu; pantau perkembangannya di halaman
              status.
            </div>
          )}
        </div>
      )}

      {txHash && (
        <div>
          <p className="os-serial font-mono text-ash">
            <span className="micro-label text-ash">Bukti transaksi</span>
            <br />
            {txHash}
          </p>
          {/* The same proof affordance the status page gives: the buyer can
              verify the hash on-chain from the moment it exists, not one page
              later. */}
          <a
            href={explorerTxUrl(networkName(), txHash)}
            target="_blank"
            rel="noreferrer"
            className="terminal-control os-press micro-label mt-4 inline-block px-4 py-2.5 text-bone"
          >
            Lihat di Explorer
          </a>
        </div>
      )}
    </div>
  );
}
