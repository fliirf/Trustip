"use client";

// Seller sign-in. Supabase Auth only — the password is handled by supabase-js;
// nothing custom touches credentials.
//
// PHASE 14 — OPERATIONS DESK grammar. The entrance to the desk is the desk: a
// clipped sheet on the left, the fields engraved into it on the right. No
// bordered panels, no decorative glyph, one primary key.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EscrowCore } from "../escrow/EscrowCore";
import { ErrorState } from "../ui/ErrorState";
import { useSellerSession } from "./useSellerSession";

/** The one field style on the desk. Previously four near-identical `inputCls`
 *  constants lived across the seller area; they are now this. */
const fieldCls =
  "desk-field w-full px-3 py-2.5 text-sm text-bone placeholder:text-ash";

export function SellerLogin() {
  const router = useRouter();
  const { signIn, signUp } = useSellerSession();
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);
    setError(null);
    const result =
      mode === "masuk"
        ? await signIn(email, password)
        : await signUp(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/seller/onboarding");
  };

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <main className="mx-auto grid min-h-[100dvh] max-w-5xl items-center gap-12 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:px-6 lg:gap-20">
        {/* The sheet on the board. */}
        <section className="desk-sheet hidden flex-col justify-between gap-12 self-stretch px-8 py-10 md:flex">
          <div className="micro-label text-ash">Trustip · Seller</div>
          <div>
            <EscrowCore state="dormant" context="seal" className="h-32 w-32" />
            <h1 className="os-title mt-10 max-w-[16ch] text-bone">
              Jualan dengan pembayaran yang dilindungi.
            </h1>
            <p className="os-body mt-4 max-w-[38ch] text-mist/80">
              Dana pembeli ditahan aman sampai pesanan diterima, lalu diteruskan
              ke wallet kamu.
            </p>
          </div>
          <div className="micro-label text-ash">USDC · Stellar · Protected</div>
        </section>

        {/* The fields, engraved. */}
        <section>
          <div className="micro-label text-ash md:hidden">Trustip · Seller</div>
          <h2 className="os-title mt-4 text-bone md:mt-0">
            {mode === "masuk" ? "Masuk Seller" : "Daftar Seller"}
          </h2>
          <p className="os-body mt-3 max-w-[42ch] text-mist/70">
            {mode === "masuk"
              ? "Masuk untuk mengelola toko dan link checkout kamu."
              : "Buat akun untuk mulai menerima pembayaran terlindungi."}
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <label className="block space-y-2">
              <span className="micro-label text-ash">Email</span>
              <input name="email" type="email" className={fieldCls} required />
            </label>
            <label className="block space-y-2">
              <span className="micro-label text-ash">Kata sandi</span>
              <input
                name="password"
                type="password"
                className={fieldCls}
                minLength={6}
                required
              />
            </label>

            {/* Auth failures come from Supabase already worded; the desk renders
                them exactly the way it renders a rejected work order. */}
            {error && <ErrorState surface="seller" detail={error} />}

            <button
              type="submit"
              disabled={busy}
              className="mat-illuminated os-press w-full px-4 py-3.5 text-sm font-semibold tracking-tight text-void hover:text-bone"
            >
              {busy
                ? mode === "masuk"
                  ? "Memeriksa akun kamu…"
                  : "Membuat akun kamu…"
                : mode === "masuk"
                  ? "Masuk"
                  : "Daftar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "masuk" ? "daftar" : "masuk");
                setError(null);
              }}
              className="os-press micro-label text-ash hover:text-bone"
            >
              {mode === "masuk"
                ? "Belum punya akun? Daftar"
                : "Sudah punya akun? Masuk"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
