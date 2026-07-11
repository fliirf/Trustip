/**
 * Startup configuration validation (Part 7). Development stays permissive so a
 * contributor can `pnpm dev` without a full secret set; production/mainnet FAIL
 * CLOSED — a missing operator key, secret, Redis config, or USDC issuer refuses
 * startup instead of silently falling back to an unsafe default. Only variable
 * NAMES ever appear in the error; values are never read into the message.
 */
import { STELLAR_NETWORK } from "./index.js";

export interface ConfigProblem {
  key: string;
  message: string;
}

function present(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

function presentAny(...names: string[]): boolean {
  return names.some(present);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Collect (do not throw) every production config problem. Returns [] in
 * non-production so dev never trips. Used by `assertProductionConfig` and by the
 * `/ready` health endpoint to report readiness without crashing.
 */
export function collectConfigProblems(): ConfigProblem[] {
  if (!isProduction()) return [];
  const problems: ConfigProblem[] = [];
  const need = (name: string, hint: string, ok = present(name)) => {
    if (!ok) problems.push({ key: name, message: hint });
  };

  // Network must be one of the two supported values.
  if (STELLAR_NETWORK !== "testnet" && STELLAR_NETWORK !== "mainnet") {
    problems.push({
      key: "NEXT_PUBLIC_STELLAR_NETWORK",
      message: `invalid network "${STELLAR_NETWORK}" (expected testnet|mainnet)`,
    });
  }

  // Core service dependencies (every production deployment).
  need("SUPABASE_SERVICE_ROLE_KEY", "service-role key required to write escrow/payment state");
  need(
    "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
    "deployed escrow contract id required",
    presentAny("NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID", "SOROBAN_ESCROW_CONTRACT_ID"),
  );

  // Signing secrets (guest checkout + wallet verification fail closed without them).
  need("TRUSTIP_CHECKOUT_TOKEN_SECRET", "checkout token secret required (guest checkout)");
  need("TRUSTIP_WALLET_CHALLENGE_SECRET", "wallet challenge secret required (seller verify)");

  // Distributed rate limiting (per-instance memory limiter is not enough across replicas).
  need(
    "UPSTASH_REDIS_REST_URL",
    "distributed rate-limit store required in production",
    presentAny("UPSTASH_REDIS_REST_URL"),
  );
  need("UPSTASH_REDIS_REST_TOKEN", "distributed rate-limit token required in production");

  // Mainnet raises the bar: real money, so the operator signer + USDC issuer are hard requirements.
  if (STELLAR_NETWORK === "mainnet") {
    need(
      "TRUSTIP_OPERATOR_SECRET_KEY",
      "operator signer secret required on mainnet",
      presentAny("TRUSTIP_OPERATOR_SECRET_KEY", "STELLAR_OPERATOR_SECRET_KEY"),
    );
    need("NEXT_PUBLIC_USDC_ISSUER", "mainnet USDC issuer must be explicit (no fallback)");
    if (
      presentAny("TRUSTIP_OPERATOR_SECRET_KEY", "STELLAR_OPERATOR_SECRET_KEY") &&
      (process.env.TRUSTIP_ALLOW_MAINNET_OPERATOR || "").toLowerCase() !== "true"
    ) {
      problems.push({
        key: "TRUSTIP_ALLOW_MAINNET_OPERATOR",
        message:
          "env-secret operator signing on mainnet must be explicitly enabled (set to 'true') or replaced by an approved signer",
      });
    }
  }

  return problems;
}

/** Throw if production config is incomplete. Call at process/route bootstrap. */
export function assertProductionConfig(): void {
  const problems = collectConfigProblems();
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  - ${p.key}: ${p.message}`).join("\n");
  throw new Error(`Refusing to start: production configuration is incomplete\n${lines}`);
}
