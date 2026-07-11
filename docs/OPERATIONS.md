# Trustip v1.1 — Operations Guide (Phase 19)

Pure engineering runbook for running Trustip in production. Covers the
production-hardening surface added in Phase 19: middleware, rate limiting,
background workers, audit logging, observability, health checks, config
validation, key management, and disaster recovery.

---

## 1. Components

| Component | Where | Runtime |
|---|---|---|
| Web / API | `apps/web` | Next.js (Node route handlers + edge middleware) |
| Escrow Event Indexer + Reconciliation | `workers/escrow-event-indexer` | long-running Node process |
| Refund Review Worker | `workers/refund-review-sync` | disabled framework (v1.1) |
| Payout Sync Worker | `workers/payout-sync` | disabled framework (future) |
| Escrow contract | `contracts/escrow` | Soroban (Rust) |
| Database | Supabase Postgres | — |
| Rate-limit / queue store | Upstash Redis (REST) | — |

---

## 2. Configuration & Secrets

Config validation (`@trustip/config` → `validate.ts`) runs at worker start
(`assertProductionConfig()`) and is reported by `GET /api/ready`. **Development
is permissive; production fails closed.**

Required in production (any network):

- `SUPABASE_SERVICE_ROLE_KEY` — server/worker DB writes (bypasses RLS).
- `NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID` (or `SOROBAN_ESCROW_CONTRACT_ID`).
- `TRUSTIP_CHECKOUT_TOKEN_SECRET`, `TRUSTIP_WALLET_CHALLENGE_SECRET`.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

Additionally required on **mainnet**:

- `TRUSTIP_OPERATOR_SECRET_KEY` (or `STELLAR_OPERATOR_SECRET_KEY`).
- `NEXT_PUBLIC_USDC_ISSUER` (no fallback — must be explicit).
- `TRUSTIP_ALLOW_MAINNET_OPERATOR=true` **or** an approved signer strategy
  (`TRUSTIP_SIGNER_STRATEGY`), otherwise env-key signing is refused.

Proxy / IP trust (rate limiting):

- `TRUSTIP_TRUSTED_PROXY_HOPS` — number of trusted proxies/CDNs in front of the
  app (default `1`). The client IP is counted in from the **right** of
  `X-Forwarded-For` by this many hops, so a client-spoofed leftmost entry is
  ignored. Set this to match your actual edge topology.
- `TRUSTIP_CLIENT_IP_HEADER` — optional platform header carrying the true socket
  IP (`x-real-ip`, `fly-client-ip`, `cf-connecting-ip`); wins over XFF when set.

Secrets are never logged (the structured logger redacts secret-looking keys) and
never stored in the audit log (defensive key filter in `recordAuditEvent`).

### Secret rotation

1. Provision the new secret alongside the old (both accepted where the code
   reads `envAny(...)`).
2. Roll web + workers.
3. Remove the old secret.

Operator key rotation additionally requires updating the on-chain contract admin
(`initialize` sets it) — rotate the key, then transfer admin, then retire the old
key. Do this behind a contract `pause` if funds are in flight.

---

## 3. Middleware

`apps/web/middleware.ts` runs on `/api/:path*` only. It:

- rejects non-standard HTTP methods early (405);
- attaches `x-request-id` (reuses a sane upstream id, else mints one) and echoes
  it on the response — use it to correlate logs end-to-end;
- applies a coarse distributed rate limit per trusted client IP **when a shared
  store is configured**, fail-**open** (a Redis blip never 500s the API).

It does not do auth or business validation — those stay in the route handlers
(and the tight per-route limiters remain as defense-in-depth).

---

## 4. Rate Limiting

Two layers:

1. **Per-route, in-memory** (`@trustip/payments` `createInMemoryRateLimiter`) —
   unchanged, per-instance, synchronous. Fine-grained budgets per endpoint.
2. **Coarse, distributed** (`@trustip/config` `rate-limit-store.ts`) — async,
   Upstash-backed via REST (no `redis`/`ioredis` dependency), memory fallback in
   dev. Burst + sustained windows; returns `Retry-After`.

Configure Upstash with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
Without them, production runs with per-route limiters only (readiness reports the
queue as `degraded`).

---

## 5. Workers

### Escrow Event Indexer (+ Payment Reconciliation)

Loop (`INDEXER_POLL_MS`, default 30s):

1. **Index pass** — read escrow contract events from Soroban RPC starting at the
   durable checkpoint ledger, persist each idempotently
   (`blockchain_transactions` + `escrow_events`, keyed on `tx_hash`), advance the
   checkpoint. The boundary ledger is re-read each tick (idempotent) so no event
   is skipped.
2. **Reconciliation pass** (every `INDEXER_RECONCILE_EVERY` passes, default 4) —
   scan escrows that lag the chain and heal money-state via the idempotent,
   status-guarded RPCs `confirm_funded_payment` / `confirm_released_payment`.
   Each real repair emits a `worker.recovery` audit event.

Env: `INDEXER_POLL_MS`, `INDEXER_RECONCILE_EVERY`, `INDEXER_START_LOOKBACK`
(cold-start ledger lookback when no checkpoint exists).

Lifecycle: `SIGTERM`/`SIGINT` → graceful stop after the current pass. Any pass
failure is logged and retried next tick without advancing the checkpoint.

### Refund Review / Payout Sync

Explicitly **disabled** (features not in v1.1). They log their disabled state and
exit rather than faking work. Enable with `TRUSTIP_REFUND_WORKER_ENABLED=true` /
`TRUSTIP_PAYOUT_WORKER_ENABLED=true` **after** implementing their bodies.

---

## 6. Recovery & Replay

Everything the workers write is idempotent, so recovery is "just restart":

| Failure | Behavior |
|---|---|
| RPC / Supabase timeout | pass fails, logged, retried next tick; checkpoint not advanced |
| Duplicate event | `on conflict (tx_hash) do nothing` → no-op |
| Process restart | resumes from the durable checkpoint |
| Partial write | reconciliation heals via `confirm_*` RPCs (status-guarded) |
| Crash **after** chain success, **before** DB write | indexer records the tx; reconciliation applies the money-state transition |
| Crash **before** DB write of checkpoint | boundary ledger re-read next tick (idempotent) |

**Replay from a ledger:** set `indexer_checkpoints.last_ledger` for
`(escrow-event-indexer, <network>)` to the desired ledger and restart. Re-indexing
is safe (idempotent). To replay from scratch, set it to `0` (cold start applies
`INDEXER_START_LOOKBACK`).

Reconciliation never moves a row backwards or overwrites newer state — worst case
it is a no-op, so it is always safe to run.

---

## 7. Audit Log

Table `audit_logs` (see `supabase/migrations/...init_schema.sql`). Written via
`recordAuditEvent(client, event)`:

| Field | Source |
|---|---|
| `created_at` | timestamp |
| `actor_user_id`, `actor_role` | actor (`buyer`/`seller`/`admin`/`system`) |
| `action` | canonical name (`release.completed`, `worker.recovery`, …) |
| `entity_type`, `entity_id` | order (or other entity) |
| `metadata` | wallet, `requestId`, `reason`, `result`, tx hash, … (secrets stripped) |

Audit writes are best-effort: a failed write is logged and swallowed so it can
never fail the audited action. **Alert on audit-write-failure log lines.**

Wired today: `worker.recovery` (reconciliation repairs), `admin.action`
(observed contract pause/unpause). Recommended additional wiring (route/service
call sites): `order.create`, `checkout.token_issued`, `payment.submitted`,
`payment.confirmed`, `escrow.locked`, `shipment.updated`, `buyer.confirmed`,
`release.requested`, `release.completed`, `verification.failed`.

---

## 8. Observability

Structured JSON logs (`@trustip/config` `logger.ts`), one line per event:
`ts`, `severity`, `message`, plus fields (`requestId`, `route`, `method`,
`durationMs`, `result`, `errorClass`). Secret-looking keys are redacted.

`errorClass` buckets causes for dashboards: `user` / `validation` / `business` /
`chain` / `database` / `unexpected`. OpenTelemetry is **not** wired — the logger
shape is the seam an OTel exporter plugs into later without touching call sites.

---

## 9. Health Checks

| Endpoint | Purpose | Use |
|---|---|---|
| `GET /api/health` | liveness (process up, no deps) | LB / `livenessProbe` |
| `GET /api/liveness` | alias of `/api/health` | k8s `livenessProbe` |
| `GET /api/ready` | readiness (database, RPC, workers, queue, config) | k8s `readinessProbe` |

`/api/ready` returns `503` when a **hard** dependency (database, RPC, config) is
down; a degraded worker/queue is reported but does not fail readiness. No secrets
in any payload.

---

## 10. Key Management

Signing is behind the `OperatorSigner` interface (`@trustip/stellar`
`operator.ts`). `createOperatorSigner(strategy)` dispatches on
`TRUSTIP_SIGNER_STRATEGY` (default `env` → `EnvKeypairOperatorSigner`). Future
strategies (`kms`, `hsm`, `multisig`, `vault`) are named and fail closed until
implemented — each is a new class implementing `signXdr` (async, so a remote
signer fits). No KMS/HSM is implemented in this phase by design.

Mainnet env-key signing is refused unless `TRUSTIP_ALLOW_MAINNET_OPERATOR=true`.

---

## 11. Deployment

1. Apply migrations (`supabase migration up`) — includes `indexer_checkpoints`.
2. Deploy web (Node runtime for `/api`, edge for middleware).
3. Deploy the escrow-event-indexer worker as a single long-running instance
   (it self-serializes via the checkpoint; do not run multiple copies against the
   same `(worker, network)` unless you shard by contract).
4. Verify `GET /api/ready` returns `ready`.

---

## 12. Mainnet Readiness Checklist

- [ ] `assertProductionConfig()` passes (no `/api/ready` config problems).
- [ ] `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`, USDC issuer explicit, USDC config verified.
- [ ] Operator signer configured; mainnet env-signing explicitly allowed or KMS wired.
- [ ] Escrow contract deployed + `initialize`d; contract id in env (not in UI).
- [ ] Upstash configured; `TRUSTIP_TRUSTED_PROXY_HOPS` matches edge topology.
- [ ] Indexer running; checkpoint advancing; `/api/ready` workers `ok`.
- [ ] RLS enabled on all exposed tables; service-role grants applied.
- [ ] Emergency `pause` tested; release/refund tested on testnet.
- [ ] Audit-write-failure and worker-stall alerts configured.
- [ ] No testnet-only values, no fake payment flow, no simulate button.

---

## 13. Disaster Recovery

| Scenario | Action |
|---|---|
| Indexer stuck (`/api/ready` workers `stale`) | inspect logs; restart worker — resumes from checkpoint |
| Suspected missed events | set `indexer_checkpoints.last_ledger` back, restart (idempotent replay) |
| Money-state drift | reconciliation heals automatically each pass; force by restarting worker |
| Redis outage | rate limiting fails open (API stays up); per-route limiters remain |
| RPC outage | passes fail + retry; `/api/ready` reports RPC `down` (503) |
| Compromised operator key | `pause` contract, rotate key + admin, unpause |
| Bad deploy | roll back web/worker; state is durable in Postgres + on-chain |
