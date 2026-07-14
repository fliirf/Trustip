import { Asset, Keypair, Networks, rpc, StrKey } from "@stellar/stellar-sdk";
import { EscrowClient } from "./escrow.js";

export type Environment = Readonly<Record<string, string | undefined>>;

export interface StellarEnvProblem {
  key: string;
  message: string;
}

// Public Circle asset metadata:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
const USDC_ISSUER = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
} as const;

const PASSPHRASE = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
} as const;

type Network = keyof typeof PASSPHRASE;

export interface OnChainVerificationResult {
  network: Network;
  latestLedger: number;
}

function configured(env: Environment, name: string): string | null {
  const value = env[name];
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase();
  if (
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
  ) {
    return null;
  }
  return value.trim();
}

function add(
  problems: StellarEnvProblem[],
  key: string,
  message: string,
): void {
  if (
    !problems.some(
      (problem) => problem.key === key && problem.message === message,
    )
  ) {
    problems.push({ key, message });
  }
}

/** Exact static Stellar checks. No network calls are made here. */
export function collectStellarEnvProblems(
  env: Environment = process.env,
  production = env.NODE_ENV === "production",
): StellarEnvProblem[] {
  const problems: StellarEnvProblem[] = [];
  if (!production) return problems;

  const network = env.STELLAR_NETWORK as Network | undefined;
  const escrowId = configured(env, "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID");
  const usdcId = configured(env, "NEXT_PUBLIC_USDC_CONTRACT_ID");
  const issuer = configured(env, "NEXT_PUBLIC_USDC_ISSUER");
  const operatorSecret = configured(env, "TRUSTIP_OPERATOR_SECRET_KEY");

  if (escrowId && !StrKey.isValidContract(escrowId)) {
    add(
      problems,
      "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
      "must be a checksum-valid Stellar contract ID",
    );
  }
  if (usdcId && !StrKey.isValidContract(usdcId)) {
    add(
      problems,
      "NEXT_PUBLIC_USDC_CONTRACT_ID",
      "must be a checksum-valid Stellar contract ID",
    );
  }
  if (issuer && !StrKey.isValidEd25519PublicKey(issuer)) {
    add(
      problems,
      "NEXT_PUBLIC_USDC_ISSUER",
      "must be a checksum-valid Stellar public key",
    );
  }
  if (operatorSecret && !StrKey.isValidEd25519SecretSeed(operatorSecret)) {
    add(
      problems,
      "TRUSTIP_OPERATOR_SECRET_KEY",
      "must be a valid Stellar secret seed",
    );
  }

  if (
    (network === "testnet" || network === "mainnet") &&
    issuer &&
    StrKey.isValidEd25519PublicKey(issuer)
  ) {
    if (issuer !== USDC_ISSUER[network]) {
      add(
        problems,
        "NEXT_PUBLIC_USDC_ISSUER",
        "must match Circle USDC for the selected network",
      );
    }
    if (
      usdcId &&
      StrKey.isValidContract(usdcId) &&
      new Asset("USDC", issuer).contractId(PASSPHRASE[network]) !== usdcId
    ) {
      add(
        problems,
        "NEXT_PUBLIC_USDC_CONTRACT_ID",
        "must be the SAC derived from the configured USDC issuer and network",
      );
    }
  }

  return problems;
}

export function onChainPrerequisites(env: Environment = process.env): string[] {
  return [
    "NEXT_PUBLIC_STELLAR_RPC_URL",
    "NEXT_PUBLIC_STELLAR_HORIZON_URL",
    "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID",
    "NEXT_PUBLIC_USDC_CONTRACT_ID",
    "TRUSTIP_OPERATOR_SECRET_KEY",
  ].filter((name) => !configured(env, name));
}

/**
 * Verify the selected RPC/Horizon network and the deployed escrow constructor
 * configuration. Call only after static validation succeeds.
 */
export async function verifyOnChainEnvironment(
  env: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<OnChainVerificationResult> {
  const network = env.STELLAR_NETWORK as Network;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("STELLAR_NETWORK must be testnet or mainnet");
  }

  const missing = onChainPrerequisites(env);
  if (missing.length > 0) {
    throw new Error(
      `on-chain validation prerequisites are missing: ${missing.join(", ")}`,
    );
  }

  const rpcUrl = configured(env, "NEXT_PUBLIC_STELLAR_RPC_URL")!;
  const horizonUrl = configured(env, "NEXT_PUBLIC_STELLAR_HORIZON_URL")!;
  const escrowId = configured(env, "NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID")!;
  const expectedUsdc = configured(env, "NEXT_PUBLIC_USDC_CONTRACT_ID")!;
  const operatorSecret = configured(env, "TRUSTIP_OPERATOR_SECRET_KEY")!;
  const expectedPassphrase = PASSPHRASE[network];
  const server = new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  });

  let rpcNetwork: Awaited<ReturnType<typeof server.getNetwork>>;
  let latestLedger: number;
  try {
    [rpcNetwork, { sequence: latestLedger }] = await Promise.all([
      server.getNetwork(),
      server.getLatestLedger(),
    ]);
  } catch {
    throw new Error(
      "Stellar RPC is unavailable or does not expose network metadata",
    );
  }
  if (rpcNetwork.passphrase !== expectedPassphrase) {
    throw new Error(
      "Stellar RPC belongs to a different network than STELLAR_NETWORK",
    );
  }

  let horizonPassphrase: unknown;
  try {
    const response = await fetchImpl(horizonUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("unavailable");
    horizonPassphrase = (
      (await response.json()) as { network_passphrase?: unknown }
    ).network_passphrase;
  } catch {
    throw new Error(
      "Horizon is unavailable or does not expose network metadata",
    );
  }
  if (horizonPassphrase !== expectedPassphrase) {
    throw new Error(
      "Horizon belongs to a different network than STELLAR_NETWORK",
    );
  }

  const client = new EscrowClient({
    server,
    networkPassphrase: expectedPassphrase,
    contractId: escrowId,
  });
  let admin: string | null;
  let storedUsdc: string | null;
  try {
    [admin, storedUsdc] = await Promise.all([
      client.readAdmin(),
      client.readUsdcToken(),
    ]);
  } catch {
    throw new Error(
      "escrow contract was not found or is unreadable on the selected network",
    );
  }
  if (!admin || !storedUsdc) {
    throw new Error(
      "escrow contract was not found or is unreadable on the selected network",
    );
  }
  if (admin !== Keypair.fromSecret(operatorSecret).publicKey()) {
    throw new Error(
      "escrow contract admin does not match TRUSTIP_OPERATOR_SECRET_KEY",
    );
  }
  if (storedUsdc !== expectedUsdc) {
    throw new Error(
      "escrow contract USDC token does not match NEXT_PUBLIC_USDC_CONTRACT_ID",
    );
  }

  return { network, latestLedger };
}
