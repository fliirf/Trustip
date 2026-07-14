# Trustip Agent Implementation Guide v1.1

Step-by-step coding instructions for AI agents implementing Trustip v1.1 from repository setup to mainnet readiness.

**Product version:** Trustip v1.1  
**Implementation mode:** AI-agent-assisted development  
**Core scope:** Wallet Stellar Native payment, Soroban USDC escrow, Binance top-up guide, seller payout via USDC/XLM/MoneyGram route

| Item                  | Decision                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Product Version       | Trustip v1.1                                                                                     |
| Primary Buyer Payment | USDC on Stellar through Freighter and xBull                                                      |
| Buyer Top-up Support  | Binance guide only; no internal auto-convert from Rupiah to USDC                                 |
| Escrow Core           | Rust Soroban contract: create/fund/lock/release/refund                                           |
| Seller Payout Routes  | USDC wallet, XLM wallet route, MoneyGram cash-out/off-ramp route                                 |
| Forbidden MVP Scope   | QRIS, bank transfer checkout, internal Add Balance, fake simulate payment, buyer-facing demo ops |

# 1. Purpose of This Guide

This guide tells AI agents exactly how to implement Trustip v1.1 without drifting from the approved product, database, API, Stellar, and security scope. It is not a brainstorming document. It is an execution document for coding agents working inside the repository.

Every implementation task must follow the approved v1.1 documents. If a generated implementation conflicts with these rules, the v1.1 documents win.

# 2. Required Context Before Any Agent Writes Code

Before editing the repository, the agent must be given these documents or their relevant sections:

- Trustip Product Overview v1.1 - product and ecosystem positioning.
- Trustip PRD v1.1 - product scope, user flows, MVP boundaries, and non-MVP scope.
- Trustip ERD Spec v1.1 - database tables, enums, relationships, and payout model.
- Trustip Tech Stack Spec v1.1 - approved frontend, backend, database, Stellar, Soroban, and animation stack.
- Trustip API & Soroban Contract Spec v1.1 - endpoint contract, escrow methods, event sync, and payout routes.
- Trustip Security & Risk Spec v1.1 - security guardrails and mainnet risk controls.
- Trustip Deployment & Environment Setup Guide v1.1 - local, testnet, and mainnet environment setup.

# 3. Non-Negotiable Product Rules

These rules must be treated as hard constraints. An agent must not implement features outside this scope unless explicitly instructed by the project owner.

| Area                    | Rule                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Buyer Payment           | Implement only Wallet Stellar Native payment using USDC. Support Freighter and xBull.                                                  |
| Top-up                  | Implement Binance as a guide/education flow only. Do not implement Binance Pay in MVP.                                                 |
| Escrow                  | Use Soroban Rust contract for USDC lock, release, and refund. Do not fake escrow in database.                                          |
| Seller Payout           | Support payout method model for USDC wallet, XLM wallet route, and MoneyGram cash-out/off-ramp route.                                  |
| MoneyGram               | MoneyGram is not a buyer checkout rail. It is a seller payout/off-ramp route.                                                          |
| Forbidden Payment Rails | Do not add QRIS, bank transfer checkout, VA, payment gateway, Add Balance, or internal Rupiah-to-USDC conversion.                      |
| Demo Behavior           | No buyer-facing simulate payment button. No fake payment success. Testnet is allowed, but it must still use real Stellar transactions. |

# 4. Recommended AI Agent Focus

| Agent                       | Role                           | Focus                                                                                                                     |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Claude Code                 | Primary coding agent           | Repo setup, backend/API, Supabase, Soroban Rust contract, wallet integration, workers, debugging, mainnet readiness.      |
| Google AntiGravity / Gemini | Visual + long-context reviewer | Interactive UI, animation direction, large-doc consistency review, screenshot review, frontend UX implementation support. |
| OpenCode Free               | Cheap worker                   | UI components, small refactors, dummy data, test skeletons, markdown cleanup, non-critical helper functions.              |

Critical implementation must be reviewed by a stronger model and manually checked before commit. OpenCode Free must not be the final authority for payment, escrow, payout, RLS, or mainnet settings.

# 5. Criticality Map

| Level    | Examples                                                                                                                     | Agent Rule                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Critical | Soroban escrow, wallet signing, payment submit/sync, Supabase RLS, payout execution, admin refund resolution, mainnet config | Use Claude Code. Require manual review. Run tests.     |
| High     | Backend order/payment/refund APIs, worker/indexer, evidence upload, status transitions                                       | Use Claude Code. Review against ERD/API/Security docs. |
| Medium   | Seller dashboard, buyer order status, Trust Profile update, payout settings UI                                               | AntiGravity/OpenCode can implement; Claude reviews.    |
| Low      | Landing page sections, visual copy, empty states, icons, dummy data                                                          | OpenCode/AntiGravity are enough; quick review only.    |

# 6. Implementation Order

Implement in this order. Do not start visual polish before the data model, contract interface, and transaction flow are stable.

1. Initialize monorepo and base tooling.
1. Create shared constants, enums, validators, and environment schema.
1. Implement Supabase migrations, storage buckets, and initial RLS policies.
1. Implement Rust Soroban escrow contract and local/testnet deployment scripts.
1. Implement Stellar helper package: wallet, network, USDC asset, RPC, XDR, tx sync.
1. Implement backend API: auth/profile, checkout links, orders, payments, escrow, shipment, refund, payout, admin.
1. Implement worker/indexer for escrow events, payment sync, payout status sync, and retry handling.
1. Implement buyer UI: checkout, wallet connect, payment review, Binance guide, order status, refund request.
1. Implement seller UI: onboarding, checkout link creation, order handling, shipment proof, payout settings/history.
1. Implement admin UI: refund review, evidence review, forced release/refund, payout monitor, trust profile actions.
1. Run QA checklist on local, testnet, and mainnet-readiness modes.

# 7. Repository Structure Rules

The agent must preserve the approved monorepo structure. Do not scatter Stellar, database, or business logic inside UI components.

```
trustip/
├── apps/
│   └── web/                    # Next.js app + route handlers
├── packages/
│   ├── ui/                     # shared UI primitives
│   ├── database/               # Supabase types, queries, enums
│   ├── stellar/                # wallet, RPC, Soroban, USDC helpers
│   ├── validators/             # Zod schemas and shared validation
│   └── config/                 # env, constants, network config
├── contracts/
│   └── escrow/                 # Rust Soroban contract
├── workers/
│   ├── escrow-event-indexer/   # contract event sync
│   ├── payout-sync/            # payout route status sync
│   └── refund-review-sync/     # refund review sync
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── policies/
├── scripts/
│   ├── deploy-contract.ts
│   ├── generate-types.ts
│   └── seed.ts
└── docs/
```

# 8. Module-by-Module Execution Plan

| Module                | Scope                                                          | Main Agent                    | Acceptance Gate                                                     |
| --------------------- | -------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| M0 - Foundation       | Create repo, packages, lint/typecheck, env schema.             | Claude Code                   | Build passes; env validation exists; no product feature yet.        |
| M1 - Database         | Create Supabase schema, enums, migrations, RLS draft.          | Claude Code                   | Tables match ERD v1.1; RLS enabled; generated types committed.      |
| M2 - Soroban Contract | Rust escrow contract with events and auth checks.              | Claude Code                   | Contract tests pass; double release/refund blocked; events emitted. |
| M3 - Stellar Package  | Wallet, RPC, USDC, XDR, explorer links, contract client.       | Claude Code                   | Freighter/xBull connect; network guard; contract invoke prepared.   |
| M4 - Backend API      | Checkout, orders, payment, escrow, refund, payout APIs.        | Claude Code                   | Endpoint payloads match API Spec v1.1; validation with Zod.         |
| M5 - Workers          | Index escrow events, sync payment status, retry payout sync.   | Claude Code                   | Events stored in Supabase; no reliance on RPC as long-term history. |
| M6 - Buyer UI         | Checkout, wallet payment, Binance guide, order status, refund. | AntiGravity/OpenCode + review | Mobile-friendly; no QRIS/bank/add balance; tx hash visible.         |
| M7 - Seller UI        | Seller dashboard, orders, shipment proof, payout settings.     | AntiGravity/OpenCode + review | USDC/XLM/MoneyGram payout options represented correctly.            |
| M8 - Admin UI         | Refund review, evidence, release/refund, payout monitor.       | Claude Code                   | Admin-only protected actions; audit log created.                    |
| M9 - QA/Mainnet       | Testnet end-to-end, security review, deployment checklist.     | Claude Code + manual          | No critical QA failures; mainnet env separated.                     |

# 9. Frontend Implementation Rules

- Use Next.js App Router, React, TypeScript strict mode, Tailwind, shadcn/Radix, and route-level code splitting.
- Use Motion for checkout/status UI animation. Use GSAP/Lenis only for landing/storytelling pages. Use React Three Fiber only for lazy-loaded VOID scenes.
- Do not import heavy animation or 3D packages into checkout/payment-critical routes unless lazy-loaded.
- Keep business logic out of React components. Components call feature hooks/services only.
- Every payment UI must have loading, wallet rejected, wrong network, insufficient balance, missing trustline, and tx failed states.
- Use buyer-friendly copy: Bayar, Pesanan Aman, Pembayaran Diterima, Ajukan Refund, Bukti Transaksi, Trust Profile.

# 10. Backend/API Implementation Rules

- Backend runs on Node.js 24 LTS with TypeScript through Next.js Route Handlers.
- All request bodies must be validated using shared Zod schemas from packages/validators.
- Backend may prepare transactions and verify submitted transaction hashes, but it must not sign buyer transactions.
- All status transitions must match ERD/API enums. Do not create new statuses casually.
- Use service modules for business logic. Route handlers should remain thin.
- Admin endpoints must require admin role and must write admin audit records.

# 11. Soroban Contract Rules

The Soroban contract is the most critical component. The agent must treat it as production-sensitive even during hackathon/testnet development.

- Contract language is Rust using Soroban SDK.
- The contract must handle USDC via Stellar Asset Contract / SEP-41 interface.
- Core methods: `__constructor`, create_order, fund_order, release_to_recipient, refund_to_buyer, cancel_order, pause_contract, unpause_contract, propose_admin, accept_admin, get_admin, get_usdc_token, get_order. `initialize` is a legacy non-mutating guard.
- Prevent double release, double refund, unauthorized release/refund, wrong amount funding, and funding after cancellation.
- Emit events for escrow created, funded, released, refunded, cancelled, paused, and unpaused.
- Do not put off-chain shipment/refund evidence into the contract. Store evidence in Supabase and keep hashes/references if needed.

```
// Contract intent only - final code must be written in Rust Soroban SDK
__constructor(admin, usdc_contract)
create_order(order_id, buyer, seller, payout_recipient, amount, expires_at)
fund_order(order_id, buyer)
release_to_recipient(order_id, caller)
refund_to_buyer(order_id, admin)
cancel_order(order_id, caller)
pause_contract(admin)
unpause_contract(admin)
propose_admin(admin, new_admin)
accept_admin(new_admin)
get_admin()
get_usdc_token()
get_order(order_id)
```

# 12. Stellar Wallet and Payment Rules

- Support Freighter and xBull as MVP wallets, preferably through Stellar Wallets Kit.
- Guard network: testnet and mainnet must be explicitly separated.
- Check wallet address, selected network, USDC trustline/asset availability, XLM fee balance, and transaction result.
- Store transaction hash, ledger, network, source wallet, asset code, amount, and sync status in Supabase.
- Show explorer link in Bukti Transaksi, but do not expose overwhelming blockchain jargon as primary buyer copy.

# 13. Seller Payout Route Rules

Seller payout is multi-route in Trustip v1.1. The contract releases USDC, while backend orchestration represents payout routes and off-ramp status.

| Route             | Priority              | Implementation Meaning                                                      |
| ----------------- | --------------------- | --------------------------------------------------------------------------- |
| USDC_WALLET       | MVP core              | Release USDC to seller Stellar wallet.                                      |
| XLM_WALLET        | Stretch               | Route/convert USDC to XLM if enabled; otherwise store as planned route.     |
| MONEYGRAM_CASHOUT | Seller off-ramp route | Guided or integrated MoneyGram cash-out/off-ramp route. Not buyer checkout. |

- Do not represent MoneyGram as a buyer payment method.
- Payout requests must have status, route, amount, destination, fee estimate, reference ID, and audit trail.
- MoneyGram integrated API is production/future unless valid access is available. MVP may store guided route status and operational reference.

# 14. Supabase and RLS Rules

- Enable RLS for all public tables exposed to the frontend.
- Buyer can read only their own orders, payment status, refund requests, and evidence.
- Seller can read only their own seller profile, checkout links, orders, shipments, payout methods, and payout requests.
- Admin-only actions must never be exposed through client-side role checks only; enforce server-side and database-side restrictions.
- Evidence files must be stored with access controls; public buckets are forbidden for refund evidence.

# 15. Worker and Indexer Rules

- Stellar RPC is not the long-term historical database. Store important events in Supabase.
- Workers must sync escrow events, transaction status, failed/retry states, payout route status, and stale pending payments.
- Workers must be idempotent. Re-running the same sync must not duplicate payment, release, refund, or payout records.
- Every worker must log last processed cursor/ledger/time and failure reason.

# 16. Standard Agent Prompt Templates

Use small, bounded prompts. Never ask an agent to build the whole product in one run.

```
Implement only [MODULE_NAME] for Trustip v1.1.
Use these docs as source of truth: PRD v1.1, ERD v1.1, API & Soroban Spec v1.1, Tech Stack v1.1, Security Spec v1.1.
Scope allowed: [EXACT_SCOPE].
Files allowed to edit: [FILE_OR_FOLDER_LIST].
Do not implement QRIS, bank transfer checkout, Add Balance, auto Rupiah-to-USDC conversion, fake payment simulation, or buyer-facing demo ops.
For critical logic, add tests and explain the status transitions you implemented.
Return a concise summary of changed files and remaining risks.
```

Review prompt for generated diffs:

```
Review this diff against Trustip v1.1 docs.
Focus on: scope drift, security issue, status mismatch, RLS weakness, wallet signing mistake, Soroban escrow bug, payout route confusion, and mainnet risk.
Classify findings as CRITICAL, HIGH, MEDIUM, or LOW.
Do not suggest new product features unless they fix a documented bug.
```

# 17. Forbidden Agent Behaviors

- Do not invent new payment rails or add QRIS/bank transfer checkout.
- Do not create internal wallet top-up or Add Balance flows.
- Do not fake successful payment in buyer UI.
- Do not hardcode contract IDs, USDC asset addresses, RPC URLs, admin wallets, or private keys.
- Do not store private keys in the frontend, repository, or Supabase.
- Do not skip RLS for speed.
- Do not use Stellar RPC as the only record of payment history.
- Do not let seller release their own escrow without buyer confirmation or admin decision.
- Do not let buyer refund after order is completed without admin exception handling.

# 18. Acceptance Criteria by Critical Flow

| Flow              | Acceptance Criteria                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Wallet Connect    | Freighter and xBull connect; wrong network blocked; disconnected state handled.                            |
| USDC Payment      | Buyer signs transaction; payment tx hash stored; escrow funded status syncs from chain.                    |
| Escrow Release    | Only valid completion/admin path releases; seller receives correct amount; double release blocked.         |
| Refund            | Refund only via valid admin/refund path; buyer receives correct amount; double refund blocked.             |
| MoneyGram Route   | Seller can select route; payout record stores route/status/reference; not shown as buyer payment.          |
| RLS               | Buyer/seller cannot access each other records; admin actions protected and audited.                        |
| Mainnet Readiness | Network/env separated; no testnet IDs in mainnet env; no fake payment buttons; contract IDs not hardcoded. |

# 19. Commit and Review Workflow

1. Create a small task brief from the relevant v1.1 docs.
1. Let the selected AI agent implement only that task.
1. Run format, lint, typecheck, tests, and relevant manual flow checks.
1. Review diff with a stronger model for critical modules.
1. Fix issues before moving to the next module.
1. Do not batch critical payment/escrow/RLS changes with visual/UI-only changes.

# 20. Final Mainnet Gate

Before Trustip v1.1 is treated as mainnet-ready, the implementation must pass these gates:

- Soroban contract deployed and verified on intended network.
- USDC asset/contract configuration verified for the network.
- Freighter/xBull network guard works.
- No demo payment, fake success, or buyer-facing simulation exists.
- Escrow funded/release/refund flows tested with real network transactions.
- Supabase RLS enabled and tested with buyer, seller, and admin roles.
- Worker/indexer can recover from missed runs and duplicate sync safely.
- Admin emergency pause/override path documented and protected.
- MoneyGram route clearly marked as seller payout/off-ramp route.
