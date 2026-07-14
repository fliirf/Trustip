# Trustip Code Architecture & Repository Structure Spec v1.1

**Product:** Trustip - Stellar-Native Protected Checkout  
**Version:** v1.1  
**Document type:** Code Architecture & Repository Structure Specification  
**Primary audience:** AI coding agents, frontend engineers, backend engineers, smart contract engineers  
**Status:** Implementation-ready draft

---

## 1. Purpose

This document defines how the Trustip codebase should be organized, how modules should be separated, and where each part of the system should live. It translates the approved product, ERD, tech stack, and API/Soroban documents into a code architecture that developers and AI agents can implement consistently.

The goal is to keep Trustip easy to build during the hackathon while still being clean enough to evolve into production.

---

## 2. Architecture Decision Summary

| Area            | Decision                                                       |
| --------------- | -------------------------------------------------------------- |
| Repository type | Monorepo                                                       |
| Package manager | pnpm workspace                                                 |
| Web app         | Next.js App Router, React, TypeScript                          |
| Backend/API     | Node.js runtime with TypeScript through Next.js Route Handlers |
| Database        | Supabase PostgreSQL, Supabase Auth, Supabase Storage, RLS      |
| Smart contract  | Rust + Soroban SDK                                             |
| Stellar client  | TypeScript helpers using Stellar SDK and Soroban RPC           |
| Wallet support  | Freighter + xBull through Stellar Wallets Kit                  |
| Buyer payment   | USDC on Stellar via native Stellar wallet                      |
| Buyer top-up    | Binance guide only; Binance Pay is future feature              |
| Seller payout   | USDC wallet, XLM wallet, MoneyGram cash-out/off-ramp route     |
| Workers         | TypeScript workers for escrow event indexing and payout sync   |
| UI direction    | Interactive premium web with route-based animation limits      |

---

## 3. Repository Type

Trustip should use a **monorepo** because the project contains multiple tightly connected parts:

- Next.js web app and API routes
- Shared UI components
- Shared validators and type definitions
- Stellar wallet and Soroban helpers
- Rust Soroban escrow contract
- Supabase database migrations and RLS policies
- Background workers and scripts
- Implementation docs and agent briefs

A monorepo keeps contract IDs, database types, API DTOs, and frontend models aligned.

---

## 4. Recommended Repository Structure

```txt
trustip/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/
│       │   ├── (buyer)/
│       │   ├── (seller)/
│       │   ├── (admin)/
│       │   ├── api/
│       │   ├── layout.tsx
│       │   └── globals.css
│       │
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── motion/
│       │   └── three/
│       │
│       ├── features/
│       │   ├── auth/
│       │   ├── checkout/
│       │   ├── wallet/
│       │   ├── payments/
│       │   ├── orders/
│       │   ├── escrow/
│       │   ├── shipments/
│       │   ├── refunds/
│       │   ├── payouts/
│       │   ├── trust-profile/
│       │   └── admin/
│       │
│       ├── lib/
│       ├── hooks/
│       ├── config/
│       └── middleware.ts
│
├── packages/
│   ├── ui/
│   ├── database/
│   ├── stellar/
│   ├── validators/
│   ├── config/
│   └── types/
│
├── contracts/
│   └── escrow/
│       ├── src/
│       │   └── lib.rs
│       ├── test/
│       ├── Cargo.toml
│       └── README.md
│
├── workers/
│   ├── escrow-event-indexer/
│   ├── payout-sync/
│   └── refund-review-sync/
│
├── supabase/
│   ├── migrations/
│   ├── policies/
│   ├── seed.sql
│   └── types.ts
│
├── scripts/
│   ├── deploy-contract.ts
│   ├── seed-db.ts
│   ├── generate-types.ts
│   └── verify-env.ts
│
├── docs/
│   ├── overview/
│   ├── prd/
│   ├── erd/
│   ├── tech-stack/
│   ├── api-contract/
│   └── implementation/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
└── README.md
```

---

## 5. High-Level Code Architecture

Trustip should follow layered architecture. UI components must not directly contain database queries, contract orchestration, or payout business logic.

```txt
UI Layer
  ↓
Feature Layer
  ↓
Service Layer
  ↓
Data Access Layer / Blockchain Client Layer
  ↓
Supabase PostgreSQL / Stellar RPC / Soroban Contract
```

### 5.1 Layer Responsibilities

| Layer                   | Responsibility                                      | Example location               |
| ----------------------- | --------------------------------------------------- | ------------------------------ |
| UI Layer                | Presentational components, layout, animation        | `apps/web/components`          |
| Feature Layer           | Feature-specific screens, hooks, forms, containers  | `apps/web/features/*`          |
| Service Layer           | Business logic and orchestration                    | `apps/web/features/*/services` |
| API Layer               | HTTP request handlers and server-only orchestration | `apps/web/app/api/*`           |
| Data Access Layer       | Supabase queries and storage access                 | `packages/database`            |
| Blockchain Client Layer | Wallet, Stellar SDK, Soroban RPC helpers            | `packages/stellar`             |
| Contract Layer          | Rust Soroban escrow logic                           | `contracts/escrow`             |
| Worker Layer            | Background sync and event indexing                  | `workers/*`                    |

---

## 6. Frontend Route Architecture

The frontend must separate buyer, seller, admin, and public routes using Next.js route groups.

```txt
apps/web/app/
├── (public)/
│   ├── page.tsx
│   ├── how-it-works/page.tsx
│   └── trust-profile/[sellerSlug]/page.tsx
│
├── (buyer)/
│   ├── checkout/[checkoutSlug]/page.tsx
│   ├── order/[orderId]/page.tsx
│   └── refund/[orderId]/page.tsx
│
├── (seller)/
│   ├── seller/dashboard/page.tsx
│   ├── seller/onboarding/page.tsx
│   ├── seller/checkout-links/new/page.tsx
│   ├── seller/orders/[orderId]/page.tsx
│   ├── seller/payouts/page.tsx
│   └── seller/settings/payout-methods/page.tsx
│
├── (admin)/
│   ├── admin/dashboard/page.tsx
│   ├── admin/orders/[orderId]/page.tsx
│   ├── admin/refunds/[refundId]/page.tsx
│   └── admin/payouts/[payoutId]/page.tsx
│
└── api/
```

### 6.1 Frontend Rules

- Checkout and payment pages must be fast, lightweight, and low-risk.
- Heavy 3D scenes must be lazy-loaded and avoided on payment-critical paths.
- Business logic must not live in UI components.
- Wallet transaction preparation should come from backend/API or service helpers, then be signed by the wallet.
- Order status and payment status should be rendered from backend/database state, not only from local component state.

---

## 7. Feature Module Structure

Each feature should be structured consistently.

```txt
features/checkout/
├── components/
├── hooks/
├── services/
├── schemas/
├── types.ts
└── index.ts
```

### 7.1 Feature Modules

| Feature         | Purpose                                                       |
| --------------- | ------------------------------------------------------------- |
| `auth`          | Supabase auth, wallet login, role resolution                  |
| `checkout`      | Buyer checkout link page and order creation                   |
| `wallet`        | Freighter/xBull connection and signing state                  |
| `payments`      | USDC payment preparation, submission, sync                    |
| `orders`        | Order detail, status timeline, buyer confirmation             |
| `escrow`        | Escrow status, transaction history, release/refund UI helpers |
| `shipments`     | Seller shipment update, resi, delivery proof                  |
| `refunds`       | Buyer refund request, seller response, admin resolution       |
| `payouts`       | Seller payout method and payout request handling              |
| `trust-profile` | Seller reputation metrics and trust events                    |
| `admin`         | Admin review, operations, dispute/refund resolution           |

---

## 8. Backend/API Route Structure

Next.js Route Handlers should be used as the backend/API layer. API routes must validate input, check auth/role permissions, call service functions, and return typed JSON responses.

```txt
apps/web/app/api/
├── auth/
│   └── wallet/route.ts
│
├── seller/
│   ├── profile/route.ts
│   ├── checkout-links/route.ts
│   ├── payout-methods/route.ts
│   └── payouts/route.ts
│
├── checkout-links/
│   └── [slug]/route.ts
│
├── orders/
│   ├── route.ts
│   └── [orderId]/
│       ├── route.ts
│       ├── confirm/route.ts
│       ├── shipment/route.ts
│       └── cancel/route.ts
│
├── payments/
│   ├── prepare/route.ts
│   ├── submit/route.ts
│   └── sync/route.ts
│
├── escrows/
│   ├── [orderId]/route.ts
│   ├── release/route.ts
│   └── refund/route.ts
│
├── refunds/
│   ├── route.ts
│   └── [refundId]/
│       ├── route.ts
│       ├── evidence/route.ts
│       └── seller-response/route.ts
│
├── payouts/
│   ├── route.ts
│   └── [payoutId]/
│       ├── route.ts
│       ├── execute/route.ts
│       └── sync/route.ts
│
└── admin/
    ├── orders/route.ts
    ├── refunds/[refundId]/resolve/route.ts
    └── payouts/[payoutId]/resolve/route.ts
```

### 8.1 API Rules

- All mutating routes must validate body input with Zod.
- All protected routes must check Supabase session and role.
- Admin routes must check explicit admin role.
- Payment and payout routes must be idempotent.
- External transaction hashes must be unique and stored in `blockchain_transactions`.
- API responses must use stable error codes, not random error messages.

---

## 9. Database Package Architecture

`packages/database` should contain typed Supabase clients, query helpers, and database type definitions.

```txt
packages/database/
├── src/
│   ├── client.ts
│   ├── admin-client.ts
│   ├── types.ts
│   ├── queries/
│   │   ├── users.ts
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   ├── escrows.ts
│   │   ├── refunds.ts
│   │   ├── payouts.ts
│   │   └── trust-profile.ts
│   └── index.ts
└── package.json
```

### 9.1 Database Rules

- Client-side code may only use safe public Supabase clients.
- Service-role Supabase client must only be used server-side.
- RLS must remain enabled for exposed tables.
- File uploads for refund/shipment evidence must use Supabase Storage with role-based access.
- Business state must be persisted in Supabase, not only inferred from RPC at runtime.

---

## 10. Stellar Package Architecture

`packages/stellar` centralizes all wallet, transaction, and Soroban helper logic.

```txt
packages/stellar/
├── src/
│   ├── config.ts
│   ├── network.ts
│   ├── wallets/
│   │   ├── wallets-kit.ts
│   │   ├── freighter.ts
│   │   ├── xbull.ts
│   │   └── types.ts
│   │
│   ├── assets/
│   │   ├── usdc.ts
│   │   ├── xlm.ts
│   │   └── trustline.ts
│   │
│   ├── soroban/
│   │   ├── rpc.ts
│   │   ├── escrow-client.ts
│   │   ├── transactions.ts
│   │   ├── events.ts
│   │   └── errors.ts
│   │
│   ├── explorer/
│   │   └── links.ts
│   │
│   └── index.ts
└── package.json
```

### 10.1 Stellar Rules

- Never hardcode network, contract ID, issuer, or asset ID directly inside UI components.
- Keep Stellar config in environment variables and typed config modules.
- All transaction XDR preparation should use shared helper functions.
- All signed transactions must be submitted through a controlled flow.
- Store tx hash, ledger number, operation type, and status in Supabase.
- Stellar RPC must not be treated as the long-term app history database.

---

## 11. Soroban Contract Architecture

The Soroban escrow contract must live separately under `contracts/escrow` and be written in Rust.

```txt
contracts/escrow/
├── src/
│   ├── lib.rs
│   ├── storage.rs
│   ├── errors.rs
│   ├── events.rs
│   └── types.rs
├── test/
│   ├── escrow_flow.rs
│   ├── release_flow.rs
│   └── refund_flow.rs
├── Cargo.toml
└── README.md
```

### 11.1 Contract Responsibilities

The contract should only handle on-chain fund protection logic:

- Initialize contract admin and asset contract ID
- Create/register escrow order reference
- Fund escrow with USDC
- Release USDC to seller
- Refund USDC to buyer
- Prevent double release/refund
- Pause contract in emergency
- Emit events for backend indexing

### 11.2 Contract Non-Responsibilities

The contract should not handle:

- Product catalog management
- Seller profile details
- Shipment tracking
- Refund evidence files
- Admin dashboard logic
- MoneyGram payout integration
- Binance top-up guide
- Buyer-facing copywriting

Those belong in backend/database/UI.

---

## 12. Worker Architecture

Workers are needed because the application must not rely only on request-response routes for blockchain sync and payout status updates.

```txt
workers/
├── escrow-event-indexer/
│   ├── src/index.ts
│   ├── src/syncEscrowEvents.ts
│   └── package.json
│
├── payout-sync/
│   ├── src/index.ts
│   ├── src/syncUsdcPayout.ts
│   ├── src/syncXlmPayout.ts
│   ├── src/syncMoneyGramRoute.ts
│   └── package.json
│
└── refund-review-sync/
    ├── src/index.ts
    └── package.json
```

### 12.1 Worker Responsibilities

| Worker               | Responsibility                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escrow event indexer | Pull contract events/tx status, write to `escrow_events` and `blockchain_transactions`, and reconcile order status when payment/escrow status changes |
| Payout sync          | Sync seller payout route status for USDC, XLM, and MoneyGram route, and reconcile order status when payout status changes                             |
| Refund review sync   | Reconcile refund request and admin dispute resolution states and timers                                                                               |

### 12.2 Worker Rules

- Workers must be idempotent.
- Workers must checkpoint last synced ledger or cursor.
- Workers must not create duplicate payout records.
- Workers must not execute release/refund unless the order state allows it.
- Workers must write structured logs for every sync cycle.

---

## 13. Payout Module Architecture

Seller payout is multi-route. The payout module must separate payout method selection from payout execution.

```txt
features/payouts/
├── components/
│   ├── PayoutMethodCard.tsx
│   ├── PayoutRouteBadge.tsx
│   └── PayoutStatusTimeline.tsx
├── hooks/
│   └── useSellerPayouts.ts
├── services/
│   ├── createPayoutRequest.ts
│   ├── executeUsdcPayout.ts
│   ├── executeXlmPayout.ts
│   └── prepareMoneyGramCashout.ts
├── schemas/
│   └── payout.schema.ts
└── types.ts
```

### 13.1 Payout Route Rules

| Route               | MVP level      | Implementation note                                                            |
| ------------------- | -------------- | ------------------------------------------------------------------------------ |
| `USDC_WALLET`       | Core           | Release USDC to seller Stellar wallet                                          |
| `XLM_WALLET`        | Stretch        | Convert/route USDC to XLM if implemented; otherwise mark as pending stretch    |
| `MONEYGRAM_CASHOUT` | Off-ramp route | Guided or integrated cash-out route; backend stores route status and reference |

MoneyGram is not a buyer payment method. It is a seller payout/off-ramp route.

---

## 14. Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stellar network
NEXT_PUBLIC_STELLAR_NETWORK=testnet
STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=
NEXT_PUBLIC_STELLAR_HORIZON_URL=

# Stellar assets and contracts
NEXT_PUBLIC_USDC_ISSUER=
NEXT_PUBLIC_USDC_CONTRACT_ID=
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=

# Server-only signer and application secrets
TRUSTIP_SIGNER_STRATEGY=env
TRUSTIP_OPERATOR_SECRET_KEY=
TRUSTIP_ALLOW_MAINNET_OPERATOR=false
PAYMENT_ATTEMPT_SECRET=
TRUSTIP_CHECKOUT_TOKEN_SECRET=
TRUSTIP_WALLET_CHALLENGE_SECRET=
TRUSTIP_SEP10_JWT_SECRET=

# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Worker/indexer
INDEXER_POLL_MS=30000
INDEXER_RECONCILE_EVERY=4
INDEXER_START_LOOKBACK=17280
TRUSTIP_PAYOUT_WORKER_ENABLED=false
TRUSTIP_REFUND_WORKER_ENABLED=false
```

### 14.1 Environment Rules

- Never expose service role keys in frontend code.
- Never expose secret keys in `NEXT_PUBLIC_*` variables.
- Contract IDs and asset IDs must be environment-driven.
- Testnet and mainnet configs must be clearly separated.

---

## 15. Naming Conventions

| Item                 | Convention                  | Example                   |
| -------------------- | --------------------------- | ------------------------- |
| React component      | PascalCase                  | `CheckoutSummaryCard.tsx` |
| Hook                 | camelCase with `use` prefix | `useWalletConnection.ts`  |
| Service function     | camelCase verb phrase       | `prepareEscrowPayment.ts` |
| API folder           | kebab-case or route segment | `payout-methods`          |
| DB table             | snake_case plural           | `payout_requests`         |
| Enum value           | UPPER_SNAKE_CASE            | `MONEYGRAM_CASHOUT`       |
| Rust function        | snake_case                  | `release_to_recipient`    |
| Contract event       | snake_case                  | `escrow_funded`           |
| Environment variable | UPPER_SNAKE_CASE            | `NEXT_PUBLIC_STELLAR_RPC_URL` |

---

## 16. Module Boundary Rules

### 16.1 UI Must Not

- Query Supabase service role directly
- Call Stellar RPC directly from random components
- Hold escrow business logic
- Decide whether release/refund is valid
- Store sensitive secrets

### 16.2 Services Must

- Validate state transitions
- Call shared database helpers
- Call shared Stellar helpers
- Return typed results
- Be testable without UI

### 16.3 API Routes Must

- Authenticate user
- Authorize role and resource ownership
- Validate payload
- Call service layer
- Return stable JSON response
- Log security-relevant operations

### 16.4 Contract Must

- Enforce fund lock/release/refund rules
- Prevent duplicate execution
- Emit events
- Avoid off-chain business concerns

---

## 17. Animation and Interactive Web Boundaries

Trustip has a premium VOID-style UI, but performance must remain strong.

| Route type        | Allowed animation stack             | Rule                         |
| ----------------- | ----------------------------------- | ---------------------------- |
| Landing page      | Motion, GSAP, Lenis, lazy R3F       | Full cinematic allowed       |
| Checkout page     | Motion only                         | No heavy 3D blocking payment |
| Order status page | Motion, lightweight canvas optional | Keep status timeline smooth  |
| Seller dashboard  | Motion micro-interactions           | No Lenis or heavy 3D         |
| Admin dashboard   | Minimal animation                   | Prioritize clarity and speed |

### 17.1 Performance Rules

- Lazy-load React Three Fiber scenes.
- Use dynamic imports for heavy animation modules.
- Do not block payment flow with 3D assets.
- Respect `prefers-reduced-motion`.
- Keep wallet/payment pages below strict bundle budget.

---

## 18. Implementation Sequence

Recommended development order:

1. Initialize monorepo and base Next.js app
2. Setup Supabase schema, auth, storage, and RLS
3. Implement seller onboarding and checkout link creation
4. Implement wallet connection with Freighter and xBull
5. Implement Soroban escrow contract in Rust
6. Deploy contract to testnet and save contract config
7. Implement payment prepare/submit/sync API
8. Implement buyer checkout and order status page
9. Implement seller order management and shipment proof
10. Implement buyer confirmation and refund request
11. Implement release/refund orchestration
12. Implement Trust Profile updates
13. Implement payout method settings and USDC payout
14. Add XLM payout and MoneyGram route as stretch/off-ramp route
15. Add indexer and payout sync workers
16. Add QA, logs, and final demo polish

---

## 19. AI Agent Coding Rules

AI agents must follow these rules strictly.

### 19.1 Do

- Use the approved monorepo structure.
- Use TypeScript strict mode.
- Use Rust for Soroban contract.
- Use Supabase PostgreSQL as the source of app state.
- Use Stellar Wallets Kit, Freighter, and xBull for wallet flows.
- Use USDC on Stellar as buyer payment asset.
- Use Soroban escrow for lock/release/refund.
- Store all important tx hashes in database.
- Treat MoneyGram as seller payout/off-ramp route.
- Keep buyer-facing labels simple.

### 19.2 Do Not

- Do not add QRIS.
- Do not add bank transfer buyer payment.
- Do not add internal fiat top-up.
- Do not claim automatic Rupiah to USDC conversion in MVP.
- Do not use MoneyGram as primary buyer checkout.
- Do not expose Stellar/Soroban technical terms in primary buyer UI.
- Do not store secret keys in frontend.
- Do not use Stellar RPC as long-term historical database.
- Do not implement escrow only in database.
- Do not create buyer-facing simulate payment buttons.

---

## 20. Acceptance Criteria

The code architecture is considered valid if:

- Repo uses a monorepo structure with clear app/package/contract/worker boundaries.
- Frontend, backend, database, Stellar helpers, and contract code are not mixed randomly.
- Soroban contract is written in Rust and stored under `contracts/escrow`.
- Backend API runs on Node.js with TypeScript via Next.js Route Handlers.
- Supabase stores order/payment/escrow/payout application state.
- Stellar helper package centralizes wallet, asset, transaction, and RPC logic.
- Workers/indexers persist blockchain events and payout sync status.
- MoneyGram route exists under seller payout/off-ramp architecture, not buyer payment.
- AI agents can implement features without inventing old discarded scope.

---

## 21. Final Architecture Summary

Trustip should be implemented as a monorepo with a Next.js web app, Node.js + TypeScript API routes, Supabase database/storage/auth, Rust Soroban escrow contract, shared Stellar helper package, and background workers for escrow event indexing and payout sync.

The application state lives in Supabase. Fund protection lives in Soroban. Wallet signing happens through Freighter and xBull. Buyer payment is USDC on Stellar. Binance is a buyer top-up guide. Seller payout supports USDC wallet, XLM wallet, and MoneyGram cash-out/off-ramp route.
