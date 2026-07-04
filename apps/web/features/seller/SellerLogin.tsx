"use client";

// Seller sign-in: editorial split layout, VOID identity. Supabase Auth only —
// the password is handled by supabase-js; nothing custom touches credentials.

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EscrowMark } from "./SellerShell";
import { useSellerSession } from "./useSellerSession";

const inputCls =
  "w-full border border-hairline bg-surface px-3 py-2.5 text-sm text-bone placeholder:text-ash transition-colors duration-300 focus:border-blood/70 focus:outline-none";

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
    <main className="mx-auto grid min-h-[100dvh] max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:px-6">
      {/* Editorial panel */}
      <section className="hidden flex-col justify-between gap-10 self-stretch border border-hairline bg-surface p-8 md:flex">
        <div className="micro-label flex items-center gap-2 text-ash">
          <span aria-hidden className="text-blood">
            ◈
          </span>
          Trustip · Seller
        </div>
        <div>
          <EscrowMark />
          <h1 className="mt-6 max-w-[16ch] text-3xl font-semibold leading-tight tracking-tight text-bone">
            Jualan dengan pembayaran yang dilindungi.
          </h1>
          <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-mist/80">
            Dana pembeli ditahan aman sampai pesanan diterima, lalu diteruskan
            ke wallet kamu.
          </p>
        </div>
        <div className="micro-label text-ash">USDC · Stellar · Protected</div>
      </section>

      {/* Form */}
      <section>
        <div className="micro-label flex items-center gap-2 text-ash md:hidden">
          <span aria-hidden className="text-blood">
            ◈
          </span>
          Trustip · Seller
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-bone md:mt-0">
          {mode === "masuk" ? "Masuk Seller" : "Daftar Seller"}
        </h2>
        <p className="mt-2 text-sm text-mist/70">
          {mode === "masuk"
            ? "Masuk untuk mengelola toko dan link checkout kamu."
            : "Buat akun untuk mulai menerima pembayaran terlindungi."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block space-y-2">
            <span className="micro-label text-ash">Email</span>
            <input name="email" type="email" className={inputCls} required />
          </label>
          <label className="block space-y-2">
            <span className="micro-label text-ash">Kata sandi</span>
            <input
              name="password"
              type="password"
              className={inputCls}
              minLength={6}
              required
            />
          </label>

          {error && (
            <p className="border border-blood/30 px-3 py-2 text-sm text-blood">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-bone px-4 py-3 text-sm font-semibold tracking-tight text-void transition-colors duration-300 hover:bg-blood active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? "Memproses…" : mode === "masuk" ? "Masuk" : "Daftar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "masuk" ? "daftar" : "masuk");
              setError(null);
            }}
            className="micro-label text-ash transition-colors duration-300 hover:text-bone"
          >
            {mode === "masuk"
              ? "Belum punya akun? Daftar"
              : "Sudah punya akun? Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
