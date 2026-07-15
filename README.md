# Trustip v1.1 Monorepo

Trustip is a **Stellar-native protected checkout app** for social commerce. Buyer payments use **USDC on Stellar** through native Stellar wallets. Funds are locked in a **Soroban escrow contract** until the order is completed, released, or refunded.

## Repository Structure

```txt
trustip/
├── apps/
│   └── web/                    # Next.js App Router Web Application
│
├── packages/
│   ├── ui/                     # Shared UI component primitives
│   ├── database/               # Supabase database types, helpers, and queries
│   ├── stellar/                # Stellar & Soroban helper functions and configuration
│   ├── validators/             # Shared Zod validation schemas
│   └── config/                 # Monorepo environment and config variables
│
├── contracts/
│   └── escrow/                 # Rust Soroban smart contract for escrow protection
│
├── workers/
│   ├── escrow-event-indexer/   # Listens for and syncs Soroban escrow contract events
│   ├── payout-sync/            # Syncs seller multi-route payouts
│   └── refund-review-sync/     # Syncs refund disputes and admin review timelines
│
├── supabase/
│   ├── migrations/             # SQL migrations for PostgreSQL
│   ├── policies/               # Row-Level Security (RLS) policies
│   └── seed.sql                # Initial database seed values
│
└── scripts/                    # Deploy, typegen, and management helper scripts
```

## Setup & Execution

### Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: Pinned to 9.1.0
- **Rust & Cargo**: For Soroban smart contracts
- **Stellar CLI**: For compiling and deploying contracts

### Commands

- `pnpm install`: Install dependencies and link packages
- `pnpm dev`: Run all applications and workers in development mode
- `pnpm build`: Build all workspace packages and apps
- `pnpm typecheck`: Run typescript compilations checks
- `pnpm test`: Run unit tests
- `pnpm format`: Format codebase with Prettier
