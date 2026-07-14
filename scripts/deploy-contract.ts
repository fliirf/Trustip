/**
 * scripts/deploy-contract.ts
 *
 * Builds and deploys the Trustip Soroban escrow contract using the Stellar
 * CLI. Constructor arguments initialize it atomically during deployment.
 *
 * Requires:
 *   - Stellar CLI installed (`stellar --version`)
 *   - A funded deploy identity: `stellar keys generate <name> --network testnet`
 *     then fund it (Friendbot on testnet)
 *
 * Env (see .env.example):
 *   STELLAR_NETWORK=testnet|mainnet
 *   NEXT_PUBLIC_STELLAR_NETWORK=testnet|mainnet (must match)
 *   STELLAR_DEPLOY_IDENTITY=<cli identity name>       (deployer + initial admin)
 *   NEXT_PUBLIC_USDC_ISSUER=<official Circle issuer for the network>
 *   NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC SAC contract id>
 *
 * Usage:
 *   STELLAR_NETWORK=testnet STELLAR_DEPLOY_IDENTITY=trustip-deployer \
 *   NEXT_PUBLIC_USDC_CONTRACT_ID=C... tsx scripts/deploy-contract.ts
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { collectStellarEnvProblems } from "../packages/stellar/src/env-verification.js";

function sh(args: string[]): string {
  return execFileSync("stellar", args, { encoding: "utf8" }).trim();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function main(): void {
  // Verify the CLI is available.
  try {
    sh(["--version"]);
  } catch {
    throw new Error(
      "Stellar CLI not found. Install it: https://developers.stellar.org/docs/tools/cli",
    );
  }

  const network = requireEnv("STELLAR_NETWORK");
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("STELLAR_NETWORK must be exactly testnet or mainnet");
  }
  const publicNetwork = requireEnv("NEXT_PUBLIC_STELLAR_NETWORK");
  if (publicNetwork !== network) {
    throw new Error("STELLAR_NETWORK must match NEXT_PUBLIC_STELLAR_NETWORK");
  }
  const identity = requireEnv("STELLAR_DEPLOY_IDENTITY");
  requireEnv("NEXT_PUBLIC_USDC_ISSUER");
  const usdcToken = requireEnv("NEXT_PUBLIC_USDC_CONTRACT_ID");
  const usdcProblems = collectStellarEnvProblems(process.env, true).filter(
    ({ key }) =>
      key === "NEXT_PUBLIC_USDC_ISSUER" ||
      key === "NEXT_PUBLIC_USDC_CONTRACT_ID",
  );
  if (usdcProblems.length > 0) {
    const details = usdcProblems
      .map(({ key, message }) => `  - ${key}: ${message}`)
      .join("\n");
    throw new Error(`Invalid USDC deployment environment\n${details}`);
  }
  const admin = sh(["keys", "address", identity]);

  const manifest = resolve(process.cwd(), "contracts/escrow/Cargo.toml");
  const wasm = resolve(
    process.cwd(),
    "contracts/escrow/target/wasm32v1-none/release/trustip_escrow.wasm",
  );

  console.log(
    `[deploy] network=${network} identity=${identity} admin=${admin}`,
  );

  console.log("[deploy] building contract wasm...");
  sh(["contract", "build", "--manifest-path", manifest]);

  console.log("[deploy] deploying + initializing atomically...");
  const contractId = sh([
    "contract",
    "deploy",
    "--wasm",
    wasm,
    "--source",
    identity,
    "--network",
    network,
    "--",
    "--admin",
    admin,
    "--usdc_token",
    usdcToken,
  ]);
  console.log(`[deploy] contract id: ${contractId}`);

  console.log("\n[deploy] Done. Set these in your env for this network:");
  console.log(`  NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=${contractId}`);
  console.log(
    "  Initial admin is the deploy identity; rotate via propose_admin + accept_admin.",
  );
}

main();
