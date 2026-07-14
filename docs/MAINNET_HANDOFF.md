# Trustip v1.1 — Mainnet Handoff (2026-07-14)

Langkah deploy mainnet yang **kamu jalankan sendiri**. Kode sudah mainnet-ready;
tidak ada langkah di sini yang butuh perubahan kode.

## 0. Scope yang disepakati

- **Seller payout = escrow release langsung ke wallet USDC seller** (sudah live).
- **XLM_WALLET route = LIVE (diterima 2026-07-15).** Seller bisa konversi payout
  USDC→XLM lewat DEX Stellar; konversi **ditandatangani seller sendiri** (operator
  tidak menyentuh dana), muncul di `/seller/payouts` untuk payout langsung yang
  sudah selesai. Tidak ada flag — fitur ini aktif di production. Gate: unit +
  build; **belum di-live-sign di testnet** — jalankan 1 konversi nyata di testnet
  sebelum go-live (lihat §7).
- **MONEYGRAM_CASHOUT route = guided/future** (butuh partner agreement + SEP-24
  anchor). Belum dieksekusi; tidak ada flag runtime (lihat `MAINNET_FEATURE_GAPS.md`).
- ⚠️ **JANGAN** set variabel `NEXT_PUBLIC_ENABLE_*` apa pun — validator
  production menolaknya sebagai legacy (lihat §3).
- Top-up buyer = SEP-24 anchor flow di `/topup` (client-side). Butuh anchor
  mainnet asli di `NEXT_PUBLIC_ANCHOR_DOMAIN` — production **menolak** domain
  yang mengandung "test".
- Refund: buyer mengajukan dari halaman status pesanan; kamu resolve di `/admin`
  (akun Supabase dengan `users.role = 'admin'`). Approve = refund on-chain ke
  wallet pembayar, otomatis.

## 1. Prasyarat (di luar repo)

1. **Supabase production project** (terpisah dari staging/lokal).
2. **Vercel production project** (env terpisah per network).
3. **Akun operator mainnet**: generate di luar repo, danai XLM secukupnya
   (fee + reserve). Operator = admin kontrak (menandatangani create/release/
   refund/pause).
4. **Pilih RPC provider mainnet** (mis. stellar.publicnode.org, Blockdaemon,
   dsb) untuk `STELLAR_RPC_URL` / `NEXT_PUBLIC_STELLAR_RPC_URL`.
5. **Identity deploy Stellar CLI** yang didanai: `stellar keys generate ...`
   lalu danai manual (tidak ada friendbot di mainnet).

## 2. Database production

```bash
supabase link --project-ref <prod-project-ref>
supabase db push          # apply seluruh migrations (termasuk confirm_refunded_payment)
```

Buat akun admin: daftar lewat UI seller-login (atau Supabase dashboard), lalu:

```sql
update users set role = 'admin' where email = '<email-admin-kamu>';
```

## 3. Environment variables (production secret store)

Daftar ini **otoritatif** — persis yang divalidasi `packages/config/src/validate.ts`
(gate `pnpm verify:env:production`). Set SEMUA yang di bawah, JANGAN set yang ada
di daftar "ditolak". Ada nilai placeholder (diawali `<`) → verify gagal.

Frontend (Vercel, `NEXT_PUBLIC_*` — semua WAJIB):

```txt
NEXT_PUBLIC_APP_URL=https://<domain-kamu>
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=<rpc mainnet pilihanmu>
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=<hasil deploy langkah 4>
NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC SAC mainnet>
NEXT_PUBLIC_ANCHOR_DOMAIN=<anchor mainnet, TANPA kata "test">
NEXT_PUBLIC_SUPABASE_URL=<prod supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
```

Backend/server-only (Vercel + workers — semua WAJIB):

```txt
NODE_ENV=production
STELLAR_NETWORK=mainnet
SUPABASE_SERVICE_ROLE_KEY=<prod service role — JANGAN pernah ke frontend>
TRUSTIP_SIGNER_STRATEGY=env
TRUSTIP_OPERATOR_SECRET_KEY=<seed operator mainnet>
TRUSTIP_ALLOW_MAINNET_OPERATOR=true
PAYMENT_ATTEMPT_SECRET=<random ≥32 char>
TRUSTIP_CHECKOUT_TOKEN_SECRET=<random ≥32 char>
TRUSTIP_WALLET_CHALLENGE_SECRET=<random ≥32 char>
TRUSTIP_SEP10_JWT_SECRET=<random ≥32 char>
UPSTASH_REDIS_REST_URL=<https upstash rest url>
UPSTASH_REDIS_REST_TOKEN=<upstash rest token>
```

Generate 4 secret HMAC (jalankan lokal, jangan pakai nilai contoh siapa pun):

```bash
for k in PAYMENT_ATTEMPT_SECRET TRUSTIP_CHECKOUT_TOKEN_SECRET \
         TRUSTIP_WALLET_CHALLENGE_SECRET TRUSTIP_SEP10_JWT_SECRET; do
  echo "$k=$(openssl rand -base64 32)"
done
```

### JANGAN di-set (validator production menolaknya sebagai legacy)

`NEXT_PUBLIC_APP_ENV` (pakai `NODE_ENV`), `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`
(diturunkan dari network), `NEXT_PUBLIC_USDC_ASSET_CODE` (selalu USDC),
`NEXT_PUBLIC_ENABLE_FREIGHTER`, `NEXT_PUBLIC_ENABLE_XBULL`,
`NEXT_PUBLIC_ENABLE_BINANCE_TOPUP_GUIDE`, `NEXT_PUBLIC_ENABLE_BINANCE_PAY`,
`NEXT_PUBLIC_ENABLE_XLM_PAYOUT`, `NEXT_PUBLIC_ENABLE_MONEYGRAM_ROUTE`,
`SOROBAN_ESCROW_CONTRACT_ID`/`ESCROW_CONTRACT_ID` (pakai
`NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID`), `SOROBAN_ADMIN_SECRET_KEY`/
`STELLAR_OPERATOR_SECRET_KEY` (pakai `TRUSTIP_OPERATOR_SECRET_KEY`),
`SOROBAN_ADMIN_ADDRESS`, `STELLAR_RPC_URL`/`STELLAR_HORIZON_URL`/
`STELLAR_NETWORK_PASSPHRASE` (pakai varian `NEXT_PUBLIC_*`), `DATABASE_URL`.

Catatan:
- `TRUSTIP_ALLOW_MAINNET_OPERATOR=true` = keputusan eksplisit bahwa seed operator
  boleh hidup di env production. Seam KMS/HSM (`TRUSTIP_SIGNER_STRATEGY`) ada tapi
  belum dibangun; untuk mainnet v1.1 nilainya harus `env`.
- Upstash Redis WAJIB di production (rate-limit terdistribusi). Tanpa itu verify
  gagal. Anchor domain tidak boleh mengandung "test" saat network mainnet.

## 4. Deploy kontrak

```bash
STELLAR_NETWORK=mainnet NEXT_PUBLIC_STELLAR_NETWORK=mainnet \
STELLAR_DEPLOY_IDENTITY=<cli-identity> \
NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC SAC mainnet> \
pnpm deploy:contract
```

Simpan contract ID → `NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID`, catat tx hash
deploy, verifikasi di explorer.

## 5. Verifikasi sebelum go-live

```bash
pnpm verify:env:production   # statis, pakai secret store production
pnpm verify:env:onchain      # baca chain: kontrak + USDC + operator benar
```

Keduanya harus lulus tanpa error.

## 6. Deploy web + workers

- Vercel: deploy `apps/web` dengan env di atas.
- Workers (proses long-running, mis. VPS/Container/Fly):
  - `workers/escrow-event-indexer` — indexing event + rekonsiliasi.
  - `workers/refund-review-sync` — heal refund approved yang nyangkut.

## 7. Smoke test mainnet (nominal kecil, disetujui terpisah)

1. Buat checkout link, bayar dengan USDC kecil (mis. 1 USDC) dari wallet asli.
2. Konfirmasi diterima → dana sampai ke wallet seller.
3. Order kedua: ajukan refund dari halaman status → approve di `/admin` →
   dana kembali ke wallet pembayar.
4. Cek indexer mencatat semua event; status DB = status on-chain.
5. Drill pause: `STELLAR_NETWORK=mainnet pnpm pause:contract pause` lalu
   `unpause` — pastikan dua-duanya CONFIRMED.

## 8. Known gaps (bukan blocker, keputusan sadar)

- Multi-route payout (XLM/MoneyGram) belum dibangun — flag off.
- Refund evidence upload (foto/video) — **SUDAH ADA** (2026-07-15): buyer
  lampirkan foto/video/PDF ke refund yang masih terbuka; admin lihat via signed
  URL. Private bucket `refund-evidence`.
- Trust profile & reviews — **SUDAH ADA** (2026-07-15): pembeli menilai pesanan
  selesai; trust profile seller (level/rating/skor) tampil di checkout, halaman
  status, dan `/seller/trust`. Migration `20260715200000` + `20260715210000`.
- `pnpm lint` rusak repo-wide (Next 16 canary menghapus `next lint`) —
  pre-existing, tidak memengaruhi build/typecheck/test.

Daftar fitur yang MASIH belum ada (dan apakah blocker mainnet) ada di
`docs/MAINNET_FEATURE_GAPS.md`.
