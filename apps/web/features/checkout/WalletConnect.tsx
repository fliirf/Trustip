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
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-200">Hubungkan Wallet</div>
      {wallets.length > 0 && !anyInstalled && (
        <p className="text-sm text-amber-400/90">
          Wallet belum terpasang. Pasang Freighter atau xBull di browser kamu,
          lalu muat ulang halaman ini.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {wallets.map((w) => (
          <button
            key={w.id}
            type="button"
            disabled={!w.installed || connecting}
            onClick={() => onConnect(w.id)}
            className="rounded-md border border-white/15 px-4 py-3 text-left text-sm text-gray-100 transition-colors hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block font-medium">{w.name}</span>
            <span className="block text-xs text-gray-400">
              {w.installed
                ? connecting
                  ? "Menghubungkan…"
                  : "Stellar"
                : "Belum terpasang"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
