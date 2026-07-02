# Trustip PRD v1.1 - Stellar-Native Protected Checkout with Multi-Route Seller Payout

**Document type:** Product Requirements Document  
**Version:** v1.1  
**Status:** Revised after payment and payout scope lock  
**Product:** Trustip  
**Primary network:** Stellar  
**Primary asset:** USDC on Stellar  
**Core contract layer:** Soroban

---

## 1. Product Summary

Trustip is a Stellar-native protected checkout app for social commerce transactions. It helps buyers and sellers transact more safely outside traditional marketplaces by locking buyer funds in a Soroban escrow until the order is fulfilled.

The MVP uses USDC on Stellar as the payment asset. Buyers pay with a Stellar wallet such as Freighter or xBull. If buyers do not yet have USDC, Trustip provides a guided top-up path through Binance. Trustip does not automatically convert Rupiah to USDC in the MVP.

Seller payout is designed as a multi-route payout system. The seller can receive released funds through Stellar wallet routes such as USDC or XLM, and Trustip also includes MoneyGram as an off-ramp/cash-out route for seller payout strategy.

### One-line positioning

> Trustip is a Web3 protected checkout app for social commerce, using Stellar USDC escrow and multi-route seller payout.

---

## 2. Background and Problem

Social commerce sellers often transact through Instagram, TikTok, WhatsApp, community groups, and pre-order channels. These transactions commonly depend on manual trust: buyers transfer money first, sellers promise to ship later, and both parties have limited protection if one side fails.

Common pain points:

- Buyers are afraid of fake sellers, wrong items, unshipped orders, and poor after-sales accountability.
- Sellers need a credible way to show that their checkout is protected and trustworthy.
- Existing marketplace escrow is not always available for informal social-commerce transactions.
- Crypto and Web3 payments are still difficult for mainstream users, especially when fiat conversion is involved.
- Sellers may prefer different ways to receive funds after an order is completed.

Trustip solves the first version of this problem by using USDC escrow on Stellar. The product does not try to solve all fiat payment complexity in the MVP. Instead, it introduces buyers to Stellar wallets and USDC payments through a guided, safer checkout experience.

---

## 3. Target Users

### 3.1 Buyer

Buyers are social-commerce customers purchasing products such as:

- Jastip items
- Pre-order products
- K-pop merchandise
- Limited drops
- Community group-buy products
- Instagram/TikTok/WhatsApp seller products

Buyer needs:

- Know that their payment is protected.
- Pay using a clear wallet-based flow.
- Track order status.
- Confirm when the item arrives.
- Request help/refund if something goes wrong.

### 3.2 Seller

Sellers are independent online sellers, jastip sellers, pre-order sellers, group-buy organizers, and small merchants.

Seller needs:

- Create protected checkout links.
- Prove that they are trustworthy.
- Track paid orders.
- Upload shipping evidence and tracking number.
- Receive released funds after successful fulfillment.
- Choose a payout route that matches their preference.

### 3.3 Admin / Operator

Admins handle operational monitoring, refund review, evidence review, seller penalties, and exceptional cases.

---

## 4. Product Goals

### 4.1 MVP Goals

1. Enable sellers to create protected checkout links.
2. Enable buyers to pay with USDC through a Stellar wallet.
3. Lock buyer funds in Soroban escrow until the order is completed.
4. Allow sellers to update fulfillment status and upload evidence.
5. Allow buyers to confirm received orders or request help/refund.
6. Release funds to seller only after successful order completion or admin decision.
7. Support seller payout route selection, including Stellar wallet payout and MoneyGram off-ramp strategy.
8. Show a buyer-friendly Trust Profile for seller credibility.
9. Keep the user-facing experience simple, secure, and non-technical.

### 4.2 Non-Goals for MVP

Trustip v1.1 does not aim to implement:

- QRIS payment.
- Local bank transfer payment.
- Internal Rupiah balance.
- Auto-conversion from Rupiah to USDC inside Trustip.
- Buyer payment through MoneyGram as the primary checkout rail.
- Buyer-facing simulation buttons.
- A crypto trading dashboard.
- A full marketplace.
- Lending, staking, DeFi portfolio, or speculative trading features.

---

## 5. MVP Scope

### 5.1 Included in MVP

| Area             | MVP Scope                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Buyer checkout   | Open checkout link, view order, pay with Stellar wallet, track status, confirm received, request help/refund. |
| Wallet payment   | Freighter and xBull as primary wallets, preferably through Stellar Wallets Kit.                               |
| Payment asset    | USDC on Stellar.                                                                                              |
| Escrow           | Soroban contract locks, releases, and refunds USDC.                                                           |
| Top-up support   | Binance top-up guide for buyers who do not yet have USDC.                                                     |
| Seller dashboard | Create link, view paid orders, update status, add tracking number, upload proof.                              |
| Seller payout    | USDC wallet payout, XLM wallet route as stretch, and MoneyGram cash-out/off-ramp strategy as a payout route.  |
| Trust Profile    | Seller reputation metrics shown in buyer-friendly language.                                                   |
| Refund/help flow | Buyer request, evidence upload, seller response, admin decision, refund or release.                           |
| Admin tools      | Monitor orders, review evidence, resolve refunds, apply seller penalties.                                     |

### 5.2 Stretch Scope

| Feature                   | Description                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| XLM payout                | Seller can receive payout in XLM through Stellar route/swap after escrow release.                    |
| Guided MoneyGram cash-out | Seller receives USDC and follows a guided cash-out/off-ramp flow through MoneyGram-supported routes. |
| SEP-10 wallet login       | Wallet-based authentication to prove account ownership.                                              |
| SEP-1 stellar.toml        | Trustip domain identity metadata.                                                                    |
| SEP-7 payment deeplink    | Wallet deeplink or QR payment request for future wallet flows.                                       |

### 5.3 Future Scope

| Feature                         | Description                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Binance Pay checkout            | Buyer pays through Binance Pay; Trustip Treasury locks USDC into Soroban escrow after webhook confirmation. |
| Integrated MoneyGram payout API | Seller payout through MoneyGram with deeper integration, subject to API/partner access and compliance.      |
| Local bank payout               | Seller payout to Indonesian bank account through regulated partner.                                         |
| QRIS / bank payment             | Buyer pays in Rupiah through local rail, with Trustip Treasury/anchor converting to USDC.                   |
| Stellar anchor integration      | SEP-6/24/12/38 based fiat on/off-ramp if a suitable IDR anchor becomes available.                           |

---

## 6. Buyer Payment Scope

### 6.1 Primary Buyer Payment

Buyer payment is USDC through Stellar wallet.

Flow:

```text
Buyer opens checkout link
-> reviews order details
-> sees final USDC amount
-> connects Freighter or xBull
-> signs payment / contract transaction
-> USDC is locked in Soroban escrow
-> order status becomes Pesanan Aman
```

### 6.2 Buyer Top-Up Support

If the buyer does not have USDC, Trustip provides a top-up guide using Binance.

Flow:

```text
Buyer clicks Top Up via Binance
-> Trustip shows guide
-> buyer buys/gets USDC in Binance
-> buyer withdraws USDC using Stellar network
-> buyer receives USDC in Stellar wallet
-> buyer returns to Trustip and pays with wallet
```

Important product rule:

- Binance is a guided top-up path, not the core Trustip payment gateway.
- Buyer must choose the Stellar network when withdrawing USDC.
- Network support, withdrawal fee, and minimum withdrawal may change based on Binance policy.
- Trustip must not promise that Rupiah payment is handled inside Trustip during MVP.

### 6.3 Binance Pay Future Feature

Binance Pay is a future payment feature, not MVP.

Potential future flow:

```text
Buyer chooses Binance Pay
-> Binance Pay checkout opens
-> buyer pays inside Binance
-> Binance webhook confirms payment
-> Trustip Treasury locks USDC into Soroban escrow
-> order becomes Pesanan Aman
```

Binance Pay requires merchant access, KYB, API key, webhook setup, treasury management, and compliance review.

---

## 7. Seller Payout Scope

Seller payout is a key part of Trustip. Trustip supports multi-route payout so that sellers can choose how they want to receive released funds.

### 7.1 Payout Route 1 - USDC Stellar Wallet

This is the primary MVP payout route.

```text
Order completed
-> escrow releases USDC
-> seller receives USDC in Stellar wallet
```

Requirements:

- Seller connects or registers Stellar wallet.
- Seller wallet has USDC trustline if needed.
- Seller wallet has enough XLM reserve/fee requirements.
- Backend records payout transaction hash.

### 7.2 Payout Route 2 - XLM Stellar Wallet

This is stretch scope.

```text
Order completed
-> escrow releases value
-> system routes/swaps USDC to XLM where supported
-> seller receives XLM
```

Requirements:

- Route/liquidity must be available.
- Estimated conversion rate and fees must be shown.
- Seller confirms route before payout.

### 7.3 Payout Route 3 - MoneyGram Cash-Out / Off-Ramp

MoneyGram is used as part of seller payout and off-ramp strategy. It is not the primary buyer checkout rail.

Product role:

```text
Buyer pays USDC
-> USDC locked in Soroban escrow
-> order completed
-> seller chooses MoneyGram cash-out/off-ramp route
-> seller converts released USDC to cash/fiat through MoneyGram-supported route
```

Implementation levels:

| Level                                 | Description                                                                                               | Status                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Level A - Guided MoneyGram cash-out   | Seller receives USDC, then Trustip guides seller to cash-out via MoneyGram-supported wallet/app/location. | MVP-compatible / stretch implementation. |
| Level B - Integrated MoneyGram payout | Trustip integrates with MoneyGram/partner API to orchestrate cash-out or fiat payout.                     | Production / partner-dependent.          |

Requirements:

- Seller selects MoneyGram as payout route.
- Trustip records selected payout route.
- Seller sees clear explanation that MoneyGram availability depends on region, supported routes, KYC, fees, and partner access.
- If integrated, Trustip must handle MoneyGram reference ID, payout status, compliance requirements, and reconciliation.

### 7.4 Payout UX Copy

Use buyer/seller-friendly wording:

- Cara Terima Dana
- Terima sebagai USDC
- Terima sebagai XLM
- Cairkan lewat MoneyGram
- Status pencairan
- Bukti pencairan

Avoid exposing settlement jargon to normal sellers.

---

## 8. Order Lifecycle

### 8.1 Main Order Statuses

| Status           | User-facing label       | Meaning                                                   |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| DRAFT            | Draft                   | Seller is still preparing checkout link.                  |
| AWAITING_PAYMENT | Menunggu Pembayaran     | Buyer has opened checkout but has not paid.               |
| PAYMENT_RECEIVED | Pembayaran Diterima     | Payment transaction was detected/submitted.               |
| ESCROW_LOCKED    | Pesanan Aman            | USDC is locked in Soroban escrow.                         |
| PROCESSING       | Diproses                | Seller is preparing the order.                            |
| PACKED           | Dikemas                 | Seller has packed the item.                               |
| SHIPPED          | Dikirim                 | Seller has shipped the item and submitted proof/tracking. |
| ARRIVED          | Barang Sampai           | Buyer marks item arrived or shipping indicates arrival.   |
| COMPLETED        | Pesanan Selesai         | Buyer confirms and payout can be released.                |
| REFUND_REQUESTED | Bantuan/Refund Diajukan | Buyer reports an issue.                                   |
| UNDER_REVIEW     | Sedang Ditinjau         | Admin is reviewing evidence.                              |
| REFUNDED         | Refund Selesai          | Funds returned to buyer.                                  |
| CANCELLED        | Dibatalkan              | Order cancelled before completion.                        |

### 8.2 Escrow Statuses

| Status    | Meaning                                                      |
| --------- | ------------------------------------------------------------ |
| CREATED   | Escrow order exists but not funded.                          |
| FUNDED    | Buyer funds are locked.                                      |
| RELEASED  | Funds released to seller/payout route.                       |
| REFUNDED  | Funds refunded to buyer.                                     |
| CANCELLED | Escrow cancelled before funding or through valid admin flow. |
| PAUSED    | Contract/system paused for emergency.                        |

### 8.3 Payout Statuses

| Status         | Meaning                                      |
| -------------- | -------------------------------------------- |
| NOT_REQUESTED  | Payout not requested yet.                    |
| ROUTE_SELECTED | Seller selected payout route.                |
| PROCESSING     | Payout is being processed.                   |
| COMPLETED      | Payout completed.                            |
| FAILED         | Payout failed and requires retry or support. |
| NEEDS_REVIEW   | Payout requires admin or compliance review.  |

---

## 9. Buyer Flow Requirements

### 9.1 Open Checkout

Buyer opens a protected checkout link generated by seller.

Required content:

- Product title
- Product photo
- Seller name
- Seller Trust Profile summary
- Price reference
- Final USDC amount
- Payment method: Wallet Stellar
- CTA: Bayar

### 9.2 Connect Wallet

Buyer chooses wallet:

- Freighter
- xBull

Required checks:

- Wallet installed/available.
- Correct network selected.
- Wallet address captured.
- USDC balance sufficient.
- Trustline/account requirement handled where applicable.

### 9.3 Pay

Buyer signs transaction or contract call.

Required result:

- Payment/escrow tx hash is saved.
- Order status updates to Pembayaran Diterima or Pesanan Aman.
- Buyer sees a success status page.

### 9.4 Track Order

Buyer can track:

- Payment protected state.
- Seller processing state.
- Packing/shipping state.
- Tracking number.
- Seller-uploaded shipping proof.
- Order history.

### 9.5 Confirm Received

Buyer clicks Pesanan Diterima after item arrives.

System behavior:

- Order moves to completed.
- Escrow release is triggered.
- Seller payout route begins.
- Buyer can leave review.

### 9.6 Request Help / Refund

Buyer can request help/refund before order is completed.

Required evidence:

- Reason category.
- Description.
- Photo/video evidence.
- Unboxing video if item was received but wrong/damaged.

System behavior:

- Order moves to under review.
- Seller can respond.
- Admin decides release/refund/partial action depending on evidence.

---

## 10. Seller Flow Requirements

### 10.1 Seller Onboarding

Seller signs up and completes profile.

Required fields:

- Store/seller name
- Email
- Phone number
- Social media handle/link
- Product category
- Shipping origin/location
- Stellar wallet address
- Preferred payout route

### 10.2 Activation Checklist

Seller should complete:

- Email verification
- Phone verification
- Wallet connection
- Store profile
- Payout method setup
- Trust Profile readiness

### 10.3 Create Checkout Link

Seller creates a protected checkout link.

Required fields:

- Product name
- Product description
- Product image
- Price reference
- Final USDC amount
- Quantity
- Shipping notes
- Estimated shipping date
- Refund/return note

### 10.4 Manage Order

Seller can update:

- Diproses
- Dikemas
- Dikirim
- Tracking number
- Shipping courier
- Shipping proof image

### 10.5 Payout Setup

Seller chooses payout route:

- USDC Stellar Wallet
- XLM Stellar Wallet
- MoneyGram cash-out/off-ramp route

Seller should understand:

- USDC wallet payout is fastest and most direct.
- XLM payout may involve conversion rate/fees.
- MoneyGram payout depends on availability, cash-out route, fees, KYC, and partner integration level.

---

## 11. Admin Requirements

Admin capabilities:

- View all orders.
- Filter by status.
- View escrow status and tx hash.
- Review refund/help requests.
- Review buyer evidence.
- Review seller response and shipping proof.
- Approve refund.
- Approve release to seller.
- Mark payout as needs review.
- Apply seller Trust Profile penalty.
- Pause a suspicious order.
- Pause platform/contract in emergency if implemented.

Admin must not edit blockchain facts. Admin can only trigger valid contract actions or record off-chain decisions.

---

## 12. Trust Profile Requirements

Trust Profile is the buyer-facing reputation layer for sellers.

Metrics:

- Successful transaction count.
- Protected sales value.
- Completion rate.
- Refund rate.
- Average shipping time.
- Buyer rating.
- Account active since.
- Verification status.
- Recent completed orders.
- Issue resolution record.

Trust Profile penalties:

- Proven scam/fraud.
- False shipment proof.
- Repeated refund loss.
- Failure to respond.
- Unfulfilled orders.

User-facing wording must be simple. Avoid technical blockchain terminology in Trust Profile.

---

## 13. Stellar Ecosystem Usage

### 13.1 MVP Stellar Components

| Component                         | Usage                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Stellar Wallet                    | Buyer pays and seller receives funds.                                        |
| Freighter                         | Primary browser wallet for wallet connection and signing.                    |
| xBull                             | Alternative Stellar wallet.                                                  |
| Stellar Wallets Kit               | Wallet abstraction layer for Freighter and xBull.                            |
| USDC on Stellar                   | Main payment and escrow asset.                                               |
| Soroban Smart Contract            | Escrow logic for lock, release, and refund.                                  |
| Stellar Asset Contract / SAC      | Allows Soroban contract to interact with Stellar assets such as USDC.        |
| SEP-41 Token Interface            | Token interface implemented through SAC for contract-level asset operations. |
| Stellar RPC                       | Contract calls, event sync, transaction monitoring.                          |
| Stellar Explorer / Stellar Expert | Optional transaction proof link for users/admin.                             |

### 13.2 Recommended Stellar Standards

| Standard | Usage                               | Status            |
| -------- | ----------------------------------- | ----------------- |
| SEP-10   | Wallet-based authentication.        | Recommended.      |
| SEP-1    | stellar.toml domain identity.       | Recommended.      |
| SEP-7    | Payment/deeplink/QR wallet request. | Optional stretch. |

### 13.3 Future Anchor Standards

SEP-6, SEP-24, SEP-12, and SEP-38 are not part of MVP because Trustip does not process Rupiah-to-USDC conversion inside the app.

They become relevant if Trustip integrates a fiat anchor/on-ramp later.

| SEP    | Future use                                                 |
| ------ | ---------------------------------------------------------- |
| SEP-6  | Programmatic deposit/withdraw with anchor.                 |
| SEP-24 | Hosted deposit/withdraw UI through anchor.                 |
| SEP-12 | KYC data exchange with anchor.                             |
| SEP-38 | Quote/RFQ for fiat-to-crypto or crypto-to-fiat conversion. |

---

## 14. UX and Content Guidelines

### 14.1 Buyer-Facing Language

Use:

- Bayar
- Pesanan Aman
- Pembayaran Diterima
- Pesanan Diterima
- Ajukan Bantuan
- Ajukan Refund
- Riwayat Pesanan
- Bukti Transaksi
- Wallet Stellar
- Saldo Digital Dollar

Avoid:

- Locking escrow
- Settlement
- Soroban
- SEP
- Dispute
- Tx invoke
- Smart contract call
- DeFi

Technical details can be shown under advanced details or transaction proof.

### 14.2 Seller-Facing Language

Use:

- Buat Link Checkout
- Pesanan Masuk
- Pembayaran Aman
- Update Pengiriman
- Cara Terima Dana
- Cairkan lewat MoneyGram
- Riwayat Pencairan

Avoid exposing unnecessary technical details unless seller opens advanced payout detail.

### 14.3 Visual Direction

Trustip uses VOID Experience:

- Dark premium fintech style.
- Glass cards.
- Luminous border.
- Orbital escrow ring.
- Blue/cyan/purple glow.
- Emerald success glow.
- Red/orange warning glow.
- Payment protection animation.
- Shipping and proof timeline.

---

## 15. Data Requirements

Main data entities:

- users
- seller_profiles
- buyer_profiles
- wallet_connections
- checkout_links
- orders
- order_items
- payments
- escrows
- shipments
- refund_requests
- refund_evidence
- reviews
- trust_profiles
- trust_events
- seller_payout_methods
- payout_requests
- payout_transactions
- admin_actions

Important update in v1.1:

The database must support multi-route seller payout, including USDC wallet, XLM wallet, and MoneyGram cash-out/off-ramp route.

---

## 16. Key Acceptance Criteria

### Buyer Payment

- Buyer can connect Freighter or xBull.
- Buyer can pay with USDC on Stellar.
- Payment creates/updates escrow state.
- Transaction hash is recorded.
- Buyer sees Pesanan Aman after escrow is funded.

### Escrow

- Funds cannot be released before valid completion/admin decision.
- Release to seller works once.
- Refund to buyer works once.
- Double release and double refund are rejected.
- Contract status can be synced to backend.

### Seller Fulfillment

- Seller can view paid orders.
- Seller can update processing/packing/shipping status.
- Seller can input tracking number.
- Seller can upload shipping proof.

### Seller Payout

- Seller can configure payout method.
- USDC wallet payout is supported as primary route.
- XLM wallet payout can be flagged as stretch/optional.
- MoneyGram payout route is represented in product and data model.
- Payout status is tracked.

### Refund / Help

- Buyer can submit refund/help request.
- Buyer can upload evidence.
- Seller can respond.
- Admin can decide refund or release.
- Trust Profile updates after decision.

---

## 17. Risks and Concerns

| Risk                                               | Impact                               | Mitigation                                                                      |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Buyer unfamiliar with wallet/USDC                  | Lower adoption                       | Guided onboarding and Binance top-up guide.                                     |
| Binance network/fee changes                        | Top-up guide may become outdated     | Show warning and avoid hardcoded assumptions.                                   |
| Seller wants fiat payout                           | USDC wallet payout may not be enough | Provide MoneyGram off-ramp route and future bank payout.                        |
| MoneyGram integration access uncertain             | Integrated payout may be delayed     | Start with guided cash-out route; integrate API later.                          |
| FX volatility between IDR display and USDC payment | User confusion                       | State that final protected amount is in USDC.                                   |
| Contract bugs                                      | Fund safety risk                     | Keep contract minimal, test thoroughly, include emergency pause if possible.    |
| Refund abuse                                       | Seller risk                          | Require evidence, seller response, admin review, and Trust Profile logic.       |
| Regulatory/compliance uncertainty                  | Product risk                         | Avoid holding fiat in MVP; use external top-up providers and clear disclaimers. |

---

## 18. Roadmap

### Phase 1 - Hackathon MVP

- Seller checkout link.
- Buyer USDC payment through Freighter/xBull.
- Soroban escrow lock/release/refund.
- Binance top-up guide.
- Seller payout method setup.
- USDC wallet payout.
- MoneyGram payout route represented as off-ramp strategy.
- Refund/help flow.
- Trust Profile.

### Phase 2 - Enhanced Payout and Wallet UX

- XLM payout.
- Guided MoneyGram cash-out flow.
- SEP-10 wallet login.
- SEP-1 stellar.toml.
- SEP-7 wallet deeplink/payment request.
- Better wallet onboarding.

### Phase 3 - Production Integrations

- Integrated MoneyGram payout API/partner route.
- Binance Pay checkout.
- Local bank payout.
- Local payment rail/QRIS through regulated partner.
- Stellar anchor integration for fiat on/off-ramp if available.

---

## 19. Final Scope Lock

Trustip v1.1 is locked as:

```text
Buyer payment:
- Wallet Stellar Native
- Freighter + xBull
- USDC on Stellar
- Binance top-up guide

Escrow:
- Soroban USDC escrow
- lock, release, refund

Seller payout:
- USDC Stellar Wallet
- XLM route as stretch
- MoneyGram cash-out/off-ramp route

Future:
- Binance Pay
- integrated MoneyGram payout API
- local bank payout
- QRIS/local bank buyer payment
- Stellar anchor on/off-ramp
```

Trustip does not force automatic Rupiah-to-USDC conversion in MVP. The MVP introduces Web3 protected checkout using Stellar USDC while keeping the door open for stronger fiat/on-off ramp integrations later.
