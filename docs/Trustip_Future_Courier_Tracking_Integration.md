# Trustip — Courier Tracking Integration (Future / Mainnet scope)

**Status:** Approved scope addition — **mainnet only**. Testnet stays MVP.
**Decided:** 2026-07-01
**Relates to:** PRD/ERD v1.1 shipment flow, default implementation order Phase 8
(Order shipment flow), Mainnet Readiness gate.

> This is an additive scope note. It does **not** modify the approved v1.1
> specs. Real courier-API tracking was previously marked "future"; it is now an
> approved feature **targeted at mainnet**.

---

## 1. Decision

| Network | Shipment tracking behavior                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| testnet | **MVP, unchanged.** Manual entry: seller types courier name + resi (`tracking_number` as text) and updates `shipments.status` by hand. No external API.      |
| mainnet | **Real courier API integration.** Live tracking status synced from a courier/logistics aggregator, surfaced to buyer/seller and used as supporting evidence. |

The feature is gated by a per-network flag so the same codebase runs manual on
testnet and integrated on mainnet:

```txt
NEXT_PUBLIC_ENABLE_COURIER_TRACKING=false   # testnet/local: off (manual MVP)
NEXT_PUBLIC_ENABLE_COURIER_TRACKING=true    # mainnet: on
COURIER_TRACKING_PROVIDER=biteship          # provider id
COURIER_TRACKING_API_KEY=...                # server-only secret, never client
COURIER_TRACKING_WEBHOOK_SECRET=...         # verify inbound webhooks
```

(Flag/env not added to `.env.example` yet — added when implementation starts.)

---

## 2. Non-negotiable security constraint

**A courier "delivered" status must NEVER auto-release escrow funds.**

- Couriers can mis-mark delivery; resi can be faked; "delivered" ≠ buyer
  actually received the correct item.
- Per Security & Risk Spec v1.1 §3/§8, funds release only from a verified
  decision. The **release gate stays buyer confirmation (or admin resolution)** —
  the same as MVP.
- Courier status is therefore:
  1. **Informational** — progress shown to buyer/seller in the UI.
  2. **Supporting evidence** — attached to dispute/refund review.

It strengthens the protected-checkout flow; it does not replace the release gate.
The on-chain flow (`fund_order` → buyer confirm → `release_to_recipient`) is
unchanged.

---

## 3. Design sketch (implement at/after mainnet hardening)

Reuse the existing worker pattern (`workers/escrow-event-indexer`,
`workers/payout-sync`):

- New worker **`workers/shipment-tracking-sync`**:
  - Prefer **webhook ingestion** (provider → Trustip endpoint), with
    **polling fallback** by `tracking_number` for providers/couriers without
    webhooks.
  - **Idempotent** updates (dedupe by provider event id / status+timestamp).
  - Map provider statuses → existing `shipment_status` enum
    (`processing | packed | shipped | delivered`); set `delivered_at`.
  - Persist raw provider payloads for audit; surface failures as retryable, not
    silent success.
- Webhook endpoint must **verify provider signature** (`COURIER_TRACKING_WEBHOOK_SECRET`)
  and be rate-limited.

### Proposed schema delta (future migration — NOT applied now)

Add to `shipments` (or a new `shipment_tracking_events` table for full history):

```txt
tracking_provider        text       -- e.g. 'biteship'
provider_tracking_id     text       -- provider's shipment/awb reference
tracking_status_raw      text       -- provider's raw status string
last_tracking_synced_at  timestamptz
last_tracking_payload    jsonb      -- last raw provider response (audit)
```

The existing `shipments.status` enum and the manual flow remain valid; integrated
mode just keeps them in sync automatically.

### Provider options (Indonesia)

Aggregators covering JNE / J&T / SiCepat / AnterAja / etc.:

- **Biteship**
- **RajaOngkir / Komerce**
- **Binderbyte**

Selection criteria: webhook support, coverage, rate limits, pricing, sandbox.

---

## 4. Phase placement & mainnet gate

- Builds **on top of** Phase 8 (Order shipment flow); do not start before the
  manual shipment flow exists.
- Enabled **only on mainnet**, after the contract mainnet-hardening items
  (TTL extension, multisig admin, constructor/atomic init).
- Add to the Mainnet Readiness checklist:
  - [ ] Courier provider integration tested in provider sandbox.
  - [ ] Webhook signature verification + rate limiting in place.
  - [ ] Courier "delivered" does NOT trigger auto-release (release gate intact).
  - [ ] Tracking secrets in server-only env, separated per network.

---

## 5. Open questions

- Which provider (and is a single aggregator enough for target couriers)?
- Webhook vs polling per provider; backfill/missed-event strategy.
- Cost model and rate limits at expected volume.
- How much raw tracking history to retain (privacy/PII minimization).
