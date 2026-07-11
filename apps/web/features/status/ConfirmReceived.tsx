"use client";

// Buyer "Pesanan Diterima" flow on the public status page. Renders the CTA and
// a safety panel that: shows the order + tracking, warns to confirm only after
// receiving the item, connects the buyer wallet, and asks the wallet to sign a
// server challenge. Nothing is marked locally before the backend confirms the
// release — the release is entirely backend-driven and requires the funding
// wallet's signature.
//
// PHASE 14 — this is the only dialog in the app, and it is a MISSION dialog.
// It does not float: it docks. A bottom sheet on a phone, a console window
// against the right edge on a desktop, carrying the same spine down its left
// that the status page runs down its whole length. The reader never leaves
// mission control to answer its question.

import type { WalletId } from "@trustip/stellar";
import { useEffect, useRef } from "react";
import { confirmErrorLabel, isConfirmRetryable } from "./labels";
import type { PublicOrderStatus } from "./status-api";
import { type ConfirmPhase, useConfirmReceived } from "./useConfirmReceived";

const PROGRESS_LABEL: Partial<Record<ConfirmPhase, string>> = {
  connecting: "Menghubungkan wallet…",
  preparing: "Menyiapkan konfirmasi…",
  "awaiting-signature": "Buka jendela wallet kamu dan setujui permintaan tanda tangan…",
  releasing: "Meneruskan dana ke penjual…",
};

function truncateKey(k: string): string {
  return `${k.slice(0, 6)}…${k.slice(-6)}`;
}

const BUSY: ConfirmPhase[] = [
  "connecting",
  "preparing",
  "awaiting-signature",
  "releasing",
];

/** An engraved telemetry row. Same rule the status page uses for its readings. */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="engraved-b flex items-baseline justify-between gap-4 py-2.5">
      <dt className="micro-label shrink-0 text-ash">{label}</dt>
      <dd className={`text-right text-mist ${mono ? "os-serial font-mono" : "os-body"}`}>{value}</dd>
    </div>
  );
}

export function ConfirmReceived({
  slug,
  order,
  open,
  onOpen,
  onClose,
  onCompleted,
}: {
  slug: string;
  order: PublicOrderStatus;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCompleted: (releaseTxHash: string) => void;
}) {
  const flow = useConfirmReceived(slug, order.orderNo);
  const busy = BUSY.includes(flow.phase);
  const panel = useRef<HTMLDivElement | null>(null);

  // Detect wallets once the panel opens.
  useEffect(() => {
    if (open) flow.detectWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // On backend-confirmed release, hand the tx hash up so the page refetches
  // into its completed state (this component then unmounts).
  useEffect(() => {
    if (flow.phase === "done" && flow.releaseTxHash) {
      onCompleted(flow.releaseTxHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.phase, flow.releaseTxHash]);

  /* Opening: the panel takes focus, the page behind stops scrolling, and the
     trigger gets its focus back on close. Keyed on `open` alone — the previous
     version also re-ran on every `busy` change and re-focused the panel
     mid-flow, stealing focus from whatever key the reader was on. */
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = scroll;
      before?.focus();
    };
  }, [open]);

  /* Escape closes, and Tab cycles inside the dialog — without the trap, Tab
     walked out into the page behind the scrim while the dialog claimed
     aria-modal. Escape is ignored while the wallet is mid-signature, for the
     same reason the backdrop click is. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const shipment = order.shipment;
  const tracking = [shipment?.courier, shipment?.trackingNumber]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {/* The trigger is a station on the spine, not a bordered card. */}
      <div>
        <div className="micro-label text-blood">Pesanan Sudah Dikirim</div>
        <p className="os-body mt-4 max-w-[52ch] text-mist/80">
          Kalau barang sudah kamu terima, konfirmasi penerimaan untuk meneruskan
          dana ke penjual. Pastikan barang benar-benar sudah sampai.
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mat-illuminated os-press mt-7 inline-block px-6 py-3 text-sm font-semibold tracking-tight text-void hover:text-bone"
        >
          Saya Sudah Terima Pesanan
        </button>
      </div>

      {open && (
        <div
          className="dialog-scrim flex items-end justify-center md:items-stretch md:justify-end"
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          <div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi penerimaan pesanan"
            className="dialog-mission max-h-[92dvh] w-full overflow-y-auto py-7 pr-6 pl-8 focus:outline-none md:max-h-none md:w-[440px] md:py-12 md:pr-10 md:pl-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="micro-label text-ash">Konfirmasi Penerimaan</div>

            {/* Telemetry: what is about to move, and where from. */}
            <dl className="mt-8">
              <Row label="Pesanan" value={order.orderNo} mono />
              {tracking && <Row label="Resi" value={tracking} />}
              <Row label="Total" value={`${order.totalUsdc} USDC`} />
            </dl>

            {/* The one irreversible fact on the page. A lit edge, not a red box:
                mission control states, it does not shout. */}
            <div className="relative mt-8 pl-5">
              <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-blood" />
              <p className="os-body text-mist">
                Pastikan barang sudah kamu terima sebelum melanjutkan. Dana akan
                diteruskan ke seller setelah kamu menandatangani konfirmasi, dan
                langkah ini tidak bisa dibatalkan.
              </p>
            </div>

            {flow.phase === "done" ? (
              <div className="mt-10">
                <div className="os-reading text-bone">Pesanan Selesai</div>
                <p className="os-note mt-2 text-mist/70">
                  Dana sudah diteruskan ke penjual. Terima kasih!
                </p>
              </div>
            ) : (
              <div className="mt-10 space-y-6">
                {!flow.publicKey ? (
                  <div className="space-y-4">
                    <div className="micro-label text-mist">Hubungkan wallet pembayar</div>
                    {flow.wallets.length > 0 && !flow.wallets.some((w) => w.installed) && (
                      <p className="os-note text-mist/80">
                        Wallet belum terpasang. Pasang Freighter atau xBull, lalu
                        muat ulang halaman ini.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {flow.wallets.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!w.installed || busy}
                          onClick={() => flow.connect(w.id as WalletId)}
                          className="mat-key os-press flex items-center gap-3 border border-hairline px-4 py-3 text-left"
                        >
                          {/* A status lamp, lit only where a wallet actually is.
                              Same lamp the checkout terminal uses. */}
                          <span
                            aria-hidden
                            className={`h-7 w-[3px] shrink-0 ${
                              w.installed ? "mat-emissive bg-blood" : "bg-hairline"
                            }`}
                          />
                          <span className="flex flex-col leading-tight">
                            <span className="text-sm font-medium text-bone">{w.name}</span>
                            <span className="micro-label mt-1 text-ash">
                              {w.installed ? "Stellar" : "Belum terpasang"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <dl>
                      <Row label="Wallet" value={truncateKey(flow.publicKey)} mono />
                    </dl>
                    {flow.wrongNetwork && (
                      <p className="micro-label text-blood">
                        Wallet berada di jaringan berbeda. Ganti ke jaringan yang
                        benar sebelum menandatangani.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => flow.confirm()}
                      className="mat-illuminated os-press w-full px-6 py-3.5 text-sm font-semibold tracking-tight text-void hover:text-bone"
                    >
                      Tandatangani Konfirmasi
                    </button>
                  </div>
                )}

                {PROGRESS_LABEL[flow.phase] && (
                  <p className="micro-label text-ash">{PROGRESS_LABEL[flow.phase]}</p>
                )}

                {/* Error — never hidden. Mission control renders a fault as a
                    live node on the spine, exactly as the page does. */}
                {flow.error && (
                  <div role="alert" className="relative pl-5">
                    <span
                      aria-hidden
                      data-live="true"
                      className="control-node absolute top-[0.45em] -left-[3px] size-[6px]"
                    />
                    <p className="os-body text-blood">
                      {confirmErrorLabel(flow.error.code, flow.error.message)}
                    </p>
                    {isConfirmRetryable(flow.error.code) && flow.publicKey && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => flow.confirm()}
                        className="os-press micro-label mt-4 inline-block border-b border-blood/50 pb-1 text-bone hover:text-blood"
                      >
                        Coba Lagi
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="os-press micro-label mt-10 text-ash hover:text-mist"
            >
              {flow.phase === "done" ? "Tutup" : "Batal"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
