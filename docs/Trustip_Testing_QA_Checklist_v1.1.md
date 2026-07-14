# Trustip Testing & QA Checklist v1.1

Quality assurance checklist for Stellar-native protected checkout, Soroban escrow, and multi-route seller payout.

**Product version:** Trustip v1.1  
**Payment scope:** Wallet Stellar Native using USDC, Freighter, xBull, Binance top-up guide  
**Payout scope:** USDC wallet, XLM wallet route, MoneyGram cash-out/off-ramp route  
**Non-MVP:** QRIS, local bank transfer checkout, auto Rupiah-to-USDC conversion, Binance Pay production checkout

# 1. Purpose

This checklist defines the minimum QA scope before Trustip v1.1 is considered demo-ready, testnet-ready, or mainnet-ready. It is written for AI agents, developers, and reviewers working on the Trustip codebase.

| Area              | Trustip v1.1 Scope                                                         | Priority  |
| ----------------- | -------------------------------------------------------------------------- | --------- |
| Buyer payment     | USDC on Stellar via Freighter and xBull                                    | Critical  |
| Top-up support    | Binance guide only; no automatic IDR-to-USDC conversion                    | Important |
| Escrow            | Soroban Rust contract locks, releases, and refunds USDC                    | Critical  |
| Seller payout     | USDC wallet, XLM route, MoneyGram cash-out/off-ramp route                  | Critical  |
| Database          | Supabase PostgreSQL with RLS and event indexing                            | Critical  |
| Non-MVP guardrail | No QRIS, no local bank transfer checkout, no buyer-facing simulate payment | Critical  |

# 2. QA Severity Levels

| Severity     | Definition                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| P0 - Blocker | Breaks funds, escrow, auth, payout, security, or mainnet readiness. Must be fixed before demo/mainnet. |
| P1 - Major   | Breaks a core user flow or causes inconsistent order/payment status. Must be fixed before submission.  |
| P2 - Minor   | UI polish, copy, non-critical layout, loading state, or minor admin issue. Fix if time allows.         |

# 3. Release Gates

- [ ] All P0 tests pass on testnet.
- [ ] Buyer can complete checkout using Freighter on the correct Stellar network.
- [ ] Buyer can complete checkout using xBull on the correct Stellar network.
- [ ] Soroban escrow cannot be released or refunded twice.
- [ ] Seller cannot receive funds before order completion or admin resolution.
- [ ] Refund path returns funds to buyer through Soroban escrow logic.
- [ ] Payout method selection supports USDC wallet, XLM route, and MoneyGram route status.
- [ ] Supabase RLS prevents cross-user access between buyers, sellers, and admins.
- [ ] Stellar RPC is not used as the long-term history database; Trustip indexes required events.
- [ ] No QRIS, bank transfer, auto-convert Rupiah, or fake payment simulation appears in the MVP UI.

# 4. Test Environments

| Environment       | Description                                                                                                       | Usage                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Local dev         | Local Next.js app, Supabase local or staging, Soroban testnet, fake/demo data allowed only for non-payment UI.    | Feature development         |
| Staging testnet   | Hosted app with Stellar testnet contract, testnet USDC/SAC config, staging Supabase, worker/indexer enabled.      | End-to-end QA               |
| Mainnet readiness | Production-like environment using mainnet config, final contract IDs, secure env variables, no demo payment rail. | Final pre-submit/pre-launch |

# 5. Test Data Requirements

- [ ] Buyer account with connected Freighter wallet.
- [ ] Buyer account with connected xBull wallet.
- [ ] Seller account with USDC wallet payout method.
- [ ] Seller account with XLM payout route configured.
- [ ] Seller account with MoneyGram cash-out/off-ramp route configured as route metadata/status.
- [ ] Admin account with refund resolution permission.
- [ ] At least one order for each lifecycle: pending payment, paid, protected, shipped, completed, refund requested, refunded.
- [ ] Evidence files for refund tests: image, video link/metadata, and text notes.
- [ ] Testnet wallets funded with enough XLM for fees and USDC for payment tests.

# 6. Wallet Connection QA

| ID     | Test                      | Precondition                                  | Steps                                                        | Expected Result                                                                        | Severity |
| ------ | ------------------------- | --------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------- |
| WAL-01 | Connect Freighter wallet  | Freighter installed; app on supported network | Buyer clicks connect, selects Freighter, approves connection | Wallet address stored, UI shows connected state, no private key stored                 | P0       |
| WAL-02 | Connect xBull wallet      | xBull installed; app on supported network     | Buyer clicks connect, selects xBull, approves connection     | Wallet address stored, UI shows connected state                                        | P0       |
| WAL-03 | Wrong network guard       | Wallet connected to unsupported network       | Open checkout and attempt payment                            | UI blocks payment and asks user to switch network                                      | P0       |
| WAL-04 | Wallet disconnected state | Wallet disconnected mid-flow                  | Refresh checkout or disconnect wallet                        | App shows safe reconnect state, no duplicate order/payment is created                  | P1       |
| WAL-05 | No wallet installed       | No Freighter/xBull installed                  | Open checkout and click Pay                                  | App explains wallet requirement and shows Binance/top-up guide, not QRIS/bank transfer | P1       |

# 7. USDC Payment QA

| ID     | Test                         | Precondition                                           | Steps                                  | Expected Result                                                                               | Severity |
| ------ | ---------------------------- | ------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| PAY-01 | Prepare payment transaction  | Checkout order exists                                  | Call payment prepare from frontend/API | Unsigned transaction/XDR is created for the correct order, asset, amount, and network         | P0       |
| PAY-02 | Buyer signs USDC payment     | Buyer has USDC balance and fee XLM                     | Approve transaction from wallet        | Transaction is signed by buyer wallet only; backend never handles buyer private key           | P0       |
| PAY-03 | Insufficient USDC balance    | Buyer balance below order amount                       | Attempt payment                        | Payment fails safely; order stays pending payment; error is clear                             | P0       |
| PAY-04 | Missing USDC trustline       | Buyer wallet lacks USDC trustline if required by route | Attempt payment                        | UI shows trustline/setup guidance or blocks with clear message                                | P1       |
| PAY-05 | Submit tx and save hash      | Signed payment ready                                   | Submit transaction                     | tx_hash, ledger, network, status, and order_id are stored in blockchain_transactions/payments | P0       |
| PAY-06 | Duplicate payment submission | Payment already confirmed                              | Resubmit same order/payment            | No duplicate escrow funding or duplicate payment record is accepted                           | P0       |

# 8. Soroban Escrow QA

| ID     | Test                        | Precondition                       | Steps                                                     | Expected Result                                                      | Severity |
| ------ | --------------------------- | ---------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| ESC-01 | Create escrow order         | Order created in database          | Invoke/create escrow reference or prepare contract state  | Contract/order mapping is created and linked to DB order             | P0       |
| ESC-02 | Fund escrow                 | Buyer payment submitted            | Backend/contract sync confirms funding                    | Escrow status becomes FUNDED/LOCKED; buyer UI says Pesanan Aman      | P0       |
| ESC-03 | Release to recipient        | Order delivered and buyer confirms | Invoke release_to_recipient                               | USDC is released to the stored payout recipient; contract emits release event | P0       |
| ESC-04 | Refund to buyer             | Refund approved by admin           | Invoke refund_to_buyer                                    | USDC is returned to buyer; contract emits refund event               | P0       |
| ESC-05 | Block double release        | Escrow already released            | Invoke release again                                      | Contract rejects second release                                      | P0       |
| ESC-06 | Block double refund         | Escrow already refunded            | Invoke refund again                                       | Contract rejects second refund                                       | P0       |
| ESC-07 | Unauthorized release/refund | Non-admin/non-authorized caller    | Attempt release/refund                                    | Contract rejects unauthorized action                                 | P0       |
| ESC-08 | Pause contract              | Admin emergency condition          | Admin pauses contract then user tries fund/release/refund | Blocked actions follow pause rules and produce clear event/status    | P0       |
| ESC-09 | Atomic initialization       | Built escrow WASM                  | Deploy with constructor admin + USDC args                 | Contract is initialized in the deploy transaction; no takeover window exists | P0       |
| ESC-10 | Renew state TTL             | Contract and order TTL near threshold | Access contract and order state                         | Instance and order TTL renew to the configured target                | P0       |
| ESC-11 | Rotate admin safely         | Current and proposed admin keys available | Propose, try wrong accept, then accept with proposed key | Wrong address fails; authority changes only after proposed admin accepts | P0       |

# 9. Order Lifecycle QA

- [ ] Pending Payment -> buyer sees payment requirement and wallet options.
- [ ] Payment Confirmed -> system stores tx hash and locks order updates that should not change amount.
- [ ] Pesanan Aman -> seller can start processing but cannot receive funds yet.
- [ ] Dikemas -> seller can update processing/packing state.
- [ ] Dikirim -> seller must provide tracking number and shipment proof/photo metadata.
- [ ] Barang Sampai -> buyer can confirm receipt or start refund/help flow if still eligible.
- [ ] Selesai -> escrow release path has completed or payout route has started based on seller method.
- [ ] Refunded -> order is closed and cannot be rated as successful order.

# 10. Seller Payout Multi-Route QA

| ID      | Test                             | Precondition                              | Steps                                            | Expected Result                                                                                                | Severity |
| ------- | -------------------------------- | ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------- |
| POUT-01 | Set USDC wallet payout method    | Seller connected wallet                   | Seller selects USDC wallet payout                | Payout method saved as USDC_WALLET with Stellar address and active status                                      | P0       |
| POUT-02 | Set XLM payout route             | Seller connected wallet                   | Seller selects XLM payout route                  | Payout method saved as XLM_WALLET; route status/quote readiness tracked                                        | P1       |
| POUT-03 | Set MoneyGram route              | Seller eligible for off-ramp route        | Seller selects MoneyGram cash-out/off-ramp route | Payout method saved as MONEYGRAM_CASHOUT with required route metadata/status; no buyer payment flow is created | P0       |
| POUT-04 | USDC payout after release        | Escrow released to seller                 | Execute payout route                             | USDC wallet payout is completed or marked processing with tx hash/status                                       | P0       |
| POUT-05 | XLM payout route after release   | XLM route available                       | Execute XLM payout                               | Route execution records source amount, output amount, fees, status, and tx hash if on-chain                    | P1       |
| POUT-06 | MoneyGram payout status tracking | Seller selected MoneyGram route           | Trigger payout request/status sync               | System tracks route status: pending, processing, ready_for_pickup, completed, failed, or cancelled             | P0       |
| POUT-07 | Payout failure handling          | Route fails due to provider/network issue | Execute/sync payout                              | Funds are not lost; status becomes failed/retry_required/manual_review                                         | P0       |

# 11. Refund and Evidence QA

| ID     | Test                         | Precondition                      | Steps                             | Expected Result                                                                      | Severity |
| ------ | ---------------------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| REF-01 | Buyer submits refund request | Order paid/protected and eligible | Buyer submits reason and evidence | Refund request created, order enters refund review status                            | P0       |
| REF-02 | Evidence upload              | Buyer uploads file/link metadata  | Upload image/video evidence       | Evidence is stored with owner, order_id, visibility rules, and file metadata         | P1       |
| REF-03 | Seller response              | Refund request exists             | Seller submits response/evidence  | Seller evidence is linked and visible to admin                                       | P1       |
| REF-04 | Admin approves refund        | Refund review complete            | Admin approves refund             | Soroban refund path executes; buyer gets funds; order status refunded                | P0       |
| REF-05 | Admin rejects refund         | Refund review complete            | Admin rejects refund              | Order returns to valid lifecycle or release path, with audit trail saved             | P0       |
| REF-06 | Refund after completed order | Order already completed/released  | Buyer attempts refund             | Blocked or moved to non-escrow support flow; no on-chain refund from released escrow | P0       |

# 12. Trust Profile QA

- [ ] Successful completed order increases successful transaction count.
- [ ] Released payout updates seller completed volume without exposing technical settlement details to buyer.
- [ ] Approved buyer refund increases refund count/rate and triggers seller penalty if seller is at fault.
- [ ] Rejected refund does not unfairly penalize seller.
- [ ] Buyer review/rating can only be submitted after eligible completed order.
- [ ] Trust Profile uses buyer-friendly labels: transactions completed, refund rate, average ship time, rating, verified status.

# 13. Supabase RLS and Security QA

| ID     | Test                                   | Precondition                          | Steps                                            | Expected Result                                                                                      | Severity |
| ------ | -------------------------------------- | ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| SEC-01 | Buyer cannot read other buyer orders   | Two buyer accounts exist              | Buyer A queries Buyer B order                    | Request is denied by RLS/API                                                                         | P0       |
| SEC-02 | Seller cannot read other seller orders | Two sellers exist                     | Seller A queries Seller B order                  | Request is denied by RLS/API                                                                         | P0       |
| SEC-03 | Seller cannot release funds manually   | Seller owns order                     | Seller attempts release endpoint/contract action | Blocked unless required authorization and lifecycle rules are satisfied                              | P0       |
| SEC-04 | Admin action audited                   | Admin resolves refund or payout issue | Perform admin action                             | admin_actions row is created with actor, action, target, timestamp, and metadata                     | P0       |
| SEC-05 | Storage visibility                     | Evidence file exists                  | Unauthorized user opens evidence URL             | Access denied or signed URL expires as intended                                                      | P1       |
| SEC-06 | Env secrets not exposed                | Build client bundle                   | Inspect client env usage                         | Service role keys, API secrets, private keys, and provider credentials never appear in client bundle | P0       |

# 14. API and Worker QA

- [ ] API validates all request bodies using shared Zod validators or equivalent validation.
- [ ] API never trusts client-provided order amount after checkout link/order creation.
- [ ] Payment sync is idempotent and safe to retry.
- [ ] Escrow event indexer persists required contract events to Supabase.
- [ ] Worker does not rely on Stellar RPC as long-term historical database.
- [ ] Payout sync worker updates route status without overwriting terminal states incorrectly.
- [ ] Failed worker job is retryable and creates admin-visible issue when needed.

# 15. UI, Animation, and Performance QA

| ID    | Test                           | Precondition                 | Steps                                  | Expected Result                                                                                      | Severity |
| ----- | ------------------------------ | ---------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| UI-01 | Checkout lightweight animation | Checkout page loaded         | Inspect bundle/performance             | Checkout uses lightweight UI animation only; no heavy 3D required for payment page                   | P1       |
| UI-02 | Landing cinematic lazy load    | Landing page loaded          | Inspect 3D/GSAP assets                 | VOID/3D scenes lazy-load and do not block initial content                                            | P2       |
| UI-03 | Mobile responsive checkout     | Mobile viewport              | Open checkout and complete wallet flow | Primary actions remain visible; no overlap or clipped text                                           | P1       |
| UI-04 | Error state clarity            | Payment failure/refund error | Trigger known error                    | User sees safe, buyer-friendly error and can retry or contact support                                | P1       |
| UI-05 | Forbidden features absent      | Full app build               | Search UI routes                       | No QRIS, no bank transfer checkout, no Add Balance internal wallet, no buyer-facing simulate payment | P0       |

# 16. Mainnet Readiness QA

- [ ] Testnet and mainnet environment variables are separated.
- [ ] Contract IDs are loaded from environment/config, not hardcoded in UI components.
- [ ] USDC asset/contract config is correct for selected network.
- [ ] Wallet network guard prevents testnet/mainnet mismatch.
- [ ] Admin keys and deployer credentials are not stored in repository.
- [ ] Soroban contract has been tested for release/refund/idempotency before mainnet deployment.
- [ ] All critical tx hashes are saved and linked to explorer view.
- [ ] Supabase RLS is enabled on all exposed tables.
- [ ] Evidence storage bucket policy is not public by default.
- [ ] A rollback/incident plan exists for contract pause, payout failure, and database sync issue.

# 17. Demo Day Regression Checklist

- [ ] Seller creates checkout link.
- [ ] Buyer opens checkout link.
- [ ] Buyer connects Freighter or xBull.
- [ ] Buyer pays USDC on Stellar.
- [ ] Order shows Pesanan Aman.
- [ ] Seller updates packed/shipped status and adds resi/evidence.
- [ ] Buyer confirms order received.
- [ ] Escrow release succeeds.
- [ ] Seller payout method/status is visible.
- [ ] Refund alternate path is demoable on separate order.
- [ ] MoneyGram route is shown as seller payout/off-ramp route, not buyer payment rail.
- [ ] Binance appears only as buyer top-up guide, not automatic Rupiah conversion.

# 18. Final Acceptance Criteria

Trustip v1.1 is considered QA-pass only when all P0 items pass, no P1 issue blocks the main demo flow, and all non-MVP forbidden features are absent from the buyer-facing product. P2 issues may remain only if they do not affect payment, escrow, refund, payout, security, or demo clarity.

| Sign-off Item  | Value                                       |
| -------------- | ------------------------------------------- |
| QA owner       |                                             |
| Date           |                                             |
| Environment    | Local / Staging Testnet / Mainnet Readiness |
| Result         | Pass / Conditional Pass / Fail              |
| Open P0 issues |                                             |
| Open P1 issues |                                             |
