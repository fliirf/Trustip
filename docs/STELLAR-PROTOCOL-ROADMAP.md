# Stellar Protocol Roadmap — Trustip

Peta protokol/anchor Stellar yang masuk akal untuk Trustip, beserta urutan,
kelayakan testnet, effort, dependensi, dan risiko. **Dokumen perencanaan — belum
ada yang dibangun.**

## Konteks & prinsip

- **Trustip hari ini:** escrow checkout USDC di Soroban. Yang sudah dipakai:
  Soroban smart contract (escrow), **SEP-41** (interface token USDC via SAC),
  dan **mekanisme inti SEP-10** (signed challenge manageData) untuk bukti
  kepemilikan wallet di 3 tempat (seller onboarding, checkout token, buyer
  release). Wallet: Freighter + xBull (adapter custom, bukan Wallets Kit).
- **Constraint:** **testnet-only** (lihat keputusan scope). Anchor konsumen asli
  (MoneyGram Access, dsb.) adalah mainnet/produksi. **Tapi** SDF menjalankan
  *anchor referensi di testnet* yang mengimplementasikan SEP-24/6/10/38/12 —
  jadi integrasi anchor sungguhan **bisa** dibangun & didemo di testnet.
- **Prinsip:** tiap protokol harus melayani produk checkout/escrow. Bukan
  membangun generic DeFi/wallet dashboard (dilarang oleh CLAUDE.md). Tambah
  protokol hanya kalau mengurangi friksi pembeli/penjual atau menambah rute
  uang yang nyata.

## Inventaris protokol

| Protokol | Status di Trustip | Catatan |
|----------|-------------------|---------|
| Soroban contract | ✅ Dipakai | Escrow inti |
| SEP-41 (token interface) | ✅ Dipakai | USDC SAC |
| SEP-10 (wallet auth) | 🟡 Mekanisme inti saja | Signed challenge; belum full Web-Auth (no JWT session, format belum spec-exact) |
| SEP-1 (stellar.toml) | 🟡 Disebut, belum ada file | Belum ada `/.well-known/stellar.toml` |
| SEP-24 / 6 / 38 / 12 (anchor) | ❌ Tidak ada | Skema DB Binance/MoneyGram ada, integrasi nol |
| Sponsored reserves, path payment | ❌ Belum | Protokol native Stellar, belum dipakai |

---

## Roadmap

### Fase A — Fondasi identitas & auth (prasyarat semua anchor)

**A1. SEP-1 — `stellar.toml`**
- **Apa:** serve `/.well-known/stellar.toml` (route Next `text/plain`). Deklarasi
  org, `NETWORK_PASSPHRASE`, `SIGNING_KEY` (operator public key), `CURRENCIES`
  (USDC issuer), nanti `WEB_AUTH_ENDPOINT` + `TRANSFER_SERVER_SEP0024`.
- **Kenapa cocok:** identitas domain; SEP lain merujuk ke sini; kredibilitas.
- **Testnet:** ✅ penuh. **Effort:** XS. **Dependensi:** —.

**A2. SEP-10 full Web-Auth (server) + sesi JWT**
- **Apa:** endpoint standar `GET/POST /auth` — terbitkan challenge lalu verifikasi
  tanda tangan → keluarkan JWT sesi. Login wallet-native (tanpa password).
- **Kenapa cocok:** login pembeli/penjual pakai wallet; reuse crypto challenge
  yang sudah ada. Interop dengan wallet standar butuh **format tx SEP-10 yang
  spec-exact** (server account sebagai source, `<home_domain> auth` manageData,
  `web_auth_domain`, timebounds) — beda dari varian throwaway-source sekarang.
- **Testnet:** ✅. **Effort:** M. **Dependensi:** A1 (home domain).
- **Catatan:** untuk auth INTERNAL Trustip, varian sekarang cukup; spec-exact
  hanya wajib kalau wallet/anchor pihak ketiga harus mengenali server ini.

### Fase B — Integrasi anchor pertama (headline "pakai anchor")

**B1. SEP-10 sebagai CLIENT**
- **Apa:** Trustip mengautentikasi wallet user KE anchor (anchor yang menerbitkan
  challenge, wallet user menandatangani). Lebih mudah dari A2 karena kita cuma
  menandatangani apa yang anchor beri.
- **Testnet:** ✅. **Effort:** S–M. **Dependensi:** —.

**B2. SEP-24 on-ramp (deposit) via SDF test anchor**
- **Apa:** pembeli top-up USDC lewat flow deposit *interaktif* anchor: SEP-1
  discovery → SEP-10 auth ke anchor → `POST /transactions/deposit/interactive`
  → buka URL interaktif anchor (popup) → poll status → USDC masuk ke wallet.
  **Menggantikan panduan Binance manual dengan anchor sungguhan.**
- **Testnet:** ✅ lawan SDF reference test anchor. **Effort:** L.
- **Dependensi:** B1, A1. Butuh modul `features/anchor` + tabel persist transaksi
  anchor + polling status.
- **Risiko:** **CSP** — URL interaktif anchor dimuat di popup/iframe → perlu
  update `frame-src`/`connect-src` di `next.config.mjs` untuk domain anchor
  (nyambung ke kerja CSP kemarin). Liquidity/uptime test anchor = resource demo
  bersama, kadang flaky.

**B3 (opsional). SEP-38 quote**
- Tampilkan rate konversi firm (mis. fiat→USDC) sebelum deposit. Pasangan
  SEP-24. **Effort:** M.

**B4 (opsional). SEP-24 off-ramp (withdraw)**
- Penjual cash-out USDC→(demo) via anchor. Analog konseptual MoneyGram tapi di
  testnet. **Effort:** M.

### Fase C — Kemenangan UX native (independen, tak butuh anchor)

**C1. Sponsored reserves + trustline sponsorship (CAP-33)**
- **Apa:** Trustip mensponsori base reserve + trustline USDC pembeli, sehingga
  wallet baru dengan **0 XLM** tetap bisa memegang & membayar USDC.
- **Kenapa cocok:** menghapus friksi onboarding terbesar (butuh XLM + trustline).
  Operator sudah menandatangani hal lain, jadi pas dengan model kustodinya.
- **Testnet:** ✅. **Effort:** M. **Dependensi:** —.

**C2. Path payment (DEX native)**
- **Apa:** pembeli bayar pakai aset Stellar apa pun (mis. XLM), escrow/seller
  tetap menerima **USDC** via path payment strict-receive lewat DEX/AMM.
- **Kenapa cocok:** hilangkan syarat "harus sudah pegang USDC pas". Pelengkap
  SEP-24 (yang on-ramp fiat).
- **Testnet:** ✅ (mungkin perlu seed liquidity). **Effort:** M.
- **Catatan:** istilah "path payment" dihindari di UI pembeli (CLAUDE.md §12),
  tapi mekanismenya boleh.

---

## Tidak direkomendasikan sekarang

- **SEP-6** — redundan dengan SEP-24 (kita render UI KYC sendiri; lebih berat).
- **SEP-31** — remittance anchor-ke-anchor; menarik untuk payout tapi
  mainnet/kemitraan bisnis.
- **DEX trading UI / staking / yield** — bukan produk Trustip (generic DeFi).

## Risiko lintas-item

- **CSP:** setiap iframe/popup anchor butuh allow-list `frame-src`/`connect-src`.
- **Testnet realism:** anchor asli konsumen = mainnet; testnet cuma SDF reference.
  Demo valid, tapi bukan bukti kesiapan produksi.
- **SEP-10 spec-exactness:** hanya wajib untuk interop pihak ketiga, bukan auth
  internal.
- **Scope creep:** jaga fokus ke checkout/escrow; jangan jadi wallet umum.
- **Kustodi:** sponsored reserves memperluas tanggung jawab operator key.

## Urutan yang disarankan

1. **A1 (SEP-1)** — cepat, fondasi. Kerjakan lebih dulu apa pun pilihannya.
2. Lalu bercabang sesuai tujuan:
   - Ingin "**pakai anchor**" secara harfiah → **B1 → B2** (+A2 untuk login rapi).
   - Ingin **UX menang cepat** tanpa anchor → **C1** lalu **C2** (independen, bisa paralel).
3. Enhancement (B3/B4) setelah B2 jalan.
