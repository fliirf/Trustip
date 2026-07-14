import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  collectStellarEnvProblems,
  onChainPrerequisites,
  verifyOnChainEnvironment,
} from "../packages/stellar/src/env-verification.js";
import {
  collectConfigProblems,
  type ConfigProblem,
  type Environment,
} from "../packages/config/src/validate.js";

export interface VerifyEnvOptions {
  production?: boolean;
  onChain?: boolean;
  env?: Environment;
  log?: (message: string) => void;
}

export function collectStaticEnvProblems(
  env: Environment = process.env,
  production = env.NODE_ENV === "production",
): ConfigProblem[] {
  return [
    ...collectConfigProblems(env, production),
    ...collectStellarEnvProblems(env, production),
  ];
}

export async function verifyEnvironment(
  options: VerifyEnvOptions = {},
): Promise<void> {
  const production =
    options.production ??
    (options.env
      ? options.env.NODE_ENV === "production"
      : process.env.NODE_ENV === "production");
  const env: Environment = production
    ? { ...(options.env ?? process.env), NODE_ENV: "production" }
    : (options.env ?? process.env);
  const log = options.log ?? console.log;
  const problems = collectStaticEnvProblems(env, production);

  if (problems.length > 0) {
    const details = problems
      .map((problem) => `  - ${problem.key}: ${problem.message}`)
      .join("\n");
    throw new Error(`Environment verification failed\n${details}`);
  }

  log(
    production
      ? "[verify-env] static production validation passed"
      : "[verify-env] development mode: strict production requirements skipped",
  );

  if (!options.onChain) return;
  const missing = onChainPrerequisites(env);
  if (missing.length > 0) {
    log(
      `[verify-env] on-chain validation skipped; missing: ${missing.join(", ")}`,
    );
    return;
  }

  const result = await verifyOnChainEnvironment(env);
  log(
    `[verify-env] on-chain validation passed (${result.network}, ledger ${result.latestLedger})`,
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  await verifyEnvironment({
    production:
      args.has("--production") || process.env.NODE_ENV === "production",
    onChain: args.has("--on-chain"),
  });
}

const entry = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (entry === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Environment verification failed",
    );
    process.exit(1);
  });
}
