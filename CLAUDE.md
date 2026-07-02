# CLAUDE.md — Trustip v1.1

This file provides Claude Code with project-specific instructions for building **Trustip v1.1**.

Trustip is a **Stellar-native protected checkout app** for social commerce. Buyer payments use **USDC on Stellar** through native Stellar wallets. Funds are locked in a **Soroban escrow contract** until the order is completed, released, or refunded.

---

## 1. Project Version

Always treat the current product version as:

```txt
Trustip v1.1
```

All implementation decisions must follow the approved v1.1 documents:

- Product Overview v1.1
- PRD v1.1
- ERD v1.1
- Tech Stack Spec v1.1
- API & Soroban Contract Spec v1.1
- Code Architecture & Repository Structure Spec
- Testing & QA Checklist v1.1
- Security & Risk Spec v1.1
- Deployment & Environment Setup Guide v1.1
- Agent Implementation Guide v1.1

If implementation details conflict, prioritize in this order:

1. Security & Risk Spec
2. API & Soroban Contract Spec
3. ERD Spec
4. PRD
5. Tech Stack Spec
6. Code Architecture Spec
7. Product Overview

---

## 2. Core Product Scope

### Buyer Payment

Buyer payment is fixed to:

```txt
Wallet Stellar Native + USDC
```

Supported wallets for MVP:

```txt
Freighter
xBull
```

Buyer top-up support:

```txt
Binance guided top-up
```

Binance is only used as a **top-up guide** in MVP. Buyer obtains USDC externally through Binance, withdraws or holds USDC on Stellar, then pays Trustip through a Stellar wallet.

### Escrow

Escrow is handled by:

```txt
Soroban smart contract written in Rust
USDC on Stellar
Stellar Asset Contract / SAC
SEP-41 token interface
```

### Seller Payout

Seller payout supports multi-route strategy:

```txt
USDC_WALLET
XLM_WALLET
MONEYGRAM_CASHOUT
```

MoneyGram is used as a **seller payout/off-ramp route**, not as buyer checkout payment.

---

## 3. Forbidden Features

Do not implement these in Trustip v1.1:

```txt
QRIS buyer payment
Local bank transfer buyer payment
Auto Rupiah-to-USDC conversion
Internal Add Balance / wallet top-up system
Buyer-facing payment simulation button
Sandbox cashier
Fake payment confirmation
IDR stablecoin label or IDRX user-facing label
Seller settlement history as primary UI
Generic DeFi dashboard
Marketplace-style cart beyond checkout-link scope
```

Do not reintroduce removed concepts unless explicitly requested:

```txt
Add Balance
Sandbox Cashier
Demo Ops buyer simulation
QRIS claim
Bank Transfer primary buyer flow
```

---

## 4. Required Technical Stack

### Frontend

```txt
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui or Radix-based components
Motion for app UI animation
GSAP/ScrollTrigger only for landing/storytelling pages
Lenis only for public smooth-scroll pages
React Three Fiber only for lazy-loaded VOID scenes
```

Rules:

- Keep checkout/payment pages lightweight.
- Do not load heavy 3D/GSAP/Lenis on critical payment routes unless lazy-loaded.
- Prioritize performance, clarity, and mobile responsiveness.

### Backend

```txt
Node.js runtime
TypeScript
Next.js Route Handlers
Supabase PostgreSQL
Supabase Auth
Supabase Storage
Supabase RLS
```

Backend rules:

- Business logic belongs in services, not React components.
- API routes should validate inputs with Zod or equivalent schema validation.
- Do not trust client-submitted payment status.
- Always verify blockchain transaction data before updating escrow/payment state.

### Smart Contract

```txt
Rust
Soroban SDK
Stellar CLI
```

Soroban contract must handle:

```txt
initialize
create_order
fund_order
release_to_recipient
refund_to_buyer
cancel_order
pause_contract
unpause_contract
get_order
```

Contract must prevent:

```txt
double release
double refund
unauthorized release
unauthorized refund
funding wrong order
funding wrong amount
release before funded
refund after released
```

### Stellar Integration

Use:

```txt
Stellar Wallets Kit
Freighter
xBull
@stellar/stellar-sdk
Stellar RPC
Stellar Asset Contract / SAC
SEP-41
USDC on Stellar
```

Recommended:

```txt
SEP-10 wallet authentication
SEP-1 stellar.toml domain identity
```

Future only:

```txt
SEP-6
SEP-24
SEP-12
SEP-38
```

Those anchor SEPs are not part of MVP because Trustip v1.1 does not implement direct IDR on-ramp or automatic fiat conversion.

---

## 5. Repository Architecture

Use monorepo structure.

Recommended structure:

```txt
trustip/
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── hooks/
│       ├── lib/
│       ├── styles/
│       └── middleware.ts
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── stellar/
│   ├── validators/
│   └── config/
│
├── contracts/
│   └── escrow/
│       ├── src/
│       ├── test/
│       └── Cargo.toml
│
├── workers/
│   ├── escrow-event-indexer/
│   ├── payout-sync/
│   └── refund-review-sync/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── policies/
│
├── scripts/
│   ├── deploy-contract.ts
│   ├── seed-db.ts
│   └── generate-types.ts
│
├── docs/
├── package.json
├── turbo.json
└── README.md
```

---

## 6. Module Boundaries

Respect these boundaries:

### UI Components

Allowed:

```txt
visual rendering
layout
form display
loading state
error state
animation
```

Not allowed:

```txt
direct database mutation
direct payment state mutation
escrow release/refund logic
admin decision logic
```

### Feature Modules

Use feature folders for:

```txt
checkout
wallet
orders
payments
escrow
shipments
refunds
payouts
trust-profile
admin
```

### Stellar Package

`packages/stellar` should contain:

```txt
wallet adapters
network config
USDC asset config
Soroban RPC client
transaction builders
contract invocation helpers
explorer link helpers
```

### Database Package

`packages/database` should contain:

```txt
Supabase client
typed database helpers
generated types
query helpers
RLS-aware access patterns
```

### Validators Package

`packages/validators` should contain shared schemas for:

```txt
orders
payments
escrows
refunds
payouts
shipments
reviews
admin actions
```

---

## 7. API Implementation Rules

Use REST-style route handlers or equivalent Next.js API route patterns.

Required API areas:

```txt
auth
seller profile
checkout links
orders
payments
wallets
escrows
shipments
refunds
payout methods
payout requests
trust profile
admin
```

Important payment APIs:

```txt
POST /api/payments/prepare
POST /api/payments/submit
POST /api/payments/sync
GET  /api/payments/:id
```

Important payout APIs:

```txt
GET  /api/seller/payout-methods
POST /api/seller/payout-methods
POST /api/payouts
GET  /api/payouts/:id
POST /api/payouts/:id/sync
```

Do not mark payment as paid from client-only input. Payment status must come from:

```txt
verified Stellar transaction
Soroban contract state
indexed contract event
trusted backend sync
```

---

## 8. Database Rules

Use Supabase PostgreSQL.

Core tables should include:

```txt
users
seller_profiles
user_wallets
checkout_links
orders
order_items
payments
escrows
shipments
refund_requests
refund_evidence
seller_payout_methods
payout_requests
payout_transactions
reviews
trust_profiles
trust_events
admin_actions
blockchain_transactions
escrow_events
```

Required payout method enum:

```txt
USDC_WALLET
XLM_WALLET
MONEYGRAM_CASHOUT
```

Required order/payment/escrow state changes must follow ERD v1.1.

Enable RLS for exposed tables.

Never allow:

```txt
seller accessing other seller orders
buyer accessing other buyer evidence
non-admin resolving refund
client directly changing escrow status
client directly changing payout status
```

---

## 9. Worker and Indexer Rules

Stellar RPC is not a long-term historical database.

Trustip must store relevant chain events in Supabase:

```txt
escrow_events
blockchain_transactions
payout_transactions
```

Worker responsibilities:

```txt
sync submitted payment tx
sync escrow events
sync release/refund tx
sync payout route status
detect failed or stuck tx
retry safe idempotent operations
```

Do not rely on Stellar RPC as the only historical source for app state.

---

## 10. MoneyGram Rules

MoneyGram is not buyer payment in v1.1.

Use MoneyGram only as:

```txt
seller payout/off-ramp route
```

MVP/near-term implementation may be:

```txt
guided MoneyGram cash-out
payout status tracking
off-ramp route record
manual/admin-assisted payout process
```

Production/future implementation may include:

```txt
integrated MoneyGram API
partner-based payout execution
compliance/KYC flow
automated cash-out status sync
```

Do not build buyer checkout around MoneyGram.

---

## 11. Binance Rules

Binance is used in MVP as:

```txt
buyer top-up guide
```

Do not build Binance Pay as MVP unless explicitly instructed.

Future feature:

```txt
Binance Pay checkout
Trustip Stellar Treasury
Soroban USDC escrow
```

If implementing Binance guide:

- show steps clearly
- warn user to choose Stellar network
- do not claim Binance is Trustip payment gateway
- do not automatically convert Rupiah inside Trustip

---

## 12. UX Language Rules

Buyer-facing language must be simple.

Use:

```txt
Bayar
Pesanan Aman
Pembayaran Diterima
Pesanan Diproses
Dikemas
Dikirim
Pesanan Diterima
Ajukan Bantuan
Ajukan Refund
Riwayat Pesanan
Bukti Transaksi
Trust Profile
```

Avoid buyer-facing technical terms:

```txt
escrow
settlement
Soroban
contract invocation
Stellar RPC
path payment
dispute
release fund
refund arbitration
```

Technical details may appear only in advanced/transaction detail sections.

---

## 13. Critical Areas

Treat these as high-risk and require careful review:

```txt
Soroban Rust escrow contract
USDC payment verification
wallet signing flow
release/refund authorization
double release/refund prevention
Supabase RLS policies
admin refund resolution
MoneyGram payout route
mainnet environment config
private keys / API keys
worker/indexer consistency
```

Before committing changes to these areas:

1. Read relevant project docs.
2. Limit the scope of the change.
3. Run tests.
4. Check against Security & Risk Spec v1.1.
5. Do not silently introduce fallback/demo behavior.

---

## 14. Mainnet Readiness Rules

Before mainnet:

- no fake payment flow
- no buyer-facing simulate button
- no hardcoded testnet-only values
- no hardcoded contract IDs inside UI components
- all env vars separated by network
- Stellar network guard enabled
- USDC config verified
- Soroban contract deployed and verified
- tx hashes stored
- escrow events indexed
- RLS enabled
- admin actions protected
- emergency pause available
- release/refund tested
- payout routes tested or clearly marked as guided/future

---

## 15. Commands

Use these as examples. Adjust only if repository scripts differ.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Soroban contract examples:

```bash
cd contracts/escrow
cargo test
stellar contract build
stellar contract deploy
```

Supabase examples:

```bash
supabase start
supabase db reset
supabase gen types typescript --local
```

---

## 16. AI Agent Behavior Rules

When working on Trustip:

- Keep changes scoped.
- Do not rewrite unrelated files.
- Do not invent new product flows.
- Do not change approved terminology without instruction.
- Do not implement forbidden payment methods.
- Do not modify security-critical code without explaining the change.
- Prefer small, reviewable commits.
- Preserve Trustip v1.1 scope.
- Ask for confirmation before destructive changes.
- Never expose secrets, API keys, private keys, seed phrases, or service role keys.

---

## 17. Default Implementation Order

Follow this order unless instructed otherwise:

```txt
1. Repo setup
2. Supabase schema and types
3. Soroban escrow contract
4. Stellar wallet integration
5. Payment prepare/submit/sync
6. Buyer checkout
7. Seller dashboard
8. Order shipment flow
9. Refund and evidence flow
10. Seller payout methods
11. Payout request/status flow
12. Trust Profile
13. Admin dashboard
14. Worker/indexer
15. QA and mainnet readiness
```

---

## 18. Final Reminder

Trustip v1.1 is:

```txt
USDC-first
Stellar-native
Soroban-secured
Wallet-based
Buyer payment via Freighter/xBull
Binance as top-up guide
MoneyGram as seller payout/off-ramp route
No QRIS
No bank transfer buyer payment
No automatic Rupiah-to-USDC conversion
No fake payment simulation
```
