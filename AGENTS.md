# AGENTS.md — Trustip v1.1

This file provides universal instructions for AI coding agents working on **Trustip v1.1**.

Use this file for OpenCode, Codex-style agents, general coding agents, and any AI assistant that edits this repository.

Trustip is a **Stellar-native protected checkout app** for social commerce. Buyer payments use **USDC on Stellar** through native Stellar wallets. Funds are locked in a **Soroban escrow contract** until the order is completed, released, or refunded.

---

## 1. Product Version

Always treat the current product as:

```txt
Trustip v1.1
```

All work must follow the approved Trustip v1.1 scope.

Do not assume older Trustip versions are valid.

---

## 2. Core Product Scope

### Buyer Payment

Buyer payment is:

```txt
Wallet Stellar Native + USDC
```

Supported MVP wallets:

```txt
Freighter
xBull
```

Buyer top-up support:

```txt
Binance guided top-up
```

Binance is not the main payment gateway. It is only a guide for buyers to obtain USDC externally.

### Escrow

Escrow is handled by:

```txt
Soroban smart contract
Rust
USDC on Stellar
Stellar Asset Contract / SAC
SEP-41 token interface
```

### Seller Payout

Seller payout uses a multi-route strategy:

```txt
USDC_WALLET
XLM_WALLET
MONEYGRAM_CASHOUT
```

MoneyGram is for seller payout/off-ramp, not buyer checkout.

---

## 3. Forbidden Features

Do not implement:

```txt
QRIS buyer payment
Local bank transfer buyer payment
Auto Rupiah-to-USDC conversion
Internal wallet top-up / Add Balance
Buyer-facing payment simulation
Sandbox cashier
Fake payment confirmation
IDRX user-facing labels
Generic DeFi dashboard
Marketplace cart beyond checkout-link scope
Seller settlement history as primary UI
```

Do not create demo shortcuts that change payment status without verified Stellar/Soroban data.

---

## 4. Required Stack

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

### Smart Contract

```txt
Rust
Soroban SDK
Stellar CLI
```

### Stellar

```txt
Stellar Wallets Kit
Freighter
xBull
@stellar/stellar-sdk
Stellar RPC
USDC on Stellar
SAC / SEP-41
```

Recommended but not blocking:

```txt
SEP-10 wallet authentication
SEP-1 stellar.toml identity
```

Future only:

```txt
SEP-6
SEP-24
SEP-12
SEP-38
```

---

## 5. Repository Structure

Use this monorepo structure:

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

## 6. Agent Role Rules

### OpenCode Free / Lightweight Agents

Allowed:

```txt
UI component boilerplate
layout component
form component
dashboard card
table view
empty state
loading state
dummy data
small refactor
test skeleton
markdown cleanup
copy polishing
```

Not allowed without review:

```txt
Soroban contract logic
payment verification
escrow release/refund logic
Supabase RLS final policy
MoneyGram payout orchestration
mainnet env/deployment config
private key or API key handling
```

### High-capability Coding Agents

Allowed:

```txt
multi-file implementation
backend API modules
database migrations
Stellar wallet integration
Soroban contract implementation
worker/indexer implementation
mainnet readiness checks
```

Must still follow all product constraints and security rules.

---

## 7. Implementation Order

Follow this order unless explicitly instructed otherwise:

```txt
1. Repo setup
2. Supabase schema and generated types
3. Soroban escrow contract
4. Stellar wallet integration
5. Payment prepare/submit/sync
6. Buyer checkout flow
7. Seller dashboard
8. Shipment update flow
9. Refund and evidence flow
10. Seller payout methods
11. Payout request/status flow
12. Trust Profile
13. Admin dashboard
14. Worker/indexer
15. QA and mainnet readiness
```

---

## 8. Module Boundaries

### UI Components

Allowed:

```txt
rendering
layout
animation
form display
loading state
error state
```

Not allowed:

```txt
database mutation
payment status mutation
escrow release/refund decision
admin decision logic
direct private env access
```

### Services

Business logic belongs in service modules.

Examples:

```txt
features/payments/services
features/escrow/services
features/payouts/services
features/refunds/services
packages/stellar
packages/database
```

### API Routes

API routes should:

```txt
validate request input
call service modules
enforce auth
enforce role permissions
return typed response
never trust client-only payment status
```

---

## 9. Payment Rules

Payment status must be based on:

```txt
verified Stellar transaction
verified Soroban contract state
indexed contract event
trusted backend sync
```

Do not set payment as paid based only on:

```txt
client request
UI button
local storage
mock response
demo flag
```

Required flow:

```txt
Buyer connects wallet
Buyer signs transaction
Transaction submitted
Backend verifies tx
Backend syncs Soroban state/event
Payment marked confirmed
Order becomes Pesanan Aman
```

---

## 10. Soroban Contract Rules

Soroban contract is written in Rust.

Required methods:

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
fund wrong order
fund wrong amount
release before funded
refund after release
unauthorized release
unauthorized refund
state mutation when paused
```

Emit events for:

```txt
escrow_created
escrow_funded
escrow_released
escrow_refunded
escrow_cancelled
contract_paused
contract_unpaused
```

---

## 11. Payout Rules

Supported payout routes:

```txt
USDC_WALLET
XLM_WALLET
MONEYGRAM_CASHOUT
```

MVP must support at least:

```txt
USDC wallet payout
payout method storage
payout request/status tracking
```

XLM payout and MoneyGram payout may be implemented as guided/staged routes depending on available integrations.

MoneyGram must never be treated as buyer payment rail.

---

## 12. Refund Rules

Refund flow must include:

```txt
buyer refund request
buyer evidence upload
seller response
admin review
admin resolution
contract refund or release
Trust Profile update
```

Do not allow:

```txt
buyer self-approving refund
seller self-releasing disputed order
client-only refund resolution
refund after successful release
```

---

## 13. Supabase and RLS Rules

Enable RLS on exposed tables.

Protect:

```txt
orders
payments
escrows
refund_requests
refund_evidence
seller_payout_methods
payout_requests
payout_transactions
trust_profiles
admin_actions
```

Never allow:

```txt
seller reading another seller's orders
buyer reading another buyer's evidence
non-admin resolving refund
client directly updating escrow status
client directly updating payout status
```

Use service role only in trusted backend/server contexts.

Never expose service role keys to the client.

---

## 14. Worker and Indexer Rules

Stellar RPC is not the long-term app database.

Persist important blockchain data into Supabase:

```txt
blockchain_transactions
escrow_events
payout_transactions
```

Workers should handle:

```txt
payment tx sync
escrow event indexing
release/refund tx sync
payout status sync
stuck transaction detection
safe retry logic
```

Worker operations must be idempotent.

---

## 15. UI and UX Language Rules

Use buyer-friendly language.

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

Avoid buyer-facing terms:

```txt
escrow
settlement
Soroban
contract invocation
Stellar RPC
path payment
dispute
release fund
arbitration
```

Technical details may appear only in transaction detail or developer/admin views.

---

## 16. Animation and Performance Rules

Use animation selectively.

Payment and checkout pages:

```txt
Motion only
no heavy 3D by default
no global Lenis
no blocking animation load
```

Landing/storytelling pages:

```txt
Motion
GSAP/ScrollTrigger
Lenis
lazy-loaded React Three Fiber scenes
```

Admin and forms:

```txt
minimal animation
prioritize clarity and performance
```

---

## 17. Critical Files and Review Required

Require careful review before changing:

```txt
contracts/escrow/**
packages/stellar/**
supabase/migrations/**
supabase/policies/**
workers/**
features/payments/**
features/escrow/**
features/refunds/**
features/payouts/**
app/api/payments/**
app/api/escrows/**
app/api/refunds/**
app/api/payouts/**
```

When modifying these areas, include:

```txt
what changed
why it changed
security implications
tests run
remaining risks
```

---

## 18. Environment and Secret Rules

Do not hardcode:

```txt
contract IDs
RPC URLs
USDC asset config
admin wallet addresses
service role keys
private keys
API keys
MoneyGram credentials
Binance credentials
```

Use environment variables.

Separate:

```txt
testnet config
mainnet config
local development config
```

Never expose secrets in client code.

---

## 19. Mainnet Readiness Gate

Before mainnet, verify:

```txt
no fake payment flow
no buyer-facing simulate button
no QRIS/bank transfer buyer flow
no hardcoded testnet config
wallet network guard enabled
USDC asset config verified
Soroban contract deployed and verified
tx hashes saved
escrow events indexed
RLS enabled
admin permissions protected
emergency pause available
release/refund tested
payout routes tested or clearly marked guided/future
```

---

## 20. Default Agent Behavior

Always:

```txt
keep changes scoped
read relevant docs before coding
preserve Trustip v1.1 scope
prefer small, reviewable diffs
validate input
handle error states
write clear status transitions
avoid silent fallback behavior
```

Never:

```txt
invent product scope
add forbidden payment methods
fake blockchain state
hide security assumptions
expose secrets
perform destructive changes without confirmation
```

---

## 21. Final Reminder

Trustip v1.1 is:

```txt
USDC-first
Stellar-native
Soroban-secured
wallet-based
Freighter + xBull for buyer payment
Binance as buyer top-up guide
MoneyGram as seller payout/off-ramp route
no QRIS
no buyer bank transfer
no automatic Rupiah-to-USDC conversion
no fake payment simulation
```
