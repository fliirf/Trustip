# Trustip Deployment & Environment Setup Guide v1.1

**Project:** Trustip v1.1 - Stellar-native protected checkout  
**Scope:** Local development, testnet deployment, mainnet readiness, Vercel/Supabase setup, Soroban contract deployment, and operational rollback.  
**Current product rule:** Buyer payment uses Wallet Stellar Native with USDC. Binance is a guided top-up route. Seller payout supports USDC wallet, XLM wallet, and MoneyGram cash-out/off-ramp route.

---

## 1. Purpose

This guide defines how Trustip v1.1 should be installed, configured, deployed, and promoted from local development to testnet and mainnet. It exists so developers and AI agents do not invent deployment steps, hardcode contract IDs, expose secrets, or mix demo/testnet configuration into production.

The guide covers:

- Local development setup.
- Supabase database and storage setup.
- Soroban escrow contract build, test, and deployment.
- Stellar network configuration for testnet and mainnet.
- Vercel deployment and environment variables.
- Worker/indexer deployment.
- Mainnet readiness checklist.
- Emergency rollback and pause procedure.

---

## 2. Environment Strategy

Trustip must separate environments clearly. Do not share database rows, contract IDs, private keys, RPC endpoints, or webhook secrets across environments.

| Environment | Purpose                       | Network                          | Database                 | Notes                                                                            |
| ----------- | ----------------------------- | -------------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Local       | Developer build and debugging | Local sandbox or Stellar testnet | Local Supabase           | Safe to reset. No production secrets.                                            |
| Preview     | Pull request / branch testing | Stellar testnet                  | Supabase preview/staging | Used for UI, API, wallet, and escrow QA.                                         |
| Staging     | Full pre-mainnet rehearsal    | Stellar testnet                  | Supabase staging         | Must mirror production config as closely as possible.                            |
| Production  | Live app                      | Stellar mainnet                  | Supabase production      | Requires final contract IDs, RLS, admin controls, monitoring, and rollback plan. |

Rule: local and preview can be reset. staging can be reset only with approval. production cannot be reset manually.

---

## 3. Required Tools

### 3.1 Core Web Runtime

| Tool                                       | Required Version / Rule           | Purpose                                     |
| ------------------------------------------ | --------------------------------- | ------------------------------------------- |
| Node.js                                    | Node 24 LTS recommended           | Runs Next.js backend, scripts, and tooling. |
| pnpm                                       | Pinned through Corepack           | Monorepo package manager.                   |
| Git                                        | Latest stable                     | Version control.                            |
| Docker Desktop / compatible Docker runtime | Required for Supabase local stack | Local database/auth/storage stack.          |

Node.js production apps should use an Active LTS or Maintenance LTS release. Trustip standardizes on Node 24 LTS for v1.1.

### 3.2 Supabase Tooling

| Tool               | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| Supabase CLI       | Local Supabase stack, migrations, seeds, and type generation.       |
| Supabase Dashboard | Production database, RLS, storage, secrets, and auth configuration. |

The Supabase CLI is used for local development with `supabase init` and `supabase start`.

### 3.3 Stellar / Soroban Tooling

| Tool                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Rust toolchain       | Required to write and compile Soroban smart contracts.               |
| wasm32v1-none target | Required WebAssembly target for Soroban contracts.                   |
| Stellar CLI          | Build, deploy, invoke, and inspect Soroban contracts.                |
| Stellar RPC endpoint | Submit transactions, query contract state, and sync contract events. |
| Freighter wallet     | Primary browser wallet for buyer/seller testing.                     |
| xBull wallet         | Secondary browser wallet for buyer/seller testing.                   |

Stellar smart contracts are written in Rust. The Trustip escrow contract must live under `contracts/escrow` and must not be implemented as database-only escrow.

---

## 4. Repository Setup

Clone the repository and install dependencies:

```bash
git clone <TRUSTIP_REPO_URL>
cd trustip
corepack enable pnpm
pnpm install
```

Recommended project structure:

```text
trustip/
├── apps/web
├── contracts/escrow
├── packages/ui
├── packages/stellar
├── packages/database
├── packages/validators
├── workers/escrow-event-indexer
├── workers/payout-sync
├── supabase/migrations
├── scripts
└── docs
```

Run type checks early:

```bash
pnpm typecheck
pnpm lint
```

---

## 5. Environment Variables

`.env.example` is the canonical inventory. Do not add aliases per deployment
platform. Public identifiers and URLs may use `NEXT_PUBLIC_`; secrets never may.

### 5.1 Canonical Public Variables

```env
NEXT_PUBLIC_APP_URL=https://trustip.example
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=<selected_mainnet_rpc_provider>
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=<mainnet_escrow_contract_id>
NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
NEXT_PUBLIC_USDC_CONTRACT_ID=<mainnet_usdc_sac_contract_id>
NEXT_PUBLIC_SUPABASE_URL=<production_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production_anon_key>
NEXT_PUBLIC_ANCHOR_DOMAIN=<approved_mainnet_anchor_domain>
```

SDF provides Testnet RPC but not a public Mainnet RPC. Select a Mainnet provider
from the [official Stellar provider list](https://developers.stellar.org/docs/data/apis/rpc/providers);
do not retain the Testnet endpoint. Verify the issuer against
[Circle's USDC address registry](https://developers.circle.com/stablecoins/usdc-contract-addresses).

### 5.2 Canonical Server-Only Variables

```env
STELLAR_NETWORK=mainnet
SUPABASE_SERVICE_ROLE_KEY=<production_service_role_key>
TRUSTIP_SIGNER_STRATEGY=env
TRUSTIP_OPERATOR_SECRET_KEY=<mainnet_operator_secret_seed>
TRUSTIP_ALLOW_MAINNET_OPERATOR=true
PAYMENT_ATTEMPT_SECRET=<minimum_32_random_characters>
TRUSTIP_CHECKOUT_TOKEN_SECRET=<minimum_32_random_characters>
TRUSTIP_WALLET_CHALLENGE_SECRET=<minimum_32_random_characters>
TRUSTIP_SEP10_JWT_SECRET=<minimum_32_random_characters>
UPSTASH_REDIS_REST_URL=<production_upstash_url>
UPSTASH_REDIS_REST_TOKEN=<production_upstash_token>
```

`STELLAR_NETWORK` must match `NEXT_PUBLIC_STELLAR_NETWORK`. Network passphrases
are derived in code and must not be configured manually. The service-role key
and operator seed belong only in the deployment platform's encrypted secret
store, never GitHub variables, browser env, logs, or files in the repository.

### 5.3 Worker and Deployment Variables

```env
INDEXER_POLL_MS=30000
INDEXER_RECONCILE_EVERY=4
INDEXER_START_LOOKBACK=17280
TRUSTIP_PAYOUT_WORKER_ENABLED=false
TRUSTIP_REFUND_WORKER_ENABLED=false
STELLAR_DEPLOY_IDENTITY=<stellar_cli_identity_name>
```

Do not enable the payout/refund workers until their implementations exist; they
intentionally fail if enabled today.

### 5.4 Validation Gates

```bash
# No network access: required before production build/deploy.
pnpm verify:env:production

# Network access: run after the contract exists, before traffic is enabled.
pnpm verify:env:onchain
```

The static gate rejects missing values, placeholders, old aliases, invalid
StrKeys, frontend/backend network mismatch, endpoint mismatch, invalid Circle
USDC issuer/SAC pairing, short application secrets, and missing Supabase keys.
The on-chain gate confirms RPC and Horizon passphrases, contract availability,
contract admin/operator match, and stored USDC token/environment match.

---

## 6. Local Supabase Setup

Initialize and start Supabase locally:

```bash
npx supabase init
npx supabase start
```

Apply pending migrations incrementally (preserves existing local data):

```bash
npx supabase migration up --local
```

Generate TypeScript types:

```bash
npx supabase gen types typescript --local > packages/database/src/supabase.types.ts
```

Storage buckets required:

| Bucket          | Purpose                      | Access Rule                                     |
| --------------- | ---------------------------- | ----------------------------------------------- |
| refund-evidence | Buyer/seller evidence files  | Private, signed URL only.                       |
| shipment-proof  | Seller shipment proof photos | Private, role-scoped access.                    |
| profile-assets  | Seller profile images        | Public or signed URL based on product decision. |

RLS must be enabled for tables in exposed schemas. Service role key may only be used on the server side.

---

## 7. Soroban Contract Setup

### 7.1 Install Rust and Stellar CLI

Install Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable
rustup target add wasm32v1-none
```

Install Stellar CLI:

```bash
curl -fsSL https://github.com/stellar/stellar-cli/raw/main/install.sh | sh
stellar --version
```

Windows developers can use Windows Terminal or WSL to reduce CLI rendering and build issues.

### 7.2 Build the Escrow Contract

```bash
cd contracts/escrow
cargo test
stellar contract build
```

Expected output:

```text
contracts/escrow/target/wasm32v1-none/release/trustip_escrow.wasm
```

The contract must support:

```text
__constructor
initialize (legacy guard only)
create_order
fund_order
release_to_recipient
refund_to_buyer
pause_contract
unpause_contract
propose_admin
accept_admin
get_admin
get_usdc_token
get_order
```

### 7.3 Deploy to Testnet

Generate or configure a deployer identity:

```bash
stellar keys generate trustip-deployer --network testnet
stellar keys address trustip-deployer
```

Fund the testnet account:

```bash
stellar keys fund trustip-deployer --network testnet
```

Deploy the escrow contract:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/trustip_escrow.wasm \
  --source trustip-deployer \
  --network testnet \
  -- \
  --admin "$(stellar keys address trustip-deployer)" \
  --usdc_token <TESTNET_USDC_CONTRACT_ID>
```

The constructor runs in the same transaction as deployment. The deploy identity
must be the initial admin; this removes the uninitialized-contract takeover
window. Use `scripts/deploy-contract.ts` for the same atomic flow.

Save the returned contract ID into:

```text
NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID
```

### 7.4 Rotate the Initial Admin When Needed

```bash
stellar contract invoke \
  --id <ESCROW_CONTRACT_ID> \
  --source trustip-deployer \
  --network testnet \
  -- propose_admin \
  --admin "$(stellar keys address trustip-deployer)" \
  --new_admin <NEW_ADMIN_PUBLIC_KEY>

stellar contract invoke \
  --id <ESCROW_CONTRACT_ID> \
  --source <NEW_ADMIN_IDENTITY> \
  --network testnet \
  -- accept_admin \
  --new_admin <NEW_ADMIN_PUBLIC_KEY>
```

Verify `get_admin` before retiring the old key. Contract instance and order TTLs
renew to 30 days when touched below seven days remaining; monitor TTL on
low-traffic deployments and submit an extension transaction before archival.

---

## 8. Stellar Network and USDC Configuration

Trustip v1.1 must treat testnet and mainnet as separate deployments.

| Config          | Testnet            | Mainnet                |
| --------------- | ------------------ | ---------------------- |
| Network         | Stellar testnet    | Stellar public network |
| Payment asset   | Testnet USDC/SAC   | Mainnet USDC/SAC       |
| Wallets         | Testnet mode       | Mainnet mode           |
| Escrow contract | Testnet deployment | Mainnet deployment     |
| Data            | Staging Supabase   | Production Supabase    |

Frontend must block payment if:

- Wallet is connected to the wrong network.
- Buyer has insufficient USDC.
- Buyer lacks the required trustline or token access path.
- Escrow contract ID is missing.
- USDC contract ID does not match the current network.

---

## 9. Run the App Locally

From the repository root:

```bash
pnpm dev
```

Expected local services:

| Service            | Expected URL / Command       |
| ------------------ | ---------------------------- |
| Web app            | http://localhost:3000        |
| Supabase Studio    | From `supabase start` output |
| Escrow indexer     | `pnpm worker:escrow`         |
| Payout sync worker | `pnpm worker:payout`         |

Recommended local test flow:

```text
1. Open seller dashboard.
2. Create seller profile.
3. Connect seller wallet.
4. Create checkout link.
5. Open checkout as buyer.
6. Connect Freighter or xBull.
7. Pay USDC on testnet.
8. Confirm escrow funded.
9. Update shipment.
10. Confirm order received.
11. Release funds to seller.
12. Confirm tx hash and database status.
```

---

## 10. Worker and Indexer Setup

Trustip must not depend on Stellar RPC as a long-term historical database. RPC is used for transaction submission, simulation, state checks, and event sync. Trustip stores its own canonical app history in Supabase.

Workers required:

| Worker               | Purpose                                      | Required for MVP? |
| -------------------- | -------------------------------------------- | ----------------- |
| escrow-event-indexer | Sync escrow contract events into Supabase    | Yes               |
| payout-sync          | Track USDC/XLM/MoneyGram payout status       | Yes               |
| refund-decision-sync | Optional admin/refund review helper          | Optional          |
| stale-order-monitor  | Mark overdue orders and surface admin alerts | Optional          |

Worker rules:

- Workers must be idempotent.
- Workers must store last processed ledger/checkpoint.
- Workers must retry safely.
- Workers must never execute release/refund twice.
- Workers must write to `blockchain_transactions`, `escrow_events`, and `payout_transactions`.

Local run example:

```bash
pnpm worker:escrow
pnpm worker:payout
```

Production options:

```text
MVP: Vercel Cron / Supabase scheduled function.
Production: dedicated Node.js worker with queue or external scheduler.
```

---

## 11. Vercel Deployment

### 11.1 Project Setup

1. Connect Git repository to Vercel.
2. Keep the repository root so workspace packages and `scripts/verify-env.ts`
   are available.
3. Use `pnpm verify:env:production && pnpm --filter web build` as the production
   build command.
4. Add environment variables for Preview and Production separately.
5. Deploy Preview first.
6. Run QA checklist on Preview.
7. Promote to Production only after approval.

### 11.2 Recommended Commands

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

### 11.3 Vercel Environment Policy

Vercel environment variables are configured outside source code and can differ by environment. Use this separation:

| Vercel Environment | Stellar Network | Supabase Project    | Contract               |
| ------------------ | --------------- | ------------------- | ---------------------- |
| Development        | Testnet/local   | Local Supabase      | Local/testnet contract |
| Preview            | Testnet         | Supabase staging    | Testnet contract       |
| Production         | Mainnet         | Supabase production | Mainnet contract       |

Never add service role keys to client-exposed variables.

---

## 12. Production Supabase Setup

Production setup steps:

```text
1. Create Supabase production project.
2. Apply migrations from repository.
3. Enable RLS on all app tables in public schema.
4. Create storage buckets.
5. Apply storage policies.
6. Create admin allowlist or admin role policy.
7. Disable unsafe seed/demo data.
8. Generate production database types after schema finalization.
```

Required checks:

```text
- Buyer cannot read other buyers' orders.
- Seller cannot read other sellers' orders.
- Seller cannot manually mark payout as completed.
- Buyer cannot release funds directly through database update.
- Admin-only endpoints require server-side authorization.
- Evidence files are private or signed URL only.
```

---

## 13. Mainnet Deployment Procedure

Mainnet deployment must happen only after testnet acceptance criteria pass.

### 13.1 Pre-Mainnet Gate

Do not deploy to mainnet unless all items are true:

```text
[ ] PRD v1.1 scope is frozen.
[ ] ERD v1.1 migrations are applied and reviewed.
[ ] API & Soroban Contract Spec v1.1 is implemented.
[ ] Security & Risk Spec v1.1 critical issues are resolved.
[ ] Testing & QA Checklist v1.1 passes on testnet.
[ ] Contract has been tested for release/refund/double-release/double-refund.
[ ] Admin pause works.
[ ] RLS is enabled and tested.
[ ] No QRIS, bank transfer, or fake payment simulation is present.
[ ] Contract IDs and USDC IDs are network-specific.
[ ] Private keys are not stored in frontend env variables.
[ ] Production Supabase and Vercel environments are separate from staging.
[ ] `pnpm verify:env:production` passes using the production secret store.
```

### 13.2 Mainnet Contract Deploy

The deployment operator must create and fund the Mainnet CLI identity outside
the repository, set the canonical environment variables in the deployment
secret store, and run `scripts/deploy-contract.ts`. The script requires an
explicit `STELLAR_NETWORK`, validates the USDC contract ID, checks the frontend
network if present, and deploys with constructor arguments atomically through
`pnpm deploy:contract`.

After deployment:

```text
1. Save the contract ID as `NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID`.
2. Save deployment tx hash in deployment log.
3. Run `pnpm verify:env:onchain` and resolve every failure.
4. Verify contract on Stellar explorer/lab.
5. Run one separately approved small Mainnet smoke test.
6. Confirm event indexer syncs the smoke test.
7. Confirm database status matches on-chain status.
```

---

## 14. Binance and MoneyGram Configuration

### 14.1 Binance Top-Up Guide

For v1.1, Binance is a guided top-up route, not an automated payment processor.

Rules:

```text
- Trustip does not pull funds from buyer Binance accounts.
- Trustip does not auto-convert Rupiah to USDC.
- The guide must tell users to verify the Stellar network before withdrawal.
- Binance Pay is not configured or implemented.
```

### 14.2 MoneyGram Seller Payout Route

MoneyGram is used as seller off-ramp/cash-out route, not buyer checkout rail.

No MoneyGram API environment variable is active in v1.1. Add credentials only
when an actual reviewed partner integration exists.

Route stages:

| Stage           | Description                                                                    |
| --------------- | ------------------------------------------------------------------------------ |
| Guided          | Seller receives USDC and follows MoneyGram-compatible cash-out route manually. |
| Semi-integrated | Trustip records MoneyGram reference/status manually or through ops.            |
| Integrated      | Future API/partner integration handles payout status automatically.            |

MVP must not pretend that MoneyGram payout is fully automated if partner/API access is not available.

---

## 15. CI/CD Checks

Every pull request should run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo test --manifest-path contracts/escrow/Cargo.toml
```

The configured production deployment environment must additionally run
`pnpm verify:env:production`. Run `pnpm verify:env:onchain` only after the target
contract has been deployed; neither command performs deployment.

### 15.1 GitHub Environment Handoff

Create a protected GitHub Environment named `production`. Store public URLs,
network names, issuer, and contract IDs as environment variables. Store the
Supabase service-role key, operator seed, HMAC/JWT secrets, and Upstash token as
encrypted environment secrets. Require reviewer approval and never expose a
secret through a `NEXT_PUBLIC_` name. A deployment workflow should run the
static gate before build and the on-chain gate before enabling traffic.

Recommended deployment gates:

```text
- No TypeScript errors.
- No lint errors.
- Rust contract tests pass.
- Supabase migration compiles.
- No forbidden feature strings in UI: QRIS, bank transfer, Add Balance, IDRX, demo payment.
- No server secrets in client bundle.
- Build succeeds on Vercel Preview.
```

---

## 16. Emergency Rollback and Pause Plan

If a critical issue occurs:

### 16.1 Immediate Actions

```text
1. Pause Soroban contract if contract-level risk exists.
2. Disable payout execution routes.
3. Disable new checkout link creation if needed.
4. Show maintenance banner.
5. Stop workers if they are causing duplicate sync or payout errors.
6. Preserve logs and transaction hashes.
```

### 16.2 Database and App Rollback

```text
1. Revert Vercel to previous stable deployment.
2. Do not revert production database blindly.
3. Create DB backup before manual fixes.
4. Reconcile blockchain_transactions against on-chain tx hashes.
5. Re-run indexer from last safe checkpoint.
```

### 16.3 Contract Rollback Reality

Smart contracts are not rolled back like web apps. If a deployed contract has a critical flaw:

```text
1. Pause old contract if possible.
2. Deploy patched contract.
3. Update production env contract ID only after migration plan is ready.
4. Keep old order records linked to old contract ID.
5. Do not mix old and new contract orders without version field.
```

---

## 17. Deployment Logs

Every deployment must be recorded.

| Field              | Example           |
| ------------------ | ----------------- |
| Date               | 2026-06-30        |
| Version            | Trustip v1.1      |
| Environment        | Testnet / Mainnet |
| Contract ID        | `<contract_id>`   |
| WASM hash          | `<hash>`          |
| Deployer           | `<public_key>`    |
| Deployment tx hash | `<tx_hash>`       |
| App deployment URL | `<vercel_url>`    |
| Supabase project   | `<project_ref>`   |
| Notes              | `<summary>`       |

Store deployment logs in:

```text
docs/deployment-logs/
```

---

## 18. Final Mainnet Readiness Checklist

```text
[ ] Mainnet env vars configured in Vercel Production only.
[ ] Preview still points to testnet.
[ ] Supabase production RLS enabled.
[ ] Storage buckets private where required.
[ ] Freighter and xBull mainnet wallet flow tested.
[ ] Buyer payment uses USDC on Stellar only.
[ ] Binance remains guided top-up only.
[ ] MoneyGram remains seller payout/off-ramp route.
[ ] Soroban escrow contract deployed and initialized.
[ ] USDC contract ID matches mainnet asset contract.
[ ] Contract pause tested.
[ ] Release/refund tested with small amount.
[ ] Worker/indexer synced smoke test events.
[ ] Admin account configured.
[ ] Emergency pause and payout-disable procedure documented.
[ ] No demo payment simulator exists in production UI.
```

---

## 19. Official Reference Sources

The following official references were used to align this setup guide:

- Node.js Releases: https://nodejs.org/en/about/previous-releases
- Supabase CLI: https://supabase.com/docs/guides/local-development/cli/getting-started
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Stellar Smart Contract Setup: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
- Stellar CLI Manual: https://developers.stellar.org/docs/tools/cli/stellar-cli
- Stellar RPC: https://developers.stellar.org/docs/data/apis/rpc
- Stellar Wallet Integration: https://developers.stellar.org/docs/tools/developer-tools/wallets
- pnpm Installation: https://pnpm.io/installation

---

## 20. Short Summary

Trustip v1.1 deployment uses Node.js 24 LTS, pnpm, Supabase, Vercel, Rust, Stellar CLI, Stellar RPC, and a Rust Soroban escrow contract. Buyer payment stays USDC-first through Freighter/xBull. Binance is only a top-up guide. MoneyGram is a seller payout/off-ramp route. Production deployment requires strict separation between testnet and mainnet, network-specific contract IDs, RLS enforcement, worker/indexer reliability, and a contract pause plan.
