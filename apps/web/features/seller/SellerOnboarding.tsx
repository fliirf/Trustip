"use client";

// Seller onboarding island: profile → wallet → ownership proof → primary.
// Every status shown comes from the backend (GET /api/seller/profile is
// re-fetched after each mutation). The client never sets verified_at or
// primary itself — it only requests, signs, and submits.

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
import { sellerErrorLabel, STEP_LABELS } from "./labels";
import { SellerShell } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

const inputCls =
  "w-full border border-hairline bg-surface px-3 py-2.5 text-sm text-bone placeholder:text-ash transition-colors duration-300 focus:border-blood/70 focus:outline-none";

const ctaCls =
  "bg-bone px-5 py-2.5 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40";

const ghostCls =
  "micro-label border border-hairline px-4 py-2 text-bone transition-colors duration-300 hover:border-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40";

function describeError(e: unknown): string {
  if (e instanceof SellerApiError) return sellerErrorLabel(e.code, e.message);
  if (e instanceof WalletError) return sellerErrorLabel(e.code, e.message);
  return sellerErrorLabel("InternalError", "");
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="micro-label text-mist">{label}</span>
      <span className="h-px flex-1 bg-hairline" aria-hidden />
    </div>
  );
}

export function SellerOnboarding() {
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
      setLoadError(describeError(e));
    }
  }, [token]);

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
        setActionError(describeError(e));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
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
        <p className="micro-label text-ash">Memuat sesi…</p>
      </SellerShell>
    );
  }

  if (!session.session) {
    return (
      <SellerShell active="onboarding">
        <div className="max-w-md border border-hairline bg-surface p-6">
          <div className="micro-label text-ash">Perlu Masuk</div>
          <p className="mt-3 text-sm text-mist/80">
            Masuk dulu untuk menyiapkan toko dan wallet kamu.
          </p>
          <Link href="/seller/login" className={`mt-5 inline-block ${ctaCls}`}>
            Masuk Seller
          </Link>
        </div>
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
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-blood">
          ◈
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-bone">
          Persiapan Toko
        </h1>
      </div>
      <p className="mb-8 max-w-[52ch] text-sm leading-relaxed text-mist/80">
        Selesaikan langkah berikut supaya link checkout kamu bisa menerima
        pembayaran yang dilindungi.
      </p>

      {/* Status rail */}
      <ol className="mb-10 flex items-start gap-2">
        {STEP_LABELS.map((step) => {
          const isDone = done[step.key];
          return (
            <li key={step.key} className="flex flex-1 flex-col gap-2">
              <span
                className={`h-px w-full transition-colors duration-500 ${
                  isDone ? "bg-blood" : "bg-hairline"
                }`}
              />
              <span
                className={`micro-label leading-tight ${
                  isDone ? "text-mist" : "text-bone/25"
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {loadError && (
        <p className="mb-6 border border-blood/30 px-3 py-2 text-sm text-blood">
          {loadError}
        </p>
      )}

      {status?.checkoutReady && (
        <div className="mb-10 border border-bone/30 bg-surface px-4 py-3.5 text-sm text-bone">
          <span aria-hidden className="mr-2 text-blood">
            ◈
          </span>
          Toko kamu siap menerima pembayaran terlindungi.
          <Link
            href="/seller"
            className="micro-label ml-3 text-mist underline-offset-4 hover:underline"
          >
            Ke Ringkasan
          </Link>
        </div>
      )}

      <div className="space-y-12 pb-16">
        {/* 01 · PROFIL TOKO */}
        <section className="space-y-5">
          <SectionRule label="01 · Profil Toko" />
          <form
            className="max-w-md space-y-4"
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
              <span className="micro-label text-ash">Nama toko</span>
              <input
                name="storeName"
                defaultValue={profile?.storeName ?? ""}
                className={inputCls}
                required
                minLength={1}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="micro-label text-ash">
                  Kategori (opsional)
                </span>
                <input
                  name="category"
                  defaultValue={profile?.category ?? ""}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-2">
                <span className="micro-label text-ash">
                  Link sosial (opsional)
                </span>
                <input
                  name="socialUrl"
                  type="url"
                  placeholder="https://…"
                  defaultValue={profile?.socialUrl ?? ""}
                  className={inputCls}
                />
              </label>
            </div>
            <button type="submit" disabled={busy !== null} className={ctaCls}>
              {busy === "profile"
                ? "Menyimpan…"
                : profile
                  ? "Perbarui Profil"
                  : "Simpan Profil"}
            </button>
            {profile && (
              <span className="micro-label ml-3 text-mist">
                Tersimpan ✓ {profile.storeName}
              </span>
            )}
          </form>
        </section>

        {/* 02 · WALLET SELLER */}
        <section className="space-y-5">
          <SectionRule label="02 · Wallet Seller" />
          <p className="max-w-[52ch] text-sm text-mist/70">
            Hubungkan wallet Stellar yang akan menerima pembayaran kamu, lalu
            daftarkan ke Trustip.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-4">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                disabled={!w.installed || busy !== null}
                onClick={() => void connect(w.id)}
                className={`group flex items-center gap-3 border bg-surface px-4 py-3.5 text-left transition-colors duration-300 hover:border-blood disabled:pointer-events-none disabled:opacity-35 ${
                  walletId === w.id ? "border-blood/60" : "border-hairline"
                }`}
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
                    {w.installed
                      ? walletId === w.id
                        ? "Terhubung"
                        : "Stellar"
                      : "Belum terpasang"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {publicKey && (
            <div className="max-w-md border border-hairline bg-surface px-4 py-3">
              <div className="micro-label text-ash">Wallet terhubung</div>
              <div className="mt-2 break-all font-mono text-xs text-mist">
                {publicKey}
              </div>
              {wrongNetwork && (
                <p className="mt-2 text-sm text-blood">
                  Jaringan wallet tidak sesuai. Pindahkan wallet ke jaringan
                  Stellar yang benar.
                </p>
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
                  className={`mt-3 ${ghostCls}`}
                >
                  {busy === "register" ? "Mendaftarkan…" : "Daftarkan Wallet"}
                </button>
              )}
              {connectedRegistered && (
                <p className="micro-label mt-3 text-mist">Terdaftar ✓</p>
              )}
            </div>
          )}
        </section>

        {/* 03 · VERIFIKASI KEPEMILIKAN */}
        <section className="space-y-5">
          <SectionRule label="03 · Verifikasi Kepemilikan" />
          <p className="max-w-[52ch] text-sm text-mist/70">
            Tanda tangani satu permintaan verifikasi di wallet kamu. Ini bukan
            transaksi dan tidak memindahkan dana — hanya bukti bahwa wallet ini
            milik kamu. Wallet mungkin menampilkan peringatan karena permintaan
            berasal dari akun verifikasi Trustip; itu normal.
          </p>
          {networkWallets.length === 0 && (
            <p className="micro-label text-ash">
              Daftarkan wallet dulu di langkah 02.
            </p>
          )}
          <ul className="max-w-xl space-y-3">
            {networkWallets.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-hairline bg-surface px-4 py-3"
              >
                <span className="break-all font-mono text-xs text-mist">
                  {w.publicKey.slice(0, 8)}…{w.publicKey.slice(-6)}
                </span>
                {w.verifiedAt ? (
                  <span className="micro-label text-mist">Terverifikasi ✓</span>
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
                    className={ghostCls}
                  >
                    {busy === "verify"
                      ? "Menunggu tanda tangan…"
                      : "Verifikasi Sekarang"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* 04 · PRIMARY WALLET */}
        <section className="space-y-5">
          <SectionRule label="04 · Primary Wallet" />
          <p className="max-w-[52ch] text-sm text-mist/70">
            Pilih satu wallet utama sebagai tujuan pembayaran untuk link
            checkout kamu.
          </p>
          {verifiedWallets.length === 0 && (
            <p className="micro-label text-ash">
              Verifikasi wallet dulu di langkah 03.
            </p>
          )}
          <ul className="max-w-xl space-y-3">
            {verifiedWallets.map((w) => (
              <li
                key={w.id}
                className={`flex flex-wrap items-center justify-between gap-3 border bg-surface px-4 py-3 ${
                  w.isPrimary ? "border-blood/50" : "border-hairline"
                }`}
              >
                <span className="break-all font-mono text-xs text-mist">
                  {w.publicKey.slice(0, 8)}…{w.publicKey.slice(-6)}
                </span>
                {w.isPrimary ? (
                  <span className="micro-label text-blood">Wallet Utama</span>
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
                    className={ghostCls}
                  >
                    {busy === "primary" ? "Menyimpan…" : "Jadikan Utama"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {actionError && (
          <p className="max-w-xl border border-blood/30 px-3 py-2 text-sm text-blood">
            {actionError}
          </p>
        )}
      </div>
    </SellerShell>
  );
}
