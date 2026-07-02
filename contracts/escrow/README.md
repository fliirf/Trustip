# Trustip Escrow Contract

Rust Soroban smart contract that holds buyer USDC in escrow until an order is
released to the seller/payout recipient, refunded to the buyer, or cancelled.

> **Status:** Phase 0 skeleton. Method bodies are placeholders. Real escrow
> logic (funding, release/refund authorization, double-spend prevention,
> pause/unpause, events) is implemented in Phase 3.

## Required methods

- `initialize`
- `create_order`
- `fund_order`
- `release_to_recipient`
- `refund_to_buyer`
- `cancel_order`
- `pause_contract`
- `unpause_contract`
- `get_order`

## Build & test

```bash
cd contracts/escrow
cargo test
stellar contract build
```

## Notes

- USDC on Stellar via Stellar Asset Contract (SAC) / SEP-41 token interface.
- Contract IDs must never be hardcoded in UI components; they are supplied via
  environment configuration.
