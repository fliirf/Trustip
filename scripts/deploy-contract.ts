/**
 * scripts/deploy-contract.ts
 *
 * Builds, deploys, and initializes the Trustip Soroban escrow contract using
 * the Stellar CLI. Run manually per network; it does not run in CI.
 *
 * Requires:
 *   - Stellar CLI installed (`stellar --version`)
 *   - A funded deploy identity: `stellar keys generate <name> --network testnet`
 *     then fund it (Friendbot on testnet)
 *
 * Env (see .env.example):
 *   STELLAR_NETWORK=testnet|mainnet
 *   STELLAR_DEPLOY_IDENTITY=<cli identity name>       (deployer + default admin)
 *   NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC SAC contract id>
 *   SOROBAN_ADMIN_ADDRESS=<G...>                      (optional admin override)
 *
 * Usage:
 *   STELLAR_NETWORK=testnet STELLAR_DEPLOY_IDENTITY=trustip-deployer \
 *   NEXT_PUBLIC_USDC_CONTRACT_ID=C... tsx scripts/deploy-contract.ts
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

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

  const network = process.env.STELLAR_NETWORK || "testnet";
  const identity = requireEnv("STELLAR_DEPLOY_IDENTITY");
  const usdcToken = requireEnv("NEXT_PUBLIC_USDC_CONTRACT_ID");
  const admin =
    process.env.SOROBAN_ADMIN_ADDRESS || sh(["keys", "address", identity]);

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

  console.log("[deploy] deploying...");
  const contractId = sh([
    "contract",
    "deploy",
    "--wasm",
    wasm,
    "--source",
    identity,
    "--network",
    network,
  ]);
  console.log(`[deploy] contract id: ${contractId}`);

  console.log("[deploy] initializing (admin + USDC token)...");
  sh([
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source",
    identity,
    "--network",
    network,
    "--",
    "initialize",
    "--admin",
    admin,
    "--usdc_token",
    usdcToken,
  ]);

  console.log("\n[deploy] Done. Set these in your env for this network:");
  console.log(`  NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID=${contractId}`);
  console.log(`  SOROBAN_ESCROW_CONTRACT_ID=${contractId}`);
}

main();
