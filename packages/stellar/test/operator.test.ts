import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildOperatorSigner, OperatorSignerError } from "../src/operator.js";

const TESTNET = "Test SDF Network ; September 2015";

function expectSignerError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(OperatorSignerError);
    expect((e as OperatorSignerError).code).toBe(code);
    return;
  }
  throw new Error(`expected OperatorSignerError(${code})`);
}

describe("buildOperatorSigner", () => {
  const secret = Keypair.random().secret();

  it("builds a signer from a valid testnet secret", () => {
    const signer = buildOperatorSigner({
      secretKey: secret,
      isMainnet: false,
      allowMainnet: false,
    });
    expect(signer.publicKey).toBe(Keypair.fromSecret(secret).publicKey());
  });

  it("fails closed (AdminSignerMissing) when the secret is unset", () => {
    expectSignerError(
      () =>
        buildOperatorSigner({
          secretKey: undefined,
          isMainnet: false,
          allowMainnet: false,
        }),
      "AdminSignerMissing",
    );
  });

  it("fails closed on an invalid secret and never leaks its value", () => {
    const bogus = "SNOTAREALSECRETSEED";
    try {
      buildOperatorSigner({
        secretKey: bogus,
        isMainnet: false,
        allowMainnet: false,
      });
    } catch (e) {
      expect((e as OperatorSignerError).code).toBe("AdminSignerMissing");
      expect((e as Error).message).not.toContain(bogus);
      return;
    }
    throw new Error("expected OperatorSignerError");
  });

  it("refuses mainnet unless explicitly allowed", () => {
    expectSignerError(
      () =>
        buildOperatorSigner({
          secretKey: secret,
          isMainnet: true,
          allowMainnet: false,
        }),
      "AdminSignerNotAllowedOnMainnet",
    );
  });

  it("mainnet guard takes precedence over a missing secret", () => {
    expectSignerError(
      () =>
        buildOperatorSigner({
          secretKey: undefined,
          isMainnet: true,
          allowMainnet: false,
        }),
      "AdminSignerNotAllowedOnMainnet",
    );
  });

  it("allows mainnet only when explicitly enabled with a valid secret", () => {
    const signer = buildOperatorSigner({
      secretKey: secret,
      isMainnet: true,
      allowMainnet: true,
    });
    expect(signer.publicKey).toBe(Keypair.fromSecret(secret).publicKey());
  });

  it("signs a transaction XDR (adds exactly one signature)", async () => {
    const kp = Keypair.fromSecret(secret);
    const tx = new TransactionBuilder(new Account(kp.publicKey(), "0"), {
      fee: BASE_FEE,
      networkPassphrase: TESTNET,
    })
      .addOperation(Operation.manageData({ name: "x", value: "y" }))
      .setTimeout(60)
      .build();

    const signer = buildOperatorSigner({
      secretKey: secret,
      isMainnet: false,
      allowMainnet: false,
    });
    const signedXdr = await signer.signXdr(tx.toXDR(), TESTNET);
    const parsed = TransactionBuilder.fromXDR(
      signedXdr,
      TESTNET,
    ) as Transaction;
    expect(parsed.signatures.length).toBe(1);
    expect(signedXdr).not.toBe(tx.toXDR());
  });
});
