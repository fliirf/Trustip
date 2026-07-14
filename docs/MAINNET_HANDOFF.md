# Trustip v1.1 — Mainnet Handoff (2026-07-14)

Langkah deploy mainnet yang **kamu jalankan sendiri**. Kode sudah mainnet-ready;
tidak ada langkah di sini yang butuh perubahan kode.

## 0. Scope yang disepakati

- **Seller payout = escrow release langsung ke wallet USDC seller** (sudah live).
  Multi-route payout (XLM_WALLET / MONEYGRAM_CASHOUT) berstatus **guided/future**
  — flag `NEXT_PUBLIC_ENABLE_XLM_PAYOUT` dan `NEXT_PUBLIC_ENABLE_MONEYGRAM_ROUTE`
  tetap `false` di production.
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

Frontend (Vercel, `NEXT_PUBLIC_*`):

```txt
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://<domain-kamu>
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_STELLAR_RPC_URL=<rpc mainnet pilihanmu>
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=<hasil deploy langkah 4>
NEXT_PUBLIC_USDC_ASSET_CODE=USDC
NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC SAC mainnet>
NEXT_PUBLIC_ANCHOR_DOMAIN=<anchor mainnet, TANPA kata "test">
NEXT_PUBLIC_SUPABASE_URL=<prod supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod anon key>
NEXT_PUBLIC_ENABLE_FREIGHTER=true
NEXT_PUBLIC_ENABLE_XBULL=true
NEXT_PUBLIC_ENABLE_BINANCE_TOPUP_GUIDE=false
NEXT_PUBLIC_ENABLE_BINANCE_PAY=false
NEXT_PUBLIC_ENABLE_XLM_PAYOUT=false
NEXT_PUBLIC_ENABLE_MONEYGRAM_ROUTE=false
```

Backend/server-only (Vercel + workers):

```txt
STELLAR_NETWORK=mainnet
SUPABASE_SERVICE_ROLE_KEY=<prod service role — JANGAN pernah ke frontend>
TRUSTIP_OPERATOR_SECRET_KEY=<seed operator mainnet>
TRUSTIP_ALLOW_MAINNET_OPERATOR=true
TRUSTIP_CHECKOUT_TOKEN_SECRET=<random 32+ byte>
TRUSTIP_WALLET_CHALLENGE_SECRET=<random 32+ byte>
TRUSTIP_SEP10_JWT_SECRET=<random 32+ byte>
```

Catatan: `TRUSTIP_ALLOW_MAINNET_OPERATOR=true` adalah keputusan eksplisit bahwa
seed operator boleh hidup di env production. Kalau nanti mau KMS/HSM, seam-nya
sudah ada (`TRUSTIP_SIGNER_STRATEGY`), tapi belum dibangun.

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
