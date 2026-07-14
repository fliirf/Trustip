# Trustip v1.1 — Mainnet Feature Gaps (2026-07-15)

Fitur yang **belum diimplementasikan**, sekarang mainnet sudah masuk scope. Untuk
tiap item: status saat ini, apakah **blocker mainnet** atau **produk/future**, dan
rekomendasi. Sumber: docs spec + `docs/STELLAR-PROTOCOL-ROADMAP.md` + kode.

**Ringkasan:** Inti checkout/escrow (bayar → lock → rilis/refund) sudah live dan
teraudit. **Tidak ada gap di bawah ini yang menghalangi go-live mainnet** untuk
scope yang disepakati (payout = rilis escrow langsung ke wallet USDC seller).
Semua yang tersisa adalah fitur produk atau rute uang tambahan yang perlu
keputusan bisnis / effort besar — jadi dilaporkan, bukan dibangun diam-diam.

---

## A. Payout & off-ramp

### A1. Integrasi MoneyGram sungguhan (payout/off-ramp)
- **Status:** hanya skema DB (`payout_requests`, `payout_transactions`,
  `moneygram_payout_details`); **nol implementasi**. CLAUDE.md §10 menetapkan MVP =
  **guided/manual**, bukan API.
- **Blocker mainnet?** **Tidak.** Payout MVP = rilis escrow langsung ke wallet
  USDC seller (live). MoneyGram = rute tambahan.
- **Kenapa tidak dibangun sekarang:** butuh **partner/agreement MoneyGram Access +
  KYC/compliance (SEP-12) + integrasi API** — item mainnet/bisnis, bukan yang bisa
  diselesaikan tanpa kemitraan. Membangun "simulasi" melanggar aturan no-fake.
- **Rekomendasi:** tetap guided/manual sampai ada partner; flag
  `NEXT_PUBLIC_ENABLE_MONEYGRAM_ROUTE=false`.

### A2. Multi-route payout (XLM_WALLET / MONEYGRAM_CASHOUT)
- **Status:** enum + flag ada, **flow tidak dibangun**. Fase 10–11 (seller payout
  methods, payout request/status) tidak pernah dibuat — tidak ada
  `seller_payout_methods` UI/API, tidak ada `payout_requests` flow.
- **Blocker mainnet?** **Tidak** (deliberate; flags off).
- **Effort:** besar (subsystem payout penuh: pilih metode, request, status sync,
  worker `payout-sync`).
- **Rekomendasi:** post-mainnet. XLM_WALLET route paling kecil kalau mau mulai.

---

## B. Anchor / SEP tambahan (roadmap Fase B/C)

### B1. SEP-24 off-ramp (withdraw) — seller cash-out via anchor
- **Status:** belum ada. On-ramp SEP-24 (deposit/top-up) **sudah** ada di `/topup`.
- **Blocker mainnet?** Tidak. Analog konsep MoneyGram tapi via anchor.
- **Effort:** M. Testnet lawan SDF reference anchor; anchor konsumen asli =
  mainnet.
- **Rekomendasi:** future.

### B2. SEP-38 (firm quotes)
- **Status:** belum ada. Pasangan SEP-24 (tampilkan rate fiat→USDC sebelum
  deposit).
- **Blocker mainnet?** Tidak. Opsional UX.
- **Rekomendasi:** future, setelah SEP-24 dipakai betulan.

### B3. Path payment (Fase C2) — bayar pakai aset Stellar apa pun
- **Status:** belum ada. Pembeli bayar mis. XLM, escrow terima USDC via
  strict-receive DEX/AMM.
- **Blocker mainnet?** Tidak. Menghapus syarat "harus sudah pegang USDC".
- **Effort:** M (mungkin perlu seed likuiditas di testnet).
- **Rekomendasi:** kandidat UX-win kuat pasca-mainnet.

> Sponsored reserves (Fase C1) **dikecualikan** atas permintaan — tidak dibahas.

### B4. SEP-12 (KYC), SEP-6 — **tidak direkomendasikan** (lihat roadmap). SEP-6
redundan dgn SEP-24; SEP-12 hanya perlu kalau anchor/off-ramp KYC diintegrasikan.

---

## C. Fitur produk yang tabelnya sudah ada tapi kosong

### C1. Notifications
- **Status:** tabel `notifications` ada; **tidak ada** produce/consume/UI. Copy di
  app sengaja TIDAK menjanjikan notifikasi (Fase 17) supaya bukan bohong.
- **Blocker mainnet?** Tidak (produk).
- **Effort:** M (butuh mekanisme kirim: email/web push + UI daftar).
- **Rekomendasi:** post-mainnet; halaman status sudah auto-refresh 45s sebagai
  pengganti sementara.

### C2. Admin: restrict / unrestrict seller
- **Status:** enum `admin_action_type.restrict_seller` + trust level `restricted`
  ada. Trust recompute **mempertahankan** `restricted` (sticky), tapi **belum ada
  aksi admin yang men-set-nya**. `trust_event_type.seller_restricted` /
  `manual_adjustment` belum dipakai.
- **Blocker mainnet?** Tidak (moderasi, bukan uang).
- **Kenapa tidak dibangun diam-diam:** ini **otoritas admin baru yang
  security-sensitive** — sesuai disiplin critical-areas, jangan tambah kode admin
  moderasi tanpa review eksplisit. Loop-nya kecil (aksi admin → set level +
  `seller_restricted` event) kalau kamu mau lanjut.
- **Rekomendasi:** bangun kalau moderasi diperlukan; kecil & aman kalau diminta.

### C3. Binance Pay checkout (bukan guide)
- **Status:** hanya guide (flag). CLAUDE.md §11: Binance Pay = future.
- **Blocker mainnet?** Tidak. Jangan bangun kecuali diminta eksplisit.

### C4. Courier tracking integration (auto)
- **Status:** manual (seller isi courier + resi). Auto-tracking = future
  (`docs/Trustip_Future_Courier_Tracking_Integration.md`).
- **Blocker mainnet?** Tidak.

---

## D. Operasional / hardening (dari OPERATIONS.md §12) — relevan mainnet

Ini bukan "fitur" tapi item kesiapan produksi yang sebaiknya diputuskan:

- **KMS/HSM untuk operator key** — saat ini seed operator hidup di env
  (`TRUSTIP_ALLOW_MAINNET_OPERATOR=true`, keputusan sadar). Seam
  `createOperatorSigner(strategy)` ada tapi kms/hsm/vault **fail-closed
  (unimplemented)**. Untuk mainnet dengan dana nyata, pertimbangkan KMS. **Bukan
  blocker teknis**, tapi keputusan risiko kustodi.
- **Indexer single-instance** — `escrow-event-indexer` harus jalan satu instance
  (checkpoint tidak di-lock lintas instance).
- **Rate limiter** — in-memory per-instance; ada seam Upstash REST. Untuk multi
  instance Vercel, set store terdistribusi.
- **`pnpm lint` rusak** (Next 16 canary hapus `next lint`) — pre-existing, tidak
  memengaruhi build/typecheck/test.

---

## Kesimpulan

Untuk **go-live mainnet** (scope disepakati), yang wajib hanyalah langkah di
`docs/MAINNET_HANDOFF.md` (env, deploy kontrak, verifikasi on-chain, smoke test).
Semua item di atas **opsional / post-mainnet**. Prioritas produk yang paling
mengurangi friksi setelah live: **B3 path payment** dan **C1 notifications**.
