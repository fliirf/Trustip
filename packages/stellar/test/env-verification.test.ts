import { randomBytes } from "node:crypto";
import { Asset, Keypair, Networks, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  collectStaticEnvProblems,
  verifyEnvironment,
} from "../../../scripts/verify-env.js";
import { onChainPrerequisites } from "../src/env-verification.js";

type Environment = Readonly<Record<string, string | undefined>>;

const MAINNET_USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

function validMainnetEnv(): Environment {
  return {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://trustip.id",
    NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
    STELLAR_NETWORK: "mainnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://mainnet.sorobanrpc.com",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon.stellar.org",
    NEXT_PUBLIC_ANCHOR_DOMAIN: "anchor.trustip.id",
    NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID: StrKey.encodeContract(
      randomBytes(32),
    ),
    NEXT_PUBLIC_USDC_ISSUER: MAINNET_USDC_ISSUER,
    NEXT_PUBLIC_USDC_CONTRACT_ID: new Asset(
      "USDC",
      MAINNET_USDC_ISSUER,
    ).contractId(Networks.PUBLIC),
    NEXT_PUBLIC_SUPABASE_URL: "https://trustip.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-tests-only-not-a-real-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-for-tests-only-not-a-real-key",
    TRUSTIP_OPERATOR_SECRET_KEY: Keypair.random().secret(),
    TRUSTIP_SIGNER_STRATEGY: "env",
    TRUSTIP_ALLOW_MAINNET_OPERATOR: "true",
    PAYMENT_ATTEMPT_SECRET: "p".repeat(32),
    TRUSTIP_CHECKOUT_TOKEN_SECRET: "c".repeat(32),
    TRUSTIP_WALLET_CHALLENGE_SECRET: "w".repeat(32),
    TRUSTIP_SEP10_JWT_SECRET: "j".repeat(32),
    UPSTASH_REDIS_REST_URL: "https://trustip.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "redis-token-for-tests-only",
  };
}

describe("production environment verification", () => {
  it("accepts a complete, internally consistent Mainnet configuration", () => {
    const env = validMainnetEnv();
    expect(collectStaticEnvProblems(env, true)).toEqual([]);
    expect(onChainPrerequisites(env)).toEqual([]);
  });

  it("rejects frontend/backend and endpoint network mismatches", () => {
    const env = {
      ...validMainnetEnv(),
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    };
    const keys = collectStaticEnvProblems(env, true).map(
      (problem) => problem.key,
    );
    expect(keys).toContain("STELLAR_NETWORK");
    expect(keys).toContain("NEXT_PUBLIC_STELLAR_HORIZON_URL");
  });

  it("rejects an unsupported network without attempting derived-ID validation", () => {
    const env = {
      ...validMainnetEnv(),
      NEXT_PUBLIC_STELLAR_NETWORK: "futurenet",
      STELLAR_NETWORK: "futurenet",
    };
    const keys = collectStaticEnvProblems(env, true).map(
      (problem) => problem.key,
    );
    expect(keys).toContain("NEXT_PUBLIC_STELLAR_NETWORK");
    expect(keys).toContain("STELLAR_NETWORK");
  });

  it("rejects placeholders, invalid IDs, missing service role, and an invalid signer", () => {
    const invalidSecret = "secret-value-that-must-not-appear-in-errors";
    const env = {
      ...validMainnetEnv(),
      NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID: "replace-with-contract-id",
      NEXT_PUBLIC_USDC_CONTRACT_ID:
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      SUPABASE_SERVICE_ROLE_KEY: "",
      TRUSTIP_OPERATOR_SECRET_KEY: invalidSecret,
    };
    const problems = collectStaticEnvProblems(env, true);
    const keys = problems.map((problem) => problem.key);
    expect(keys).toContain("NEXT_PUBLIC_SOROBAN_ESCROW_CONTRACT_ID");
    expect(keys).toContain("NEXT_PUBLIC_USDC_CONTRACT_ID");
    expect(keys).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(keys).toContain("TRUSTIP_OPERATOR_SECRET_KEY");
    expect(JSON.stringify(problems)).not.toContain(invalidSecret);
  });

  it("rejects common example-domain placeholders", () => {
    const env = {
      ...validMainnetEnv(),
      NEXT_PUBLIC_APP_URL: "https://trustip.example.com",
    };
    const keys = collectStaticEnvProblems(env, true).map(
      (problem) => problem.key,
    );
    expect(keys).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("rejects legacy aliases and the wrong Circle issuer", () => {
    const env = {
      ...validMainnetEnv(),
      STELLAR_RPC_URL: "https://legacy.example",
      NEXT_PUBLIC_USDC_ISSUER:
        "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    };
    const keys = collectStaticEnvProblems(env, true).map(
      (problem) => problem.key,
    );
    expect(keys).toContain("STELLAR_RPC_URL");
    expect(keys).toContain("NEXT_PUBLIC_USDC_ISSUER");
  });

  it("keeps development permissive when contracts and production secrets are absent", () => {
    expect(
      collectStaticEnvProblems(
        {
          NODE_ENV: "development",
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        },
        false,
      ),
    ).toEqual([]);
  });

  it("skips optional on-chain validation when development prerequisites are absent", async () => {
    const logs: string[] = [];
    await verifyEnvironment({
      production: false,
      onChain: true,
      env: { NODE_ENV: "development" },
      log: (message) => logs.push(message),
    });
    expect(
      logs.some((message) => message.includes("on-chain validation skipped")),
    ).toBe(true);
  });

  it("fails closed with clear variable names and never echoes a secret", async () => {
    const secret = "private-value-that-must-never-be-logged";
    const env = {
      ...validMainnetEnv(),
      TRUSTIP_OPERATOR_SECRET_KEY: secret,
    };

    let message = "";
    try {
      await verifyEnvironment({ production: true, env, log: () => undefined });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("TRUSTIP_OPERATOR_SECRET_KEY");
    expect(message).not.toContain(secret);
  });
});
