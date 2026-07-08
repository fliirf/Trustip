"use client";

// Buyer "Pesanan Diterima" flow on the public status page. Renders the CTA and
// a VOID-styled safety panel that: shows the order + tracking, warns to confirm
// only after receiving the item, connects the buyer wallet, and asks the wallet
// to sign a server challenge. Nothing is marked locally before the backend
// confirms the release — the release is entirely backend-driven and requires
// the funding wallet's signature.

import type { WalletId } from "@trustip/stellar";
import { useEffect } from "react";
import { confirmErrorLabel, isConfirmRetryable } from "./labels";
import type { PublicOrderStatus } from "./status-api";
import { type ConfirmPhase, useConfirmReceived } from "./useConfirmReceived";

const PROGRESS_LABEL: Partial<Record<ConfirmPhase, string>> = {
  connecting: "Menghubungkan wallet…",
  preparing: "Menyiapkan konfirmasi…",
  "awaiting-signature": "Menunggu tanda tangan di wallet…",
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

  const shipment = order.shipment;
  const tracking = [shipment?.courier, shipment?.trackingNumber]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="border border-blood/40 bg-surface px-5 py-6">
      <div className="micro-label flex items-center gap-2 text-blood">
        <span aria-hidden>◈</span> Pesanan Sudah Dikirim
      </div>
      <p className="mt-3 text-sm leading-relaxed text-mist/80">
        Kalau barang sudah kamu terima, konfirmasi penerimaan untuk meneruskan
        dana ke penjual. Pastikan barang benar-benar sudah sampai.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 inline-block bg-bone px-6 py-3 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99]"
      >
        Saya Sudah Terima Pesanan
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi penerimaan pesanan"
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 px-4 py-6 backdrop-blur-sm md:items-center"
          onClick={() => {
            if (!busy) onClose();
          }}
        >
          <div
            className="w-full max-w-md border border-hairline bg-surface px-6 py-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="micro-label flex items-center gap-2 text-ash">
              <span aria-hidden className="text-blood">
                ◈
              </span>
              Konfirmasi Penerimaan
            </div>

            {/* Order + tracking summary */}
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-2.5">
                <dt className="micro-label text-ash">Pesanan</dt>
                <dd className="font-mono text-mist">{order.orderNo}</dd>
              </div>
              {tracking && (
                <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-2.5">
                  <dt className="micro-label text-ash">Resi</dt>
                  <dd className="text-right text-mist">{tracking}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-2.5">
                <dt className="micro-label text-ash">Total</dt>
                <dd className="font-semibold text-bone">
                  {order.totalUsdc} USDC
                </dd>
              </div>
            </dl>

            {/* Warning */}
            <p className="mt-5 border border-blood/40 px-3 py-2.5 text-sm leading-relaxed text-mist">
              Pastikan barang sudah kamu terima sebelum melanjutkan. Dana akan
              diteruskan ke seller setelah kamu menandatangani konfirmasi, dan
              langkah ini tidak bisa dibatalkan.
            </p>

            {/* Success */}
            {flow.phase === "done" ? (
              <div className="mt-6">
                <div className="text-lg font-semibold tracking-tight text-bone">
                  Pesanan Selesai
                </div>
                <p className="mt-1 text-sm text-mist/70">
                  Dana sudah diteruskan ke penjual. Terima kasih!
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {/* Wallet step */}
                {!flow.publicKey ? (
                  <div className="space-y-3">
                    <div className="micro-label text-mist">
                      Hubungkan wallet pembayar
                    </div>
                    {flow.wallets.length > 0 &&
                      !flow.wallets.some((w) => w.installed) && (
                        <p className="border border-hairline px-3 py-2 text-sm text-mist/80">
                          Wallet belum terpasang. Pasang Freighter atau xBull,
                          lalu muat ulang halaman ini.
                        </p>
                      )}
                    <div className="grid grid-cols-2 gap-3">
                      {flow.wallets.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!w.installed || busy}
                          onClick={() => flow.connect(w.id as WalletId)}
                          className="group flex items-center gap-3 border border-hairline bg-void px-4 py-3 text-left transition-colors duration-300 hover:border-blood disabled:pointer-events-none disabled:opacity-35"
                        >
                          <span
                            aria-hidden
                            className="grid h-6 w-6 shrink-0 place-items-center border border-blood/40 text-[11px] leading-none text-blood"
                          >
                            ◈
                          </span>
                          <span className="flex flex-col leading-tight">
                            <span className="text-sm font-medium text-bone">
                              {w.name}
                            </span>
                            <span className="micro-label mt-1 text-ash">
                              {w.installed ? "Stellar" : "Belum terpasang"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-2.5 text-sm">
                      <span className="micro-label text-ash">Wallet</span>
                      <span className="font-mono text-mist">
                        {truncateKey(flow.publicKey)}
                      </span>
                    </div>
                    {flow.wrongNetwork && (
                      <p className="micro-label border border-blood/40 px-3 py-2 text-blood">
                        Wallet berada di jaringan berbeda. Ganti ke jaringan
                        yang benar sebelum menandatangani.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => flow.confirm()}
                      className="w-full bg-bone px-6 py-3 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
                    >
                      Tandatangani Konfirmasi
                    </button>
                  </div>
                )}

                {/* Progress */}
                {PROGRESS_LABEL[flow.phase] && (
                  <p className="micro-label text-ash">
                    {PROGRESS_LABEL[flow.phase]}
                  </p>
                )}

                {/* Error — never hidden */}
                {flow.error && (
                  <div className="border border-blood/40 px-3 py-2.5">
                    <p className="text-sm text-blood">
                      {confirmErrorLabel(flow.error.code, flow.error.message)}
                    </p>
                    {isConfirmRetryable(flow.error.code) && flow.publicKey && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => flow.confirm()}
                        className="micro-label mt-3 inline-block border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood disabled:opacity-40"
                      >
                        Coba Lagi
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cancel / close */}
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="micro-label mt-6 text-ash transition-colors duration-300 hover:text-mist disabled:opacity-40"
            >
              {flow.phase === "done" ? "Tutup" : "Batal"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
