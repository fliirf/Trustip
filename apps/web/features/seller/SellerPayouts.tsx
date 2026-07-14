"use client";

// Seller payout methods (phase 10 — payout foundation). CONFIG ONLY: this page
// moves no money. USDC/XLM routes must reference a wallet the seller has already
// verified in onboarding (picked from the list); MoneyGram is a guided route
// (needs_review) with country/currency only. Payout EXECUTION (release routing,
// XLM conversion, MoneyGram cash-out) is a later layer, not here.

import { useCallback, useEffect, useState } from "react";
import type { Dict } from "../../lib/i18n/dictionaries";
import { useDict } from "../i18n/LocaleProvider";
import { EmptyState, ErrorState, ProtocolState } from "../ui/ErrorState";
import { sellerErrorLabel } from "./labels";
import {
  addPayoutMethod,
  type AddPayoutMethodBody,
  disablePayoutMethod,
  getOnboarding,
  listPayoutMethods,
  type PayoutMethod,
  type PayoutMethodType,
  SellerApiError,
  setDefaultPayoutMethod,
  type SellerWallet,
} from "./seller-api";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

function describeError(d: Dict, e: unknown): { code: string; message: string } {
  if (e instanceof SellerApiError) {
    return { code: e.code, message: sellerErrorLabel(d, e.code, e.message) };
  }
  return { code: "InternalError", message: sellerErrorLabel(d, "InternalError", "") };
}

const METHOD_TYPES: PayoutMethodType[] = [
  "usdc_wallet",
  "xlm_wallet",
  "moneygram_cashout",
];

export function SellerPayouts() {
  const d = useDict();
  const t = d.seller.payouts;
  const session = useSellerSession();
  const token = session.accessToken;

  const [methods, setMethods] = useState<PayoutMethod[] | null>(null);
  const [wallets, setWallets] = useState<SellerWallet[]>([]);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Add-form state.
  const [methodType, setMethodType] = useState<PayoutMethodType>("usdc_wallet");
  const [displayName, setDisplayName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const verifiedWallets = wallets.filter((w) => w.verifiedAt !== null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [m, onboarding] = await Promise.all([
        listPayoutMethods(token),
        getOnboarding(token),
      ]);
      setMethods(m.methods);
      setWallets(onboarding.wallets);
      setError(null);
    } catch (e) {
      setError(describeError(d, e));
    }
  }, [token, d]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add() {
    if (!token) return;
    setBusy(true);
    setFormError(null);
    try {
      let body: AddPayoutMethodBody;
      if (methodType === "moneygram_cashout") {
        body = {
          methodType,
          displayName,
          cashoutCountry: country,
          cashoutCurrency: currency,
          isDefault,
        };
      } else {
        if (!walletId) {
          setFormError(t.pickWalletError);
          setBusy(false);
          return;
        }
        body = { methodType, displayName, walletId, isDefault };
      }
      await addPayoutMethod(token, body);
      setDisplayName("");
      setWalletId("");
      setCountry("");
      setCurrency("");
      setIsDefault(false);
      await refresh();
    } catch (e) {
      setFormError(describeError(d, e).message);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await setDefaultPayoutMethod(token, id);
      await refresh();
    } catch (e) {
      setError(describeError(d, e));
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    if (!token) return;
    setBusy(true);
    try {
      await disablePayoutMethod(token, id);
      await refresh();
    } catch (e) {
      setError(describeError(d, e));
    } finally {
      setBusy(false);
    }
  }

  if (session.loading) {
    return (
      <SellerShell active="payouts">
        <div className="max-w-md">
          <ProtocolState surface="seller" label={d.seller.checkingSession} />
        </div>
      </SellerShell>
    );
  }
  if (!session.session) {
    return (
      <SellerShell active="payouts">
        <EmptyState
          surface="seller"
          title={d.seller.needLogin.title}
          detail={t.needLoginDetail}
          action={{ label: d.seller.needLogin.cta, href: "/seller/login" }}
        />
      </SellerShell>
    );
  }

  const needsWallet = methodType !== "moneygram_cashout";

  return (
    <SellerShell
      active="payouts"
      onSignOut={() => void session.signOut()}
      email={session.email}
    >
      <div className="engraved-b flex flex-wrap items-end justify-between gap-4 pb-5">
        <div>
          <h1 className="os-title text-bone">{t.heading}</h1>
          <p className="mt-3 max-w-[56ch] os-body text-mist/80">{t.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="mt-6 max-w-3xl">
          <ErrorState
            surface="seller"
            detail={error.message}
            action={{ label: t.reload, onClick: () => void refresh() }}
          />
        </div>
      )}

      {/* 01 · ADD */}
      <section className="pt-10">
        <div className="micro-label text-ash">{t.addTitle}</div>
        <p className="os-body mt-2 max-w-[56ch] text-mist/70">{t.addNote}</p>

        <div className="mt-6 grid max-w-xl gap-4">
          <label className="micro-label block text-ash">
            {t.methodTypeLabel}
            <select
              value={methodType}
              onChange={(e) => setMethodType(e.target.value as PayoutMethodType)}
              disabled={busy}
              className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
            >
              {METHOD_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t.types[mt]}
                </option>
              ))}
            </select>
          </label>

          <label className="micro-label block text-ash">
            {t.displayNameLabel}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder={t.displayNamePlaceholder}
              className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist placeholder:text-bone/25"
            />
          </label>

          {needsWallet ? (
            <label className="micro-label block text-ash">
              {t.walletLabel}
              {verifiedWallets.length === 0 ? (
                <p className="os-body mt-2 text-mist/70">
                  {t.noVerifiedWallet}{" "}
                  <a href="/seller/onboarding" className="underline underline-offset-4 hover:text-bone">
                    {t.goVerify}
                  </a>
                </p>
              ) : (
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  disabled={busy}
                  className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
                >
                  <option value="">{t.pickWallet}</option>
                  {verifiedWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.publicKey.slice(0, 6)}…{w.publicKey.slice(-6)} ·{" "}
                      {w.network}
                      {w.isPrimary ? ` · ${t.primary}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <label className="micro-label block text-ash">
                {t.countryLabel}
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                  disabled={busy}
                  placeholder="ID"
                  className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist placeholder:text-bone/25"
                />
              </label>
              <label className="micro-label block text-ash">
                {t.currencyLabel}
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  disabled={busy}
                  placeholder="IDR"
                  className="os-body mt-2 w-full border border-hairline bg-void px-3 py-2.5 text-mist placeholder:text-bone/25"
                />
              </label>
            </div>
          )}

          <label className="micro-label flex items-center gap-3 text-ash">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={busy}
            />
            {t.setDefault}
          </label>

          {methodType === "moneygram_cashout" && (
            <p className="micro-label text-ash">{t.moneygramGuidedNote}</p>
          )}
          {formError && <p className="os-body text-blood">{formError}</p>}

          <button
            type="button"
            onClick={add}
            disabled={busy || !displayName.trim()}
            className="mat-illuminated os-press w-fit px-6 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? t.adding : t.add}
          </button>
        </div>
      </section>

      {/* 02 · LIST */}
      <section className="pt-14 pb-16">
        <div className="micro-label text-ash">{t.listTitle}</div>
        {methods === null && !error && (
          <div className="mt-4 max-w-md">
            <ProtocolState surface="seller" label={t.loading} />
          </div>
        )}
        {methods !== null && methods.length === 0 && (
          <p className="mt-4 os-body text-mist/60">{t.empty}</p>
        )}
        {methods !== null && methods.length > 0 && (
          <ul className="mt-4 space-y-4">
            {methods.map((m) => (
              <li
                key={m.id}
                className="max-w-2xl border border-hairline px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-bone">
                    {m.displayName}
                    {m.isDefault && (
                      <span className="desk-stamp micro-label ml-3 px-2 py-0.5 text-bone">
                        {t.defaultBadge}
                      </span>
                    )}
                  </span>
                  <span className="micro-label text-ash">
                    {t.types[m.methodType]} · {t.statuses[m.status] ?? m.status}
                  </span>
                </div>
                <p className="os-serial mt-2 font-mono text-xs text-mist/70">
                  {m.methodType === "moneygram_cashout"
                    ? `${m.cashoutCountry ?? "—"} · ${m.cashoutCurrency ?? "—"}`
                    : `${m.stellarAddress?.slice(0, 8)}…${m.stellarAddress?.slice(-8)} · ${m.assetCode}`}
                </p>
                {m.status !== "disabled" && (
                  <div className="mt-4 flex gap-5">
                    {!m.isDefault && (
                      <button
                        type="button"
                        onClick={() => void makeDefault(m.id)}
                        disabled={busy}
                        className="micro-label os-press text-bone underline underline-offset-4 hover:text-blood disabled:opacity-50"
                      >
                        {t.makeDefault}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void disable(m.id)}
                      disabled={busy}
                      className="micro-label os-press text-ash underline underline-offset-4 hover:text-mist disabled:opacity-50"
                    >
                      {t.disable}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SellerShell>
  );
}
