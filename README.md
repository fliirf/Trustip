# Trustip

**Protected checkout for social commerce, built on Stellar.**

Trustip locks a buyer's USDC payment inside a Soroban smart-contract escrow until the buyer confirms the order arrived. No marketplace, no middleman holding funds, no "transfer dulu ya kak" leap of faith.

> Hackathon Track: **Payment & Consumer Applications**

---

## Problem Statement

Social commerce in Indonesia runs on Instagram, TikTok, and WhatsApp, and on blind trust. Buyers transfer money to a stranger's bank account and hope the package shows up. Sellers get accused of fraud by buyers who never paid. Informal escrow ("rekber") exists precisely because this trust gap is real, but rekber itself is a human middleman who can also disappear with the money.

There is no neutral, verifiable, low-cost way for two strangers on social media to trade safely.

## Proposed Solution

Trustip is a **protected checkout link**. A seller creates a link, shares it in their bio or chat, and the buyer pays with USDC from their own Stellar wallet. The funds are locked in a **Soroban escrow contract** (not held by Trustip, not held by the seller) until one of two things happens:

- the **buyer confirms receipt** (proven by a wallet signature from the exact wallet that paid) → the contract releases the USDC straight to the seller's verified payout wallet, or
- an **admin approves a refund** after reviewing the buyer's evidence → the contract returns the USDC to the exact wallet that funded it.

Double release, double refund, releasing to the wrong address, and paying the wrong amount are all impossible at the contract level. Every state change is an on-chain transaction the buyer can inspect on a block explorer.

## Target Users

- **Social-media sellers** (Instagram/TikTok/WhatsApp shops) who lose sales because new buyers don't trust them yet. Trustip gives them a "Pesanan Aman" checkout and a public, on-chain-backed trust profile.
- **Buyers** purchasing from accounts they've never met. They keep custody of their money until the item is in their hands.
- **Crypto-native users in emerging markets** who already hold USDC on Stellar and want to actually spend it on commerce.

## Team: Silent Epoch

| Name | Role |
|---|---|
| Muhamad Rafli | PM & Engineer |
| Aisy Hafidzah Fadlillah | Engineer & QA |

## Stellar Integration

| Piece | How Trustip uses it |
|---|---|
| **Soroban smart contract (Rust)** | Custom escrow contract: `create_order`, `fund_order`, `release_to_recipient`, `refund_to_buyer`, `cancel_order`, emergency `pause`/`unpause`, two-step admin rotation. 46 contract tests. |
| **USDC on Stellar (Circle)** | The only payment asset. Held by the contract via the Stellar Asset Contract (SAC) / SEP-41 token interface. |
| **Stellar Wallets Kit (Freighter & xBull)** | Buyer payment signing and seller payout-wallet verification. The backend never touches a user's keys. |
| **SEP-10 (wallet authentication)** | Challenge-transaction proof of wallet ownership gates three critical actions: guest checkout token issuance, seller payout-wallet verification, and buyer confirm-received (escrow release). |
| **SEP-24 (hosted deposit)** | Buyer top-up flow at `/topup` against an anchor, for buyers who don't hold USDC yet. |
| **SEP-1 (stellar.toml)** | Domain identity served at `/.well-known/stellar.toml`. |
| **Classic DEX path payments** | Seller payout conversion: released USDC is swapped to XLM via a **strict-send path payment the seller signs themselves**; the operator never custodies funds. Quotes come from Horizon `strictSendPaths` with a 1% slippage floor. |
| **Soroban RPC + Horizon** | Transaction building/simulation/submission, on-chain state verification before any DB status change, and an event indexer that persists escrow events so RPC is never the only historical source. |
| **Block explorer links** | Every payment, release, refund, and conversion surfaces its tx hash with an explorer link, so the proof is buyer-verifiable. |

## Features

### Buyer
- **Checkout link**: public, shareable URL per product; supports quantity, buyer contact, and shipping address (or digital goods with no shipping).
- **Guest checkout, wallet-native payment**: no account needed. Connect Freighter/xBull, sign one `fund_order` transaction. The server verifies the signed tx byte-for-byte (contract, function, order id, buyer, amount) before forwarding it, and only marks anything paid after reading `Funded` back from the chain.
- **Live order status page**: a shareable capability URL (high-entropy order number) showing payment proof, escrow state, shipment progress, and completion proof with tx hashes. Auto-refreshes while the order can still change. Buyer PII is masked to name + city on this public surface.
- **Confirm received = release**: the buyer proves they control the funding wallet (SEP-10 challenge signature); only then does the operator sign `release_to_recipient`. Release is recorded only after the chain reads `Released`.
- **Refund request + evidence**: filing freezes release until an admin decides; the buyer can attach photos/videos/PDFs (private bucket, size- and count-capped) as evidence. An approved refund executes `refund_to_buyer` on-chain; the contract can only send the money back to the wallet that paid.
- **Reviews**: buyers rate completed orders; one review per order.
- **Binance top-up guide + SEP-24 deposit**: guided paths for buyers who don't hold USDC on Stellar yet.
- **Bilingual UI**: Indonesian-first (plain, non-technical language), full English mode.

### Seller
- **Onboarding with wallet proof**: sellers register a payout wallet and prove ownership with a SEP-10 challenge signature; the platform also checks the wallet actually holds a USDC trustline before any checkout link can be created (no order can ever fund toward an undeliverable payout).
- **Checkout link manager**: create/share links with server-derived pricing (clients never submit amounts).
- **Order & shipment dashboard**: strict forward-only lifecycle (`processing → packed → shipped`, or direct `delivered` for digital goods), courier + tracking number, full buyer contact for fulfillment.
- **Multi-route payout**
  - **USDC_WALLET (direct)**: the escrow release *is* the payout; USDC lands in the seller's own wallet, mirrored into a unified payout history.
  - **XLM_WALLET (self-signed DEX conversion)**: one click converts a completed payout's USDC to XLM via a strict-send path payment **signed by the seller's own wallet**. Two-phase recording (submitted → confirmed with the chain-actual received amount) makes the flow crash-safe and double-convert-proof, with automatic recovery after failed attempts.
  - **MONEYGRAM_CASHOUT (guided)**: cash-out route recorded as `needs_review`; execution ships when a MoneyGram Access partnership exists (no fake integrations).
- **Trust profile**: derived on-chain-backed reputation (completed orders, refund rate, ratings, trust score/level) shown to buyers at checkout.

### Platform & security
- **Admin refund resolution**: role-gated review queue with evidence viewing via short-lived signed URLs; approve executes the on-chain refund, reject unblocks the buyer's normal release.
- **Escrow event indexer + reconciliation worker**: persists all contract events to Postgres and heals any "chain succeeded, DB write crashed" drift through idempotent, status-guarded RPCs. A second worker converges refunds stuck mid-approval.
- **Defense in depth**: Supabase RLS on all tables with zero client write grants; all money state changes via `SECURITY DEFINER` RPCs (service-role only); HMAC-bound single-purpose tokens (checkout, payment attempt, confirm-received, conversion); layered rate limiting (distributed Upstash + per-route); fail-closed network guards (mainnet config refuses to fall back to defaults); emergency contract pause.

## Demo Flow

1. **Seller onboarding**: sign in at `/seller/login`, create a profile, connect Freighter, sign the verification challenge. The wallet is now a proven payout destination.
2. **Create a checkout link**: set title + price in USDC (mark it digital-goods if there's nothing to ship). Copy the link.
3. **Buyer opens the link**: fills quantity + contact (+ address), gets an order with an `awaiting_payment` status and a shareable status URL.
4. **Buyer pays**: connects their own wallet, signs one transaction. Watch the status page flip to **"Pesanan Aman"**: the USDC is now locked in the Soroban contract: verifiable via the explorer link.
5. **Seller ships**: updates the order through processing → packed → shipped with a tracking number; the buyer's status page mirrors each step live.
6. **Buyer confirms receipt**: signs the confirm-received challenge with the same wallet that paid. The contract releases the USDC directly to the seller's wallet; the status page shows the release tx hash and the review form.
7. **Seller payout**: `/seller/payouts` shows the release as a completed direct payout. Optional: hit **"Convert to XLM"**, sign the DEX path payment, and watch the conversion recorded with the exact on-chain received amount.
8. **The unhappy path**: on a second order, the buyer files a refund with photo evidence instead of confirming. Release is frozen; the admin reviews at `/admin` and approves; the contract returns the USDC to the buyer's wallet, with the refund tx hash on the status page.

## Repository Structure

```txt
trustip/
├── apps/web/            # Next.js App Router application (buyer, seller, admin)
├── packages/
│   ├── payments/        # Framework-agnostic payment/escrow/payout services
│   ├── stellar/         # Wallet adapters, Soroban/Horizon gateways, SEP-10
│   ├── database/        # Supabase client + generated types
│   ├── validators/      # Shared Zod schemas
│   ├── ui/              # Shared UI primitives
│   └── config/          # Network config, env validation, rate-limit store
├── contracts/escrow/    # Rust Soroban escrow contract + tests
├── workers/             # Escrow event indexer, refund heal, payout sync
├── supabase/            # SQL migrations (schema, RLS, atomic RPCs)
└── scripts/             # Contract deploy, env verification, typegen
```

## Setup & Execution

### Prerequisites

- **Node.js** >= 24, **pnpm** 9.1.0
- **Rust & Cargo** + **Stellar CLI** (for the contract)
- **Supabase CLI** (local database)

### Commands

```bash
pnpm install         # install dependencies
supabase start       # local database (apply migrations with: supabase db reset)
pnpm dev             # run the app + workers in development
pnpm typecheck       # TypeScript checks
pnpm test            # unit tests (packages): plus `cargo test` in contracts/escrow
pnpm build           # production build
pnpm deploy:contract # deploy the escrow contract (uses env network config)
```

Environment template: see `.env.example` (network-scoped; production values are validated by `pnpm verify:env:production` and an on-chain check via `pnpm verify:env:onchain`).
