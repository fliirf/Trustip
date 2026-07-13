"use client";

// Seller onboarding island: profile → wallet → ownership proof → primary.
// Every status shown comes from the backend (GET /api/seller/profile is
// re-fetched after each mutation). The client never sets verified_at or
// primary itself — it only requests, signs, and submits.
//
// PHASE 14 — OPERATIONS DESK grammar. Four numbered stations on the board:
// engraved fields, milled keys, wallets as ruled manifest rows with a stamped
// verdict. No bordered panels, no section rules with a trailing hairline, no
// check glyphs — the word is the verdict.

import {
  currentNetwork,
  getAvailableWallets,
  getWalletAdapter,
  networkName,
  signTransactionWithWallet,
  WalletError,
  type WalletAvailability,
  type WalletId,
} from "@trustip/stellar";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Dict } from "../../lib/i18n/dictionaries";
import { useDict } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import {
  getOnboarding,
  registerWallet,
  requestWalletChallenge,
  saveProfile,
  SellerApiError,
  setPrimaryWallet,
  verifyWallet,
  type SellerOnboardingStatus,
} from "./seller-api";
import { sellerErrorLabel, stepLabel, STEP_KEYS } from "./labels";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

const fieldCls =
  "desk-field w-full px-3 py-2.5 text-sm text-bone placeholder:text-ash";

const stampCls =
  "desk-stamp os-press micro-label px-4 py-2 text-bone hover:text-blood";

const keyCls =
  "mat-illuminated os-press px-5 py-2.5 text-sm font-semibold tracking-tight text-void hover:text-bone";

function describeError(d: Dict, e: unknown): string {
  if (e instanceof SellerApiError) return sellerErrorLabel(d, e.code, e.message);
  if (e instanceof WalletError) return sellerErrorLabel(d, e.code, e.message);
  return sellerErrorLabel(d, "InternalError", "");
}

/** A numbered station on the board. The label alone marks it; the old trailing
 *  hairline rule was the buyer status page's grammar, borrowed. */
function Station({
  n,
  label,
  children,
}: {
  n: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="micro-label text-ash tabular-nums">
        {n} · {label}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function shortKey(k: string): string {
  return `${k.slice(0, 8)}…${k.slice(-6)}`;
}

export function SellerOnboarding() {
  const d = useDict();
  const t = d.seller.onboarding;
  const session = useSellerSession();
  const token = session.accessToken;

  const [status, setStatus] = useState<SellerOnboardingStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Local wallet connection (pre-registration) state.
  const [wallets, setWallets] = useState<WalletAvailability[]>([]);
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setStatus(await getOnboarding(token));
      setLoadError(null);
    } catch (e) {
      setLoadError(describeError(d, e));
    }
  }, [token, d]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    getAvailableWallets().then(setWallets, () => setWallets([]));
  }, []);

  const run = useCallback(
    async (name: string, fn: () => Promise<void>) => {
      setBusy(name);
      setActionError(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setActionError(describeError(d, e));
      } finally {
        setBusy(null);
      }
    },
    [refresh, d],
  );

  const connect = (id: WalletId) =>
    run("connect", async () => {
      const adapter = getWalletAdapter(id);
      const pk = await adapter.connect();
      let mismatch = false;
      try {
        const net = await adapter.getNetwork();
        mismatch = net.networkPassphrase !== currentNetwork.networkPassphrase;
      } catch {
        // wallet cannot report its network — backend still fails closed
      }
      setWalletId(id);
      setPublicKey(pk);
      setWrongNetwork(mismatch);
    });

  if (session.loading) {
    return (
      <SellerShell active="onboarding">
        <div className="max-w-md">
          <ProtocolState surface="seller" label={d.seller.checkingSession} />
        </div>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="onboarding">
        <EmptyState
          surface="seller"
          title={d.seller.needLogin.title}
          detail={t.needLoginDetail}
          action={{ label: d.seller.needLogin.cta, href: "/seller/login" }}
        />
      </SellerShell>
    );
  }

  const profile = status?.profile ?? null;
  const registered = status?.wallets ?? [];
  const networkWallets = registered.filter((w) => w.network === networkName());
  const connectedRegistered = publicKey
    ? networkWallets.find((w) => w.publicKey === publicKey)
    : undefined;
  const verifiedWallets = networkWallets.filter((w) => w.verifiedAt !== null);
  const primaryWallet = networkWallets.find(
    (w) => w.isPrimary && w.verifiedAt !== null,
  );

  const done = {
    profile: profile !== null,
    connect: publicKey !== null || networkWallets.length > 0,
    register: networkWallets.length > 0,
    verify: verifiedWallets.length > 0,
    primary: primaryWallet !== undefined,
  };

  return (
    <SellerShell
      active="onboarding"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="os-title text-bone">{t.heading}</h1>
          <p className="os-body mt-3 max-w-[52ch] text-mist/80">{t.subtitle}</p>
        </div>
        <div className="micro-label text-ash tabular-nums">
          {Object.values(done).filter(Boolean).length} / {STEP_KEYS.length} {t.stepsSuffix}
        </div>
      </div>

      {/* Progress rail — horizontal, the desk's axis. Same marks the order
          sheet's lifecycle uses. */}
      <ol className="mt-10 -mx-1 flex min-w-max items-start gap-0 overflow-x-auto px-1 pb-1 md:min-w-0">
        {STEP_KEYS.map((key, i) => {
          const isDone = done[key];
          const last = i === STEP_KEYS.length - 1;
          return (
            <li key={key} className="flex min-w-[88px] flex-1 flex-col gap-2.5">
              <div className="flex items-center">
                <span
                  aria-hidden
                  className={`size-[7px] shrink-0 rotate-45 ${isDone ? "bg-blood" : "bg-bone/20"}`}
                />
                {!last && (
                  <span
                    aria-hidden
                    className={`h-px flex-1 ${isDone ? "bg-blood/60" : "bg-hairline"}`}
                  />
                )}
              </div>
              <span
                className={`pr-3 text-[12px] leading-tight ${isDone ? "text-mist" : "text-bone/25"}`}
              >
                {stepLabel(d, key)}
              </span>
            </li>
          );
        })}
      </ol>

      {loadError && (
        <div className="mt-8 max-w-3xl">
          <ErrorState surface="seller" detail={loadError} />
        </div>
      )}

      {status?.checkoutReady && (
        <div className="desk-row mt-10 flex flex-wrap items-center justify-between gap-4 py-4">
          <span className="os-body text-bone">{t.readyBanner}</span>
          <Link href="/seller" className={stampCls}>
            {t.goToDashboard}
          </Link>
        </div>
      )}

      <div className="space-y-16 pt-14 pb-16">
        <Station n="01" label={t.station1}>
          <form
            className="max-w-md space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const storeName = String(f.get("storeName") ?? "").trim();
              const category = String(f.get("category") ?? "").trim();
              const socialUrl = String(f.get("socialUrl") ?? "").trim();
              void run("profile", async () => {
                if (!token) return;
                await saveProfile(token, {
                  storeName,
                  ...(category ? { category } : {}),
                  ...(socialUrl ? { socialUrl } : {}),
                });
              });
            }}
          >
            <label className="block space-y-2">
              <span className="micro-label text-ash">{t.storeNameLabel}</span>
              <input
                name="storeName"
                defaultValue={profile?.storeName ?? ""}
                className={fieldCls}
                required
                minLength={1}
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="micro-label text-ash">{t.categoryLabel}</span>
                <input
                  name="category"
                  defaultValue={profile?.category ?? ""}
                  className={fieldCls}
                />
              </label>
              <label className="block space-y-2">
                <span className="micro-label text-ash">{t.socialUrlLabel}</span>
                <input
                  name="socialUrl"
                  type="url"
                  placeholder="https://…"
                  defaultValue={profile?.socialUrl ?? ""}
                  className={fieldCls}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={busy !== null} className={keyCls}>
                {busy === "profile"
                  ? t.savingProfile
                  : profile
                    ? t.updateProfile
                    : t.saveProfile}
              </button>
              {profile && (
                <span className="micro-label text-mist">
                  {t.savedPrefix}
                  {profile.storeName}
                </span>
              )}
            </div>
          </form>
        </Station>

        <Station n="02" label={t.station2}>
          <p className="os-body max-w-[52ch] text-mist/70">{t.walletIntro}</p>
          <div className="mt-6 grid max-w-md grid-cols-2 gap-4">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={!w.installed || busy !== null}
                onClick={() => void connect(w.id)}
                className={`mat-key os-press flex items-center gap-3 border px-4 py-3.5 text-left ${
                  walletId === w.id ? "border-blood/60" : "border-hairline"
                }`}
              >
                {/* Status lamp, lit only where a wallet actually is. Same lamp
                    the checkout terminal and the release dialog use. */}
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
                      ? walletId === w.id
                        ? t.walletConnected
                        : t.walletBrand
                      : t.walletNotInstalled}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {publicKey && (
            <div className="desk-sheet mt-6 max-w-md px-4 py-4">
              <div className="micro-label text-ash">{t.connectedWalletLabel}</div>
              <div className="mt-2 break-all font-mono text-xs text-mist">{publicKey}</div>
              {wrongNetwork && (
                <p className="os-body mt-3 text-blood">{t.wrongNetwork}</p>
              )}
              {!connectedRegistered && !wrongNetwork && (
                <button
                  type="button"
                  disabled={busy !== null || !walletId}
                  onClick={() =>
                    void run("register", async () => {
                      if (!token || !walletId || !publicKey) return;
                      await registerWallet(token, {
                        walletProvider: walletId,
                        publicKey,
                        network: networkName(),
                      });
                    })
                  }
                  className={`mt-4 ${stampCls}`}
                >
                  {busy === "register" ? t.registeringWallet : t.registerWallet}
                </button>
              )}
              {connectedRegistered && (
                <p className="micro-label mt-4 text-mist">{t.registered}</p>
              )}
            </div>
          )}
        </Station>

        <Station n="03" label={t.station3}>
          <p className="os-body max-w-[52ch] text-mist/70">{t.verifyIntro}</p>
          {networkWallets.length === 0 ? (
            <p className="micro-label mt-6 text-ash">{t.registerWalletFirst}</p>
          ) : (
            <ul className="mt-6 max-w-xl">
              {networkWallets.map((w) => (
                <li
                  key={w.id}
                  className="desk-row flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <span className="font-mono text-xs text-mist">{shortKey(w.publicKey)}</span>
                  {w.verifiedAt ? (
                    <span className="micro-label text-mist">{t.verified}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null || !walletId}
                      onClick={() =>
                        void run("verify", async () => {
                          if (!token || !walletId) return;
                          const challenge = await requestWalletChallenge(token, {
                            publicKey: w.publicKey,
                            network: w.network,
                          });
                          const adapter = getWalletAdapter(walletId);
                          const signedXdr = await signTransactionWithWallet(
                            adapter,
                            challenge.challengeXdr,
                            {
                              networkPassphrase: challenge.networkPassphrase,
                              address: w.publicKey,
                            },
                          );
                          await verifyWallet(token, {
                            publicKey: w.publicKey,
                            network: w.network,
                            signedXdr,
                            challengeToken: challenge.challengeToken,
                          });
                        })
                      }
                      className={stampCls}
                    >
                      {busy === "verify" ? t.verifying : t.verifyNow}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Station>

        <Station n="04" label={t.station4}>
          <p className="os-body max-w-[52ch] text-mist/70">{t.primaryIntro}</p>
          {verifiedWallets.length === 0 ? (
            <p className="micro-label mt-6 text-ash">{t.verifyWalletFirst}</p>
          ) : (
            <ul className="mt-6 max-w-xl">
              {verifiedWallets.map((w) => (
                <li
                  key={w.id}
                  className="desk-row flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <span className="font-mono text-xs text-mist">{shortKey(w.publicKey)}</span>
                  {w.isPrimary ? (
                    <span className="desk-stamp micro-label px-3 py-1.5 text-blood">
                      {t.primaryStamp}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run("primary", async () => {
                          if (!token) return;
                          await setPrimaryWallet(token, { walletId: w.id });
                        })
                      }
                      className={stampCls}
                    >
                      {busy === "primary" ? t.savingPrimary : t.makePrimary}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Station>

        {actionError && (
          <div className="max-w-3xl">
            <ErrorState surface="seller" detail={actionError} />
          </div>
        )}
      </div>
    </SellerShell>
  );
}
