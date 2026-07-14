# Trustip Tech Stack Specification v1.1

**Product:** Trustip - Stellar-Native Protected Checkout  
**Version:** v1.1  
**Status:** MVP Implementation Spec  
**Updated Scope:** Interactive web experience, Stellar-native buyer payment, Binance top-up guide, and multi-route seller payout with MoneyGram off-ramp strategy.

---

## 1. Document Purpose

This document defines the recommended technology stack for Trustip after the latest product decision:

- Buyer payment is fixed as **USDC on Stellar via Stellar-native wallets**.
- Supported MVP wallets: **Freighter** and **xBull**.
- Binance is used as a **guided USDC top-up path**, not as an automated payment gateway in MVP.
- Binance Pay is a **future feature**.
- Seller payout supports **multi-route payout strategy**: USDC wallet, XLM wallet, and MoneyGram cash-out/off-ramp route.
- Frontend must feel like a premium interactive product: smooth scroll, cinematic status animation, VOID visual language, fast loading, and strong performance.

The stack below is optimized for a 2-week hackathon build while remaining linear with future production architecture.

---

## 2. Architecture Principles

1. **Stellar-first for money movement**  
   Payment protection must happen through real Stellar wallet signing, USDC on Stellar, Soroban escrow, Stellar Asset Contract, and Stellar RPC.

2. **Interactive UI without sacrificing checkout reliability**  
   Heavy animation is allowed for landing/status/Trust Profile pages, but critical checkout and wallet approval screens must stay fast and stable.

3. **Clear frontend/backend separation**  
   UI handles wallet connection and user experience. Backend handles order state, verification, evidence, payout orchestration, and admin review. Soroban handles escrow fund protection.

4. **No private keys on backend**  
   Buyer and seller keys remain inside Freighter/xBull or their wallet provider. Trustip stores public wallet addresses and transaction hashes only.

5. **MVP is USDC-first, not fiat-on-ramp**  
   Trustip does not auto-convert Rupiah to USDC in MVP. Fiat on-ramp SEPs and Binance Pay are future extensions.

6. **MoneyGram belongs to seller payout/off-ramp**  
   MoneyGram is not used as buyer checkout rail. It is part of seller payout multi-route strategy, especially for converting released USDC into cash/fiat through supported MoneyGram routes.

---

## 3. Recommended Stack Summary

| Layer                     | Recommended Stack                                              |           MVP Status | Reason                                                                                                                    |
| ------------------------- | -------------------------------------------------------------- | -------------------: | ------------------------------------------------------------------------------------------------------------------------- |
| Web framework             | **Next.js 16 App Router + React 19 + TypeScript**              |                 Core | Modern React full-stack framework with server/client split, route handlers, streaming, and strong Vercel deployment path. |
| Styling                   | **Tailwind CSS v4 + CSS variables**                            |                 Core | Fast custom VOID UI, design tokens, responsive styling, and dark premium interface.                                       |
| UI primitives             | **shadcn/ui + Radix UI + Lucide icons**                        |                 Core | Accessible dialogs, forms, tabs, drawers, toasts, and wallet modals.                                                      |
| Animation                 | **Motion for React**                                           |                 Core | Smooth micro-interactions, modal transitions, payment status transitions, and layout animations.                          |
| Scroll animation          | **GSAP + ScrollTrigger**                                       |            Selective | Cinematic landing, scroll-driven sections, status storytelling, and premium demo/pitch visuals.                           |
| Smooth scroll             | **Lenis**                                                      |            Selective | Smooth landing/status page scrolling; disabled on admin/forms if it hurts usability.                                      |
| 3D / WebGL                | **Three.js + React Three Fiber + Drei + postprocessing**       |            Selective | VOID orb, escrow ring, particles, animated trust seal, and immersive status scenes.                                       |
| Lightweight vector motion | **Lottie or Rive**                                             |             Optional | Efficient status illustrations when full WebGL is too heavy.                                                              |
| Data fetching             | **TanStack Query**                                             |                 Core | Server state, refetching payment/order status, optimistic UI, and sync after tx confirmation.                             |
| UI state                  | **Zustand**                                                    |                 Core | Wallet modal, local checkout state, animation state, and app-level status.                                                |
| Forms/validation          | **React Hook Form + Zod**                                      |                 Core | Typed validation for onboarding, checkout link creation, shipment proof, refund evidence, and payout settings.            |
| Backend/BFF               | **Next.js Route Handlers + TypeScript service modules**        |                 Core | Simple full-stack architecture for hackathon and clear API boundary for future scaling.                                   |
| Database                  | **Supabase Postgres**                                          |                 Core | Relational ERD, RLS, realtime, storage, auth, and fast implementation.                                                    |
| Auth                      | **Supabase Auth + wallet address linking**                     |                 Core | Email/Google login for seller/admin, wallet identity for buyer/seller payment actions.                                    |
| Storage                   | **Supabase Storage private buckets**                           |                 Core | Shipment photos, refund evidence, unboxing videos, and signed URL access.                                                 |
| Background jobs           | **Vercel Cron / Supabase Edge Function worker**                |                 Core | Tx sync, order expiry, payout status sync, refund/admin timers.                                                           |
| Smart contract            | **Soroban Rust contract with soroban-sdk**                     |                 Core | Escrow lock, release, refund, events, and core Stellar hackathon proof.                                                   |
| Contract asset interface  | **Stellar Asset Contract (SAC) + SEP-41**                      |                 Core | Lets Soroban escrow interact with USDC on Stellar.                                                                        |
| App SDK                   | **@stellar/stellar-sdk + Stellar RPC**                         |                 Core | Build/simulate/submit transactions and read contract state.                                                               |
| Wallet connection         | **Stellar Wallets Kit or adapter layer for Freighter + xBull** |                 Core | Multi-wallet UX and consistent signing path.                                                                              |
| Explorer/proof            | **Stellar Expert / Stellar Lab links**                         |                 Core | Show tx hash, contract ID, and audit proof.                                                                               |
| Binance                   | **Guided top-up content**                                      |          Core helper | Buyer learns how to obtain USDC and withdraw to Stellar wallet.                                                           |
| Binance Pay               | **Merchant checkout API**                                      |               Future | Future automated payment checkout after KYB/API access.                                                                   |
| MoneyGram                 | **Seller off-ramp route**                                      | Stretch / Production | Cash-out or fiat payout path after escrow release.                                                                        |

---

## 4. Frontend Stack Detail

### 4.1 Core Framework

Use:

```text
Next.js 16 App Router
React 19
TypeScript strict mode
pnpm
```

Recommended project style:

```text
/app                 -> Next.js routes, layouts, route handlers
/components          -> shared reusable UI components
/features            -> feature modules: checkout, seller, admin, wallet, payout
/lib                 -> shared helpers: db, stellar, env, validation, constants
/contracts           -> Soroban contract source and generated bindings
/public              -> static assets, icons, OG images
/styles              -> global CSS, design tokens, animation variables
```

Why this stack:

- One codebase can serve frontend, server route handlers, and BFF endpoints.
- Server Components should be used by default for static/read-heavy content.
- Client Components should be isolated to wallet, animation, forms, and live order interactions.
- Vercel deployment is straightforward for frontend/API, while Supabase handles data/storage.

### 4.2 Styling and UI System

Use:

```text
Tailwind CSS v4
CSS variables for theme tokens
shadcn/ui
Radix UI
Lucide React
class-variance-authority
clsx / tailwind-merge
```

Design token categories:

```text
colors: void-black, trust-blue, stellar-purple, success-emerald, warning-red, glass-border
spacing: card gaps, page padding, status timeline spacing
radius: glass card radius, modal radius, pill radius
shadow: glow, orbit glow, risk glow, success glow
motion: duration-fast, duration-normal, duration-cinematic
z-index: modal, wallet, toast, overlay, background-canvas
```

UI components to standardize:

```text
Button
GlassCard
StatusPill
WalletButton
CheckoutSummary
TrustProfileCard
OrderTimeline
EvidenceUploader
PayoutRouteCard
AdminDecisionPanel
Toast
Dialog
Drawer
```

### 4.3 Animation and Interaction Stack

Use animation by purpose, not randomly.

| Use Case                                                           | Library                                   | Notes                                                          |
| ------------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| Modal transitions, card hover, status step transitions             | Motion for React                          | Default animation library for app UI.                          |
| Landing page scroll scenes, pinned sections, timeline storytelling | GSAP + ScrollTrigger                      | Use only on marketing/status/pitch-heavy screens.              |
| Smooth scroll experience                                           | Lenis                                     | Use on landing and public pages; avoid on complex forms/admin. |
| 3D VOID orb, escrow ring, particles, trust seal                    | React Three Fiber + Drei + postprocessing | Dynamic import only; never block checkout load.                |
| Simple status illustrations                                        | Lottie / Rive                             | Use as fallback for lower-end devices.                         |

Animation rules:

```text
1. Payment approval and wallet signing screens must stay simple and fast.
2. Heavy WebGL should load after main content or only inside visual sections.
3. Respect prefers-reduced-motion.
4. Pause canvas animation when tab is hidden.
5. Use fallback SVG/Lottie if WebGL fails.
6. Do not animate large layout shifts during payment confirmation.
7. Use dynamic imports for R3F/GSAP-heavy scenes.
```

Recommended frontend dependencies:

```bash
pnpm add next react react-dom typescript
pnpm add tailwindcss @tailwindcss/postcss
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-dropdown-menu @radix-ui/react-toast
pnpm add motion gsap lenis
pnpm add three @react-three/fiber @react-three/drei @react-three/postprocessing
pnpm add zustand @tanstack/react-query react-hook-form zod @hookform/resolvers
```

Optional:

```bash
pnpm add lottie-react @rive-app/react-canvas recharts vaul sonner
```

### 4.4 Frontend Performance Rules

Critical pages:

```text
/checkout/[slug]
/order/[orderId]
/seller/orders/[orderId]
/admin/refunds/[refundId]
```

Rules:

```text
- Keep checkout above-the-fold JS small.
- Do not load 3D canvas before wallet/payment UI is usable.
- Use Next dynamic import for GSAP/R3F components.
- Use image optimization for seller evidence thumbnails.
- Compress uploaded proof images and lazy-load videos.
- Use TanStack Query polling only for active order/payment screens.
- Use server-rendered shell for public checkout link.
- Use skeletons for wallet/payment status rather than blocking full page render.
```

Suggested performance budgets:

```text
Initial JS for checkout route: keep as low as possible; avoid loading R3F/GSAP in base bundle.
Images: WebP/AVIF where possible.
Video evidence: private storage, thumbnail preview, avoid autoplay.
Animation FPS target: 60fps on modern laptop; degrade gracefully on mobile.
```

---

## 5. Backend and Data Stack

### 5.1 Backend Framework

Use:

```text
Next.js Route Handlers
TypeScript service modules
Zod validation
Supabase server client
```

Backend responsibility:

```text
- Create checkout links
- Manage orders
- Prepare Stellar transaction payloads/XDR
- Verify tx hash and contract status
- Store payment/escrow events
- Manage shipment proof
- Manage refund evidence
- Orchestrate seller payout routes
- Update Trust Profile metrics
- Provide admin review APIs
```

Backend must not:

```text
- Store buyer/seller private keys
- Auto-control buyer Binance account
- Pretend Binance top-up is payment confirmation
- Expose service role key to client
- Release funds without contract verification
```

### 5.2 Database, Auth, and Storage

Use:

```text
Supabase Postgres
Supabase Auth
Supabase Storage
Supabase Realtime optional
Supabase Row Level Security
```

Why Supabase:

- Fast MVP build.
- Fits relational ERD: orders, payments, escrows, refunds, payout routes, trust events.
- RLS supports buyer/seller/admin separation.
- Storage supports private evidence files and signed URLs.
- Realtime can update order status without building custom WebSocket infra.

Recommended access pattern:

```text
Client -> Supabase anon key for safe read/write with RLS
Server Route Handler -> Supabase service role for admin/system operations only
Worker/Cron -> Supabase service role for sync jobs
```

### 5.3 Background Jobs

MVP jobs:

```text
sync-stellar-transactions
sync-escrow-events
expire-unpaid-orders
sync-payout-status
update-trust-profile-metrics
cleanup-expired-signed-urls
```

Recommended implementation:

```text
Vercel Cron -> Next.js /api/jobs/* route handlers
or
Supabase Edge Functions + scheduled triggers
```

Production option:

```text
Dedicated worker service using Node.js + queue/cron
Trigger.dev / Inngest optional if workflow orchestration grows
```

---

## 6. Stellar and Soroban Stack

### 6.1 Core Stellar Components

| Component                                  | Trustip Usage                                |      MVP Status |
| ------------------------------------------ | -------------------------------------------- | --------------: |
| Freighter                                  | Browser wallet connection and signing        |            Core |
| xBull                                      | Alternative Stellar wallet                   |            Core |
| Stellar Wallets Kit / wallet adapter layer | Connect wallet abstraction                   |            Core |
| USDC on Stellar                            | Payment asset and seller wallet payout asset |            Core |
| Soroban Rust contract                      | Escrow lock/release/refund                   |            Core |
| soroban-sdk                                | Contract implementation                      |            Core |
| Stellar CLI                                | Contract build/deploy/invoke/test            |            Core |
| Stellar Asset Contract (SAC)               | Let contract interact with USDC              |            Core |
| SEP-41 Token Interface                     | Token interface implemented by SAC           |            Core |
| Stellar RPC                                | Simulate, submit, and read contract state    |            Core |
| Stellar Expert / Lab                       | Explorer proof and debugging                 |            Core |
| SEP-10                                     | Wallet auth / proof of wallet ownership      |     Recommended |
| SEP-1 stellar.toml                         | Domain/project identity                      |     Recommended |
| SEP-6 / SEP-24 / SEP-12 / SEP-38           | Fiat anchor/on-ramp                          | Future, not MVP |

### 6.2 Wallet Flow

```text
1. User opens checkout/order page.
2. Frontend opens wallet modal.
3. User chooses Freighter or xBull.
4. Frontend reads public key and network.
5. Backend prepares order/payment intent and expected escrow amount.
6. Frontend builds or receives transaction XDR.
7. Wallet signs transaction.
8. Signed transaction is submitted through RPC.
9. Backend verifies tx hash and escrow contract state.
10. Order moves to Payment Received / Pesanan Aman.
```

### 6.3 Contract Development Stack

Use:

```text
Rust
soroban-sdk
Stellar CLI
stellar-sdk for app transaction orchestration
Generated contract bindings if available
```

Contract modules:

```text
contracts/escrow/src/lib.rs
contracts/escrow/src/storage.rs
contracts/escrow/src/errors.rs
contracts/escrow/src/events.rs
contracts/escrow/src/test.rs
```

Contract core methods:

```rust
__constructor(admin, usdc_token)
create_order(order_id, buyer, seller, payout_recipient, amount, expires_at)
fund_order(order_id, buyer)
release_to_recipient(order_id, caller)
refund_to_buyer(order_id, admin)
cancel_order(order_id, caller)
get_order(order_id)
pause_contract(admin)
unpause_contract(admin)
propose_admin(admin, new_admin)
accept_admin(new_admin)
get_admin()
get_usdc_token()
```

Contract event types:

```text
escrow_created
escrow_funded
escrow_released
escrow_refunded
escrow_cancelled
contract_paused
contract_unpaused
```

### 6.4 Stellar App Service Modules

Recommended TypeScript service layout:

```text
/lib/stellar/config.ts
/lib/stellar/rpc.ts
/lib/stellar/wallet.ts
/lib/stellar/usdc.ts
/lib/stellar/escrow-client.ts
/lib/stellar/tx-verify.ts
/lib/stellar/explorer.ts
```

Responsibilities:

```text
config.ts         -> network passphrase, RPC URL, USDC contract, escrow contract
rpc.ts            -> RPC client wrapper
wallet.ts         -> wallet adapter helpers
usdc.ts           -> USDC trustline/balance helpers
escrow-client.ts  -> contract method wrapper
tx-verify.ts      -> verify tx success and expected event/status
explorer.ts       -> build Stellar Expert/Lab links
```

### 6.5 Network Strategy

```text
Development: Stellar testnet
Hackathon demo: testnet + optional mainnet proof if stable
Production: mainnet with production RPC provider and carefully managed contract upgrade strategy
```

Do not hardcode:

```text
USDC issuer
USDC SAC contract ID
Escrow contract ID
RPC URL
Network passphrase
Explorer URL
```

All must come from environment variables.

---

## 7. Buyer Payment and Binance Top-Up Stack

### 7.1 MVP Buyer Payment

```text
Buyer pays with USDC from Freighter/xBull.
Trustip verifies transaction and escrow contract state.
Payment is considered valid only after Stellar/Soroban confirmation.
```

### 7.2 Binance Top-Up Guide

Binance in MVP is not an API integration. It is a guided education and top-up helper.

Flow:

```text
Buyer has no USDC
-> Buyer opens Top Up via Binance guide
-> Trustip shows target wallet, target network, and amount
-> Buyer buys/withdraws USDC from Binance to Stellar wallet
-> Buyer returns to Trustip and pays with wallet
```

Trustip must show warnings:

```text
- Select Stellar network when withdrawing.
- Network support, minimum withdrawal, and fees follow Binance policy.
- Binance top-up is not the same as Trustip payment.
- Trustip only marks order paid after wallet payment to escrow succeeds.
```

### 7.3 Binance Pay Future Stack

Future feature only:

```text
Binance Pay Create Order API
Binance Pay webhook
Trustip Stellar Treasury
Escrow lock from treasury after payment confirmation
Treasury reconciliation worker
```

Not in MVP because it requires merchant/KYB/API approval and more treasury/compliance operations.

---

## 8. Seller Payout Multi-Route Stack

### 8.1 Payout Routes

| Route                                 | Stack                                             |               Status | Notes                                                                 |
| ------------------------------------- | ------------------------------------------------- | -------------------: | --------------------------------------------------------------------- |
| USDC wallet payout                    | Soroban release -> seller Stellar wallet          |             MVP Core | Cleanest payout route.                                                |
| XLM wallet payout                     | USDC release + route/swap strategy                |              Stretch | Can showcase Stellar asset routing, but needs rate/slippage handling. |
| MoneyGram cash-out/off-ramp           | Guided MoneyGram cash-out or integrated Ramps API | Stretch / Production | Seller off-ramp route, not buyer checkout.                            |
| Bank payout                           | Local partner/payment provider                    |               Future | Not MVP.                                                              |
| Binance Pay / Binance treasury payout | Binance API + treasury ops                        |               Future | Not MVP.                                                              |

### 8.2 MoneyGram Role

MoneyGram is used as part of seller payout/off-ramp strategy.

MVP-compatible option:

```text
Seller receives USDC in wallet
-> Trustip shows MoneyGram cash-out guide/status route
-> Seller uses a supported wallet/app or MoneyGram-compatible flow to cash out
```

Production option:

```text
Seller selects MoneyGram payout route
-> Trustip verifies seller payout profile/KYC requirements
-> Escrow releases USDC
-> MoneyGram Ramps integration starts cash-out/fiat payout flow
-> Backend records reference ID, status, fees, and final payout result
```

Payout service module:

```text
/lib/payout/routes.ts
/lib/payout/usdc-wallet.ts
/lib/payout/xlm-wallet.ts
/lib/payout/moneygram.ts
/lib/payout/payout-status.ts
```

Payout status enum:

```text
PAYOUT_PENDING
PAYOUT_PROCESSING
PAYOUT_COMPLETED
PAYOUT_FAILED
PAYOUT_CANCELLED
PAYOUT_REQUIRES_ACTION
```

---

## 9. API Stack

Route handler groups:

```text
/api/auth/*
/api/wallet/*
/api/seller/*
/api/checkout-links/*
/api/orders/*
/api/payments/*
/api/escrows/*
/api/shipments/*
/api/refunds/*
/api/payout-methods/*
/api/payouts/*
/api/trust-profile/*
/api/admin/*
/api/jobs/*
```

Validation:

```text
Zod schema per request body
Zod schema per response where useful
Never trust client-submitted amount/status
Always recalculate expected USDC amount server-side
Always verify Stellar tx hash against expected order and contract event
```

---

## 10. Security and Compliance Notes

Required controls:

```text
- Supabase RLS for buyer/seller/admin access.
- Private storage buckets for shipment/refund evidence.
- Signed URLs with expiration for evidence review.
- Service role key only on server/worker.
- Wallet private keys never handled by Trustip.
- Admin actions must be audit logged.
- Payout route changes must be logged.
- Escrow release/refund must be idempotent.
- Double release/refund must be impossible at contract level and backend level.
- Rate limit sensitive API endpoints.
- Validate file types and file sizes for evidence upload.
```

Production compliance note:

```text
If Trustip later integrates Binance Pay, MoneyGram Ramps API, bank payout, or fiat on-ramp, additional KYB/KYC, licensing, terms, and compliance review may be required.
```

---

## 11. Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_STELLAR_NETWORK=testnet
STELLAR_NETWORK=testnet

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stellar / Soroban
NEXT_PUBLIC_STELLAR_RPC_URL=
NEXT_PUBLIC_STELLAR_HORIZON_URL=
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=
NEXT_PUBLIC_USDC_ISSUER=
NEXT_PUBLIC_USDC_CONTRACT_ID=

# Server-only
TRUSTIP_SIGNER_STRATEGY=env
TRUSTIP_OPERATOR_SECRET_KEY=
TRUSTIP_ALLOW_MAINNET_OPERATOR=false
PAYMENT_ATTEMPT_SECRET=
TRUSTIP_CHECKOUT_TOKEN_SECRET=
TRUSTIP_WALLET_CHALLENGE_SECRET=
TRUSTIP_SEP10_JWT_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 12. Recommended Milestones

### Milestone 1 - Base App and UI System

```text
- Next.js app setup
- Tailwind + shadcn/Radix setup
- VOID design tokens
- Basic landing, checkout, seller dashboard shell
- Motion for React installed for micro-interactions
```

### Milestone 2 - Data and Auth

```text
- Supabase project
- ERD tables and RLS
- Auth login
- Seller profile and wallet connection storage
- Storage buckets for evidence
```

### Milestone 3 - Stellar Wallet Payment

```text
- Freighter connect
- xBull connect
- Wallet network validation
- USDC trustline/balance guidance
- Escrow funding transaction
- tx hash verification
```

### Milestone 4 - Soroban Escrow

```text
- Rust escrow contract
- create/fund/release/refund methods
- contract tests
- testnet deployment
- event sync worker
```

### Milestone 5 - Order, Shipment, Refund

```text
- Seller creates checkout link
- Buyer pays and tracks order
- Seller uploads resi/proof
- Buyer confirms or requests refund
- Admin review flow
```

### Milestone 6 - Seller Payout Multi-Route

```text
- USDC wallet payout core
- XLM route placeholder/stretch
- MoneyGram cash-out route as guided/off-ramp strategy
- Payout history and status
```

### Milestone 7 - Interactive Experience Polish

```text
- GSAP landing/status sections
- Lenis smooth scroll for public pages
- R3F VOID orb and escrow ring with lazy loading
- Reduced-motion fallback
- Performance pass
```

---

## 13. Final Recommendation

Use this stack as the final v1.1 implementation baseline:

```text
Frontend:
Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/Radix
Motion for React + GSAP/ScrollTrigger + Lenis + React Three Fiber for interactive web polish
Zustand + TanStack Query + React Hook Form + Zod

Backend:
Next.js Route Handlers + Supabase Postgres/Auth/Storage/RLS + Vercel Cron/Supabase Edge workers

Stellar:
Freighter + xBull + Stellar Wallets Kit/adapter layer
USDC on Stellar + Soroban Rust escrow + SAC/SEP-41 + Stellar RPC + Stellar CLI

Top-up and payout:
Binance guided top-up for buyer
USDC wallet payout for seller core
XLM payout and MoneyGram seller cash-out/off-ramp route as stretch/production path
Binance Pay future only
```

This stack lets Trustip compete as a real Stellar product while keeping the frontend premium, animated, and memorable.

---

## 14. References

- Next.js App Router documentation: https://nextjs.org/docs/app
- Stellar smart contracts documentation: https://developers.stellar.org/docs/build/smart-contracts
- Freighter wallet documentation: https://developers.stellar.org/docs/build/guides/freighter
- Stellar Asset Contract documentation: https://developers.stellar.org/docs/tokens/stellar-asset-contract
- MoneyGram Ramps on Stellar documentation: https://developers.stellar.org/docs/tools/ramps/moneygram
- Motion for React documentation: https://motion.dev/docs/react
- React Three Fiber documentation: https://r3f.docs.pmnd.rs/getting-started/introduction
- GSAP ScrollTrigger documentation: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Supabase Row Level Security documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
