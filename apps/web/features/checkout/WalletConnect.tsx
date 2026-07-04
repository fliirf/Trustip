"use client";

import type { WalletAvailability, WalletId } from "@trustip/stellar";
import { useEffect } from "react";

export function WalletConnect({
  wallets,
  connecting,
  onDetect,
  onConnect,
}: {
  wallets: WalletAvailability[];
  connecting: boolean;
  onDetect: () => void;
  onConnect: (id: WalletId) => void;
}) {
  useEffect(() => {
    onDetect();
    // detect once when the wallet step becomes visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyInstalled = wallets.some((w) => w.installed);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="micro-label text-mist">02 · Hubungkan Wallet</span>
        <span className="h-px flex-1 bg-hairline" aria-hidden />
      </div>
      {wallets.length > 0 && !anyInstalled && (
        <p className="border border-hairline px-3 py-2 text-sm text-mist/80">
          Wallet belum terpasang. Pasang Freighter atau xBull di browser kamu,
          lalu muat ulang halaman ini.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        {wallets.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={!w.installed || connecting}
            onClick={() => onConnect(w.id)}
            className="group flex items-center gap-3 border border-hairline bg-surface px-4 py-3.5 text-left transition-colors duration-300 hover:border-blood disabled:pointer-events-none disabled:opacity-35"
          >
            <span
              aria-hidden
              className="grid h-6 w-6 shrink-0 place-items-center border border-blood/40 text-[11px] leading-none text-blood transition-colors duration-300 group-hover:border-blood"
            >
              ◈
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-bone">{w.name}</span>
              <span className="micro-label mt-1 text-ash">
                {w.installed
                  ? connecting
                    ? "Menghubungkan…"
                    : "Stellar"
                  : "Belum terpasang"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
