"use client";

import type { WalletAvailability, WalletId } from "@trustip/stellar";
import { useEffect, useState } from "react";
import { useDict } from "../i18n/LocaleProvider";
import { ErrorState } from "../ui/ErrorState";

const INSTALL_URL: Record<string, string> = {
  freighter: "https://freighter.app/",
  xbull: "https://xbull.app/",
};

const linkCls =
  "os-transition text-mist underline underline-offset-2 hover:text-blood";

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
  // The key the buyer actually pressed. A generic "connecting…" on both keys
  // claimed a connection with a wallet nobody had asked for.
  const [pressedId, setPressedId] = useState<WalletId | null>(null);
  const d = useDict().checkout.wallet;

  useEffect(() => {
    onDetect();
    // detect once when the wallet step becomes visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyInstalled = wallets.some((w) => w.installed);

  return (
    // No section rule here: the stage label lives on the terminal's progression
    // rail now, and printing it twice would put the machine's own chapter marker
    // inside one of its modules.
    <div className="space-y-4">
      {/* One guiding line for the first-timer standing at this step. */}
      <p className="os-note text-ash">{d.guidance}</p>
      {wallets.length > 0 && !anyInstalled && (
        <ErrorState
          surface="checkout"
          title={d.notInstalledTitle}
          detail={d.notInstalledDetail}
          hint={
            <>
              {d.notInstalledHintA}
              <a
                href={INSTALL_URL.freighter}
                target="_blank"
                rel="noreferrer noopener"
                className={linkCls}
              >
                Freighter
              </a>
              {d.notInstalledHintB}
              <a
                href={INSTALL_URL.xbull}
                target="_blank"
                rel="noreferrer noopener"
                className={linkCls}
              >
                xBull
              </a>
              {d.notInstalledHintC}
            </>
          }
          action={{ label: d.redetect, onClick: onDetect }}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
        {wallets.map((w) => {
          // A wallet that isn't installed becomes a link to install it. A
          // disabled button that does nothing on click is the dead end this
          // replaces.
          //
          // `terminal-control`: a machine key, not a card. It lights its rim on
          // hover and swaps its lips on press.
          const cardCls =
            "terminal-control os-press group flex items-center gap-3 px-4 py-3.5 text-left";
          const inner = (
            <>
              {/* The key's status lamp. Lit only where a wallet actually is. */}
              <span
                aria-hidden
                className={`h-8 w-[3px] shrink-0 ${
                  w.installed ? "mat-emissive bg-blood" : "bg-hairline"
                }`}
              />
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-bone">{w.name}</span>
                <span className="micro-label mt-1 text-ash">
                  {w.installed
                    ? connecting && pressedId === w.id
                      ? d.connecting
                      : d.stellar
                    : d.installWallet}
                </span>
              </span>
            </>
          );

          if (!w.installed && INSTALL_URL[w.id]) {
            return (
              <a
                key={w.id}
                href={INSTALL_URL[w.id]}
                target="_blank"
                rel="noreferrer noopener"
                className={`${cardCls} opacity-60 hover:opacity-100`}
              >
                {inner}
              </a>
            );
          }

          return (
            <button
              key={w.id}
              type="button"
              disabled={!w.installed || connecting}
              onClick={() => {
                setPressedId(w.id);
                onConnect(w.id);
              }}
              className={cardCls}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}
