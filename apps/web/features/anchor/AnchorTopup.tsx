"use client";

import type { WalletId } from "@trustip/stellar";
import { useEffect } from "react";
import { useDict } from "../i18n/LocaleProvider";
import { useAnchorTopup, type TopupPhase } from "./useAnchorTopup";

const INSTALL_URL: Record<string, string> = {
  freighter: "https://freighter.app/",
  xbull: "https://xbull.app/",
};

const busy = (p: TopupPhase) =>
  p === "connecting" || p === "authenticating" || p === "starting";

export function AnchorTopup() {
  const t = useAnchorTopup();
  const d = useDict().anchor;

  useEffect(() => {
    t.detectWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyInstalled = t.wallets.some((w) => w.installed);

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-16">
      <header className="space-y-3">
        <p className="micro-label text-ash">{d.eyebrow}</p>
        <h1 className="text-3xl font-semibold text-bone">{d.title}</h1>
        <p className="os-note text-mist">
          {d.introA}
          <span className="text-bone">{t.anchorDomain}</span>
          {d.introB}
        </p>
      </header>

      {/* Wallet selection — only at the start. */}
      {t.phase === "idle" && (
        <div className="space-y-4">
          <p className="os-note text-ash">{d.connectPrompt}</p>
          {t.wallets.length > 0 && !anyInstalled && (
            <p className="os-note text-ash">
              {d.walletNotInstalledA}
              <a
                href={INSTALL_URL.freighter}
                target="_blank"
                rel="noreferrer noopener"
                className="os-transition text-mist underline underline-offset-2 hover:text-blood"
              >
                Freighter
              </a>
              {d.walletNotInstalledB}
              <a
                href={INSTALL_URL.xbull}
                target="_blank"
                rel="noreferrer noopener"
                className="os-transition text-mist underline underline-offset-2 hover:text-blood"
              >
                xBull
              </a>
              {d.walletNotInstalledC}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            {t.wallets.map((w) => {
              const cardCls =
                "terminal-control os-press group flex items-center gap-3 px-4 py-3.5 text-left";
              const inner = (
                <>
                  <span
                    aria-hidden
                    className={`h-8 w-[3px] shrink-0 ${
                      w.installed ? "mat-emissive bg-blood" : "bg-hairline"
                    }`}
                  />
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-medium text-bone">
                      {w.name}
                    </span>
                    <span className="micro-label mt-1 text-ash">
                      {w.installed ? d.installStellar : d.installWallet}
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
                  disabled={!w.installed}
                  onClick={() => t.start(w.id as WalletId)}
                  className={cardCls}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress / status. */}
      {t.phase !== "idle" && (
        <div className="space-y-4" role="status">
          <div className="desk-stamp px-5 py-4">
            <p className="text-sm text-bone">{d.phase[t.phase]}</p>
            {busy(t.phase) && (
              <p className="micro-label mt-2 text-ash">{d.dontClose}</p>
            )}
            {t.status && (
              <p className="micro-label mt-2 text-ash">
                {d.statusPrefix} · {t.status.replaceAll("_", " ").toUpperCase()}
              </p>
            )}
            {/* pending_trust: anchor is holding the USDC because the buyer's
                wallet has no USDC trustline. Tell them how to unblock it. */}
            {t.status === "pending_trust" && (
              <p className="os-note mt-2 text-blood">{d.pendingTrust}</p>
            )}
          </div>

          {t.phase === "interactive" && t.interactiveUrl && (
            <a
              href={t.interactiveUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="terminal-control os-press inline-block px-4 py-2.5 text-sm text-bone"
            >
              {d.openDeposit}
            </a>
          )}

          {t.phase === "completed" && (
            <p className="os-note text-mist">
              {t.amountOut
                ? d.completedAmount(t.amountOut)
                : d.completedGeneric}{" "}
              {d.trustlineReminder}
            </p>
          )}

          {t.phase === "failed" && (
            <div className="space-y-3">
              {t.error && (
                <p className="os-note text-blood">{t.error.message}</p>
              )}
              <button
                type="button"
                onClick={t.reset}
                className="terminal-control os-press px-4 py-2.5 text-sm text-bone"
              >
                {d.retry}
              </button>
            </div>
          )}
        </div>
      )}

      {t.publicKey && (
        <p className="micro-label break-all text-ash">
          {d.walletPrefix} · {t.publicKey}
        </p>
      )}
    </div>
  );
}
