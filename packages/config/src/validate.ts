/**
 * Startup configuration validation (Part 7). Development stays permissive so a
 * contributor can `pnpm dev` without a full secret set; production/mainnet FAIL
 * CLOSED — a missing operator key, secret, Redis config, or USDC issuer refuses
 * startup instead of silently falling back to an unsafe default. Only variable
 * NAMES ever appear in the error; values are never read into the message.
 */
export interface ConfigProblem {
  key: string;
  message: string;
}

export type Environment = Readonly<Record<string, string | undefined>>;

const LEGACY_ENV: Readonly<Record<string, string>> = {
  BINANCE_PAY_API_KEY: "remove it; Binance Pay is not part of Trustip v1.1",
  BINANCE_PAY_SECRET: "remove it; Binance Pay is not part of Trustip v1.1",
  DATABASE_URL:
    "remove it from the application environment; Supabase clients use the canonical API variables",
  ESCROW_CONTRACT_ID: "use NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
  ESCROW_INDEXER_INTERVAL_SECONDS: "use INDEXER_POLL_MS",
  JOB_SECRET: "remove it; no worker reads this variable",
  MONEYGRAM_PARTNER_API_KEY:
    "remove it; the payout integration is not implemented",
  MONEYGRAM_PARTNER_API_URL:
    "remove it; the payout integration is not implemented",
  NEXT_PUBLIC_APP_ENV: "use NODE_ENV",
  NEXT_PUBLIC_ENABLE_BINANCE_PAY:
    "remove it; Binance Pay is not part of Trustip v1.1",
  NEXT_PUBLIC_ENABLE_BINANCE_TOPUP_GUIDE:
    "remove it; no runtime consumer exists",
  NEXT_PUBLIC_ENABLE_FREIGHTER: "remove it; no runtime consumer exists",
  NEXT_PUBLIC_ENABLE_MONEYGRAM_ROUTE: "remove it; no runtime consumer exists",
  NEXT_PUBLIC_ENABLE_XBULL: "remove it; no runtime consumer exists",
  NEXT_PUBLIC_ENABLE_XLM_PAYOUT: "remove it; no runtime consumer exists",
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
    "remove it; the passphrase is derived from the network",
  NEXT_PUBLIC_USDC_ASSET_CODE: "remove it; Trustip v1.1 uses USDC",
  PAYOUT_SYNC_INTERVAL_SECONDS: "remove it; the payout worker is disabled",
  SOROBAN_ADMIN_ADDRESS:
    "remove it; the admin is derived from the operator signer and verified on-chain",
  SOROBAN_ADMIN_SECRET_KEY: "use TRUSTIP_OPERATOR_SECRET_KEY",
  SOROBAN_ESCROW_CONTRACT_ID: "use NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
  STELLAR_HORIZON_URL: "use NEXT_PUBLIC_STELLAR_HORIZON_URL",
  STELLAR_NETWORK_PASSPHRASE:
    "remove it; the passphrase is derived from the network",
  STELLAR_OPERATOR_SECRET_KEY: "use TRUSTIP_OPERATOR_SECRET_KEY",
  STELLAR_RPC_URL: "use NEXT_PUBLIC_STELLAR_RPC_URL",
};

export function isPlaceholderValue(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("<") ||
    normalized.startsWith("[") ||
    normalized.startsWith("${") ||
    normalized.includes("placeholder") ||
    normalized.includes("replace-with") ||
    normalized.includes("replace_with") ||
    normalized.includes("example.com") ||
    normalized.endsWith(".example") ||
    normalized.startsWith("your-") ||
    normalized === "changeme" ||
    normalized === "dummy" ||
    normalized === "fake" ||
    normalized === "sample" ||
    normalized === "xxx" ||
    normalized === "todo"
  );
}

function usable(env: Environment, name: string): boolean {
  return !isPlaceholderValue(env[name]);
}

function validUrl(
  env: Environment,
  name: string,
  requireHttps = true,
): boolean {
  if (!usable(env, name)) return false;
  try {
    const url = new URL(env[name]!);
    return !requireHttps || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validDomain(env: Environment, name: string): boolean {
  if (!usable(env, name)) return false;
  try {
    const value = env[name]!;
    const url = new URL(`https://${value}`);
    return url.host === value && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function networkFromUrl(
  value: string | undefined,
): "testnet" | "mainnet" | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("testnet")) return "testnet";
  if (lower.includes("mainnet") || lower.includes("horizon.stellar.org")) {
    return "mainnet";
  }
  return null;
}

export function isProduction(env: Environment = process.env): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Collect (do not throw) every production config problem. Returns [] in
 * non-production so dev never trips. Used by `assertProductionConfig` and by the
 * `/ready` health endpoint to report readiness without crashing.
 */
export function collectConfigProblems(
  env: Environment = process.env,
  production = isProduction(env),
): ConfigProblem[] {
  if (!production) return [];
  const problems: ConfigProblem[] = [];
  const need = (name: string, hint: string, ok = usable(env, name)) => {
    if (!ok) problems.push({ key: name, message: hint });
  };

  for (const [name, message] of Object.entries(LEGACY_ENV)) {
    if (env[name] !== undefined) problems.push({ key: name, message });
  }

  const publicNetwork = env.NEXT_PUBLIC_STELLAR_NETWORK;
  const serverNetwork = env.STELLAR_NETWORK;
  if (publicNetwork !== "testnet" && publicNetwork !== "mainnet") {
    problems.push({
      key: "NEXT_PUBLIC_STELLAR_NETWORK",
      message: "must be exactly testnet or mainnet",
    });
  }
  if (serverNetwork !== "testnet" && serverNetwork !== "mainnet") {
    problems.push({
      key: "STELLAR_NETWORK",
      message: "must be exactly testnet or mainnet",
    });
  }
  if (publicNetwork && serverNetwork && publicNetwork !== serverNetwork) {
    problems.push({
      key: "STELLAR_NETWORK",
      message: "must match NEXT_PUBLIC_STELLAR_NETWORK",
    });
  }

  need(
    "NEXT_PUBLIC_APP_URL",
    "a non-placeholder HTTPS application URL is required",
    validUrl(env, "NEXT_PUBLIC_APP_URL"),
  );
  need(
    "NEXT_PUBLIC_SUPABASE_URL",
    "a non-placeholder HTTPS Supabase URL is required",
    validUrl(env, "NEXT_PUBLIC_SUPABASE_URL"),
  );
  need(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "a non-placeholder anon key is required",
  );
  need(
    "SUPABASE_SERVICE_ROLE_KEY",
    "a non-placeholder service-role key is required",
  );

  need(
    "NEXT_PUBLIC_STELLAR_RPC_URL",
    "a non-placeholder HTTPS Stellar RPC URL is required",
    validUrl(env, "NEXT_PUBLIC_STELLAR_RPC_URL"),
  );
  need(
    "NEXT_PUBLIC_STELLAR_HORIZON_URL",
    "a non-placeholder HTTPS Horizon URL is required",
    validUrl(env, "NEXT_PUBLIC_STELLAR_HORIZON_URL"),
  );
  need(
    "NEXT_PUBLIC_ANCHOR_DOMAIN",
    "a non-placeholder anchor hostname is required",
    validDomain(env, "NEXT_PUBLIC_ANCHOR_DOMAIN"),
  );
  const rpcNetwork = networkFromUrl(env.NEXT_PUBLIC_STELLAR_RPC_URL);
  const horizonNetwork = networkFromUrl(env.NEXT_PUBLIC_STELLAR_HORIZON_URL);
  if (rpcNetwork && serverNetwork && rpcNetwork !== serverNetwork) {
    problems.push({
      key: "NEXT_PUBLIC_STELLAR_RPC_URL",
      message: "the known endpoint belongs to a different Stellar network",
    });
  }
  if (horizonNetwork && serverNetwork && horizonNetwork !== serverNetwork) {
    problems.push({
      key: "NEXT_PUBLIC_STELLAR_HORIZON_URL",
      message: "the known endpoint belongs to a different Stellar network",
    });
  }
  if (rpcNetwork && horizonNetwork && rpcNetwork !== horizonNetwork) {
    problems.push({
      key: "NEXT_PUBLIC_STELLAR_HORIZON_URL",
      message: "RPC and Horizon endpoints belong to different Stellar networks",
    });
  }

  need(
    "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
    "a non-placeholder deployed escrow contract ID is required",
  );
  need(
    "NEXT_PUBLIC_USDC_CONTRACT_ID",
    "a non-placeholder USDC SAC contract ID is required",
  );
  need("NEXT_PUBLIC_USDC_ISSUER", "a non-placeholder USDC issuer is required");

  need(
    "TRUSTIP_OPERATOR_SECRET_KEY",
    "the server-only operator signer secret is required",
  );
  need(
    "TRUSTIP_SIGNER_STRATEGY",
    "must be explicitly set to env",
    env.TRUSTIP_SIGNER_STRATEGY === "env",
  );
  need(
    "PAYMENT_ATTEMPT_SECRET",
    "a server-only payment-attempt secret is required",
  );
  need(
    "TRUSTIP_CHECKOUT_TOKEN_SECRET",
    "a server-only checkout token secret is required",
  );
  need(
    "TRUSTIP_WALLET_CHALLENGE_SECRET",
    "a server-only wallet challenge secret is required",
  );
  need(
    "TRUSTIP_SEP10_JWT_SECRET",
    "a server-only SEP-10 JWT secret is required",
  );

  for (const name of [
    "PAYMENT_ATTEMPT_SECRET",
    "TRUSTIP_CHECKOUT_TOKEN_SECRET",
    "TRUSTIP_WALLET_CHALLENGE_SECRET",
    "TRUSTIP_SEP10_JWT_SECRET",
  ]) {
    if (usable(env, name) && env[name]!.length < 32) {
      problems.push({
        key: name,
        message: "must contain at least 32 characters",
      });
    }
  }

  need(
    "UPSTASH_REDIS_REST_URL",
    "a non-placeholder HTTPS distributed rate-limit URL is required",
    validUrl(env, "UPSTASH_REDIS_REST_URL"),
  );
  need(
    "UPSTASH_REDIS_REST_TOKEN",
    "a non-placeholder distributed rate-limit token is required",
  );

  if (serverNetwork === "mainnet") {
    if ((env.NEXT_PUBLIC_ANCHOR_DOMAIN || "").toLowerCase().includes("test")) {
      problems.push({
        key: "NEXT_PUBLIC_ANCHOR_DOMAIN",
        message: "a Testnet anchor cannot be used on Mainnet",
      });
    }
    if ((env.TRUSTIP_ALLOW_MAINNET_OPERATOR || "").toLowerCase() !== "true") {
      problems.push({
        key: "TRUSTIP_ALLOW_MAINNET_OPERATOR",
        message:
          "must be exactly true before env-key signing is allowed on mainnet",
      });
    }
  }

  return problems;
}

/** Throw if production config is incomplete. Call at process/route bootstrap. */
export function assertProductionConfig(env: Environment = process.env): void {
  const problems = collectConfigProblems(env);
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  - ${p.key}: ${p.message}`).join("\n");
  throw new Error(
    `Refusing to start: production configuration is incomplete\n${lines}`,
  );
}
