# Trustip Escrow Contract

Rust Soroban smart contract that holds buyer USDC in escrow until an order is
released to the seller/payout recipient, refunded to the buyer, or cancelled.

The contract implements the Trustip v1.1 escrow state machine, authorization,
pause controls, TTL renewal, and two-step admin rotation.

## Required methods

- `__constructor`
- `initialize` (legacy guard; cannot mutate constructor-initialized state)
- `create_order`
- `fund_order`
- `release_to_recipient`
- `refund_to_buyer`
- `cancel_order`
- `pause_contract`
- `unpause_contract`
- `propose_admin`
- `accept_admin`
- `get_admin`
- `get_usdc_token`
- `get_order`

## Build & test

```bash
cd contracts/escrow
cargo test
stellar contract build
```

## Notes

- USDC on Stellar via Stellar Asset Contract (SAC) / SEP-41 token interface.
- Constructor arguments set the initial admin and USDC address atomically at
  deployment. The deploy identity must be the initial admin.
- Contract instance and persistent order entries renew to 30 days whenever
  they are touched and fall below seven days remaining.
- Admin rotation is two-step: the current admin proposes, then the new admin
  accepts. The old admin remains active until acceptance succeeds.
- Contract IDs must never be hardcoded in UI components; they are supplied via
  environment configuration.
