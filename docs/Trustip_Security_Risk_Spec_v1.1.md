# Trustip Security & Risk Spec v1.1

**Document version:** v1.1  
**Product baseline:** Trustip v1.1  
**Document purpose:** Define security controls, risk ownership, test obligations, and release gates for Trustip before testnet/mainnet deployment.

## 1. Product Security Scope

Trustip v1.1 is a Stellar-native protected checkout application. Buyer payment is USDC on Stellar via Freighter/xBull. Binance is a guided top-up path only, not an internal Trustip payment gateway. Escrow is handled by a Rust Soroban smart contract. Seller payout supports USDC wallet, XLM wallet route, and MoneyGram cash-out/off-ramp route. The web/backend layer uses Node.js runtime with TypeScript, Next.js Route Handlers, Supabase Postgres/Auth/Storage/RLS, and worker/indexer services.

### In scope

- Wallet connection and transaction signing through Freighter and xBull.
- USDC on Stellar payment and Soroban escrow funding.
- Soroban lock, release, refund, pause, and event emission.
- Seller payout route orchestration: USDC wallet, XLM route, MoneyGram cash-out route.
- Refund request, evidence upload, admin review, and Trust Profile update.
- Supabase RLS, API authorization, admin access, storage access, and event indexing.
- Testnet/mainnet environment separation and release readiness.

### Out of scope for MVP

- QRIS, bank transfer, and direct Rupiah-to-USDC conversion inside Trustip.
- Internal custodial wallet top-up.
- Buyer payment through MoneyGram.
- Binance Pay checkout automation.
- Production integrated MoneyGram API unless partner/API access is confirmed.

## 2. Risk Rating Model

| Severity | Meaning                                                                  | Required action                                                          |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Critical | Can cause fund loss, unauthorized release/refund, or mainnet compromise. | Must be fixed before testnet demo or mainnet. No exception.              |
| High     | Can block payment, expose sensitive data, or enable serious abuse.       | Must be fixed before public demo/mainnet.                                |
| Medium   | Can cause incorrect status, operational burden, or user confusion.       | Fix before mainnet or document controlled workaround.                    |
| Low      | Cosmetic, copy, or non-critical reliability issue.                       | Fix when practical; should not block demo unless user trust is affected. |

## 3. Security Principles

- Never rely on frontend status as source of truth for payment, escrow, payout, or refund.
- Never hold buyer private keys or seed phrases.
- Never allow escrow release/refund from database status alone; verify on-chain and authorization rules.
- Treat Stellar RPC as network access and sync source, not as the long-term historical database.
- Store Trustip event history in Supabase through indexed contract/payment/payout events.
- All money-moving actions must be idempotent.
- Mainnet configuration must be explicit and never silently fall back to testnet values.
- Buyer-facing UX must stay simple, but internal implementation must remain auditable.

## 4. Critical Surfaces

| Surface        | Critical risk                                                 | Required control                                                                              |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Wallet signing | User signs malicious or wrong-network transaction.            | Network guard, transaction summary, simulation, user confirmation.                            |
| USDC payment   | Wrong asset, wrong amount, duplicate payment, or failed sync. | Asset allowlist, exact amount verification, tx hash validation, idempotency.                  |
| Soroban escrow | Unauthorized release/refund or double payout.                 | Contract authorization, state machine, invariant tests, event audit.                          |
| Refund flow    | Buyer/seller fraud or evidence manipulation.                  | Evidence immutability, role checks, admin review, audit log.                                  |
| Seller payout  | Wrong route, wrong receiver, duplicate payout.                | Payout method verification, route status, idempotency key, manual review for MoneyGram route. |
| Supabase/RLS   | User accesses another user's orders or evidence.              | RLS enabled, role policies, service key isolation.                                            |
| Worker/indexer | On-chain state not reflected in app.                          | Retry logic, reconciliation jobs, last processed ledger tracking.                             |
| Mainnet deploy | Wrong contract ID, wrong USDC asset, or leaked secrets.       | Environment checklist, secrets rotation, mainnet dry run.                                     |

## 5. Wallet & Signing Risks

### Risks

- Buyer connects wrong wallet account.
- Wallet is on wrong network.
- Buyer has no USDC trustline or insufficient XLM for fees.
- Transaction shown to buyer differs from intended payment.
- Phishing risk from fake wallet prompts or fake Binance guide links.

### Controls

- Support only approved wallet connectors in MVP: Freighter and xBull.
- Show selected wallet address, network, and shortened public key before payment.
- Validate network before preparing any transaction.
- Show transaction summary: order ID, seller name, USDC amount, network, and escrow purpose.
- Never ask for seed phrase or private key.
- Use trusted external links only for Binance guide, with warning to verify the Stellar network.
- Block payment if wallet network, amount, or asset is invalid.

### Release gate

- Buyer can connect/disconnect wallet safely.
- Wrong network is blocked.
- Payment button remains disabled until wallet, amount, and order state are valid.

## 6. USDC Payment & Escrow Funding Risks

### Risks

- Buyer pays wrong amount.
- Buyer pays wrong asset.
- Frontend marks order paid before on-chain confirmation.
- Duplicate payment creates inconsistent order state.
- User refreshes during payment and backend loses transaction state.

### Controls

- Backend prepares payment intent and stores expected asset, amount, order ID, and expiry.
- Payment confirmation must be based on contract event or verified transaction, not user-submitted status.
- Payment submit/sync endpoint must be idempotent by order ID and tx hash.
- Store all transaction hashes in `blockchain_transactions` and escrow events in `escrow_events`.
- Only move order to `PAYMENT_CONFIRMED` / `ESCROW_FUNDED` after verification.

### Release gate

- Duplicate payment submit does not double-fund or corrupt status.
- Failed transaction does not mark order paid.
- Refresh/retry flow resumes from stored payment state.

## 7. Soroban Escrow Contract Risks

### Risks

- Unauthorized user calls release/refund.
- Contract allows double release or double refund.
- Contract releases funds before escrow is funded.
- Admin pause or admin role is abused.
- A separately deployed but uninitialized contract is claimed by an attacker.
- Contract or order state becomes archived because TTL is not renewed.
- An incorrect admin address immediately locks out the current operator.
- Contract emits insufficient events for backend reconciliation.

### Controls

- Contract implemented in Rust with explicit state machine.
- Valid states: CREATED, FUNDED, RELEASED, REFUNDED, CANCELLED, PAUSED where relevant.
- `release_to_seller` can only succeed after funded state and proper authorization.
- `refund_to_buyer` can only succeed after funded state and proper authorization.
- Double release/refund must fail at contract level, not only backend level.
- Initialize admin and USDC atomically in the deployment constructor.
- Renew contract and order TTL on access, with operational TTL monitoring.
- Rotate admin through propose/accept so the old admin remains active until the
  new address proves control.
- Emit events for order created, funded, released, refunded, cancelled, paused, unpaused.
- Keep contract small and avoid putting social-commerce business logic on-chain.

### Required invariant tests

- Funds cannot be released before funded.
- Released order cannot be refunded.
- Refunded order cannot be released.
- Cancelled order cannot be funded/released.
- Unauthorized caller cannot release/refund.
- Admin pause blocks money-moving operations.
- Constructor deployment has no externally callable uninitialized window.
- Contract and order access renews TTL before the configured threshold.
- Unauthorized or unproposed addresses cannot complete admin rotation.

## 8. Order, Shipment, and Refund Risks

### Risks

- Seller updates shipment without valid paid order.
- Buyer confirms wrong order or confirms after refund process starts.
- Seller submits fake shipment proof.
- Buyer submits false refund claim.
- Evidence contains sensitive personal data.

### Controls

- Shipment update allowed only after escrow funded.
- Buyer confirmation allowed only for the buyer assigned to the order.
- Refund request locks order from normal completion until resolved.
- Evidence files stored in private Supabase Storage buckets.
- Use signed URLs with expiry for viewing evidence.
- Admin actions must create immutable audit records.
- Trust Profile updates only after final order/refund outcome.

### Release gate

- Buyer cannot confirm another buyer's order.
- Seller cannot update another seller's order.
- Refund in review blocks automatic payout.
- Evidence cannot be publicly accessed without authorization.

## 9. Seller Payout Multi-Route Risks

### Payout routes in Trustip v1.1

- USDC_WALLET: release/payout to seller Stellar wallet.
- XLM_WALLET: route/swap/payout to XLM wallet where implemented.
- MONEYGRAM_CASHOUT: seller off-ramp route through MoneyGram cash-out/off-ramp strategy.

### Risks

- Seller sets wrong payout address or route.
- Payout route executes twice.
- XLM route suffers slippage or route failure.
- MoneyGram payout status is not synced correctly.
- MoneyGram route is treated as buyer checkout by mistake.
- Compliance/KYC obligations are misunderstood.

### Controls

- Seller payout method must be verified before first payout.
- Payout request must have unique idempotency key.
- Payout cannot start unless escrow is released/resolved.
- XLM route must show estimated amount, route, fee, and slippage warning before execution.
- MoneyGram route must be modeled as off-ramp/cash-out route, not buyer payment rail.
- Integrated MoneyGram execution requires confirmed API/partner access, KYC/KYB requirements, and operational runbook.
- Until integration is confirmed, treat MoneyGram as guided or manually reviewed route.

### Release gate

- USDC payout works end-to-end first.
- XLM payout cannot execute without quote/route confirmation.
- MoneyGram route cannot be shown as fully automated unless integration is actually implemented and tested.

## 10. Binance Top-Up Guide Risks

### Risks

- User thinks Binance is Trustip's payment gateway.
- User selects wrong withdrawal network.
- Binance support, fees, or minimum withdrawal changes.
- User clicks phishing link.

### Controls

- Label Binance as `Top-up guide`, not `Trustip payment gateway`.
- Tell user to choose Stellar network when sending USDC to wallet.
- Do not guarantee Binance availability, fees, or network support.
- Use official link handling and clear warning copy.
- Trustip payment remains wallet-signed USDC payment after user has USDC.

### Release gate

- No copy says Trustip auto-converts Rupiah to USDC.
- No backend assumes Binance payment confirmation in MVP.

## 11. Supabase, API, and Admin Security

### Risks

- RLS disabled on exposed tables.
- Service role key leaks to frontend.
- Buyer/seller can access other users' orders.
- Admin endpoint is callable by non-admin.
- Evidence files are exposed publicly.

### Controls

- Enable RLS on all public schema tables.
- Service role key only used server-side.
- Role-based policies: buyer, seller, admin.
- Admin actions require admin role and audit log entry.
- Storage buckets for evidence should be private.
- Validate all API inputs with Zod or equivalent schema validation.
- Use rate limiting on sensitive endpoints.

### Release gate

- RLS tests pass for buyer, seller, and admin roles.
- Service role key is not present in frontend bundle or public env.
- Admin-only endpoints reject non-admin users.

## 12. Worker and Event Indexing Risks

### Risks

- Contract event is missed.
- Worker runs twice and duplicates records.
- RPC outage leaves order stuck.
- App status diverges from contract state.

### Controls

- Store last processed ledger/block/cursor.
- All event processing must be idempotent.
- Reconciliation job compares database escrow state with on-chain contract state.
- Failed sync creates retryable error state, not silent success.
- Admin dashboard shows stuck orders and failed payout syncs.

### Release gate

- Worker can restart without duplicating events.
- Manual resync endpoint or script exists for stuck orders.
- Failed RPC does not corrupt order state.

## 13. Mainnet Readiness Risks

### Risks

- Testnet contract ID used on mainnet.
- Wrong USDC asset/contract configured.
- Mainnet secret or admin key leaked.
- Demo/mock payment path accidentally enabled.
- Contract not paused during emergency.

### Controls

- Separate `.env.testnet`, `.env.mainnet`, and deployment records.
- Never hardcode network, contract ID, or asset identifiers in UI components.
- Mainnet deploy checklist must be completed by two reviewers if possible.
- Remove fake QRIS, bank transfer simulation, and demo ops payment buttons.
- Emergency pause function must be tested before mainnet.

### Mainnet release gate

- Contract deployed and verified on intended network.
- USDC asset/SAC address validated.
- Wallet network guard tested.
- All critical tests pass.
- No mock payment route is reachable from user-facing UI.

## 14. Risk Register

| ID    | Risk                                        | Severity | Owner              | Mitigation                                               | Release status                 |
| ----- | ------------------------------------------- | -------- | ------------------ | -------------------------------------------------------- | ------------------------------ |
| R-001 | Unauthorized escrow release/refund          | Critical | Contract           | Rust state machine, auth checks, invariant tests         | Blocker                        |
| R-002 | Double payout                               | Critical | Contract + Backend | Contract state guard, payout idempotency                 | Blocker                        |
| R-003 | Wrong network or wrong asset payment        | Critical | Frontend + Backend | Network guard, asset allowlist, tx verification          | Blocker                        |
| R-004 | Supabase RLS leak                           | High     | Backend            | RLS policies, role tests, private storage                | Blocker before public demo     |
| R-005 | MoneyGram route misrepresented as automated | High     | Product + Backend  | Copy guard, integration status flag, manual review       | Blocker for production claim   |
| R-006 | Worker misses contract event                | High     | Backend            | Cursor, retry, reconciliation job                        | Must fix before mainnet        |
| R-007 | Refund evidence exposure                    | High     | Backend            | Private bucket, signed URLs, audit access                | Must fix before public demo    |
| R-008 | Binance guide causes wrong withdrawal       | Medium   | Product + Frontend | Warning copy, official links, no guarantee claims        | Must fix before demo           |
| R-009 | XLM route slippage                          | Medium   | Backend            | Quote confirmation, limit/slippage control               | Must fix before enabling route |
| R-010 | Animation hurts checkout performance        | Medium   | Frontend           | Motion-only checkout, lazy-load 3D, no heavy scroll libs | Must fix before demo           |
| R-011 | Admin abuse or accidental resolution        | High     | Admin              | Role checks, audit log, confirmation modals              | Must fix before mainnet        |
| R-012 | Mainnet env mix-up                          | Critical | DevOps             | Env separation, deployment checklist, reviewer signoff   | Blocker                        |

## 15. Emergency Procedures

### Escrow incident

1. Pause contract if money-moving operations are at risk.
2. Disable user-facing release/refund actions in frontend if needed.
3. Freeze affected order IDs in database.
4. Run reconciliation script for affected tx/order IDs.
5. Document incident in admin audit log.
6. Resume only after root cause and fix are verified.

### Payout incident

1. Disable affected payout route flag.
2. Stop payout worker.
3. Mark affected payouts as `REVIEW_REQUIRED`.
4. Reconcile escrow release tx with payout transaction records.
5. Resume route after idempotency and destination checks pass.

### Evidence/privacy incident

1. Rotate affected signed URLs.
2. Disable public bucket exposure if found.
3. Audit file access logs where available.
4. Notify affected users if required by policy/law.
5. Patch storage policy before re-enabling uploads.

## 16. Final Release Gates

### Demo readiness

- Buyer can connect Freighter/xBull and pay USDC on selected network.
- Escrow funds, release, and refund work in controlled demo.
- Seller payout method selection exists and does not misrepresent MoneyGram automation.
- Refund and evidence flow works with private storage.
- No QRIS/bank/auto Rupiah conversion appears in MVP UI.

### Mainnet readiness

- All Critical and High risks closed or explicitly disabled.
- Rust contract invariant tests pass.
- RLS tests pass.
- Worker/indexer retry and reconciliation tested.
- Mainnet env variables reviewed.
- Emergency pause tested.
- Admin audit trail exists for refund and payout decisions.

## 17. AI Agent Guardrails

AI agents must not implement or reintroduce:

- QRIS or local bank transfer in MVP.
- Internal Rupiah-to-USDC auto-conversion.
- Buyer-facing MoneyGram payment flow.
- Fake payment success buttons.
- Custodial private key collection.
- Payout execution without idempotency.
- Public evidence bucket.
- Hardcoded mainnet/testnet contract IDs inside UI components.

AI agents may implement:

- Wallet connection UI and transaction preparation.
- USDC escrow interaction through Soroban.
- Seller payout method settings and route status.
- MoneyGram cash-out route placeholder/guided/manual review flow with accurate labeling.
- Testing, indexing, and reconciliation helpers.
