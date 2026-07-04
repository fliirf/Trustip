import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  buildWalletChallengeTx,
  verifyWalletChallengeTx,
  WALLET_CHALLENGE_DATA_NAME,
} from "../src/wallet-challenge.js";

const NONCE = "a".repeat(48);

function signChallenge(challengeXdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(
    challengeXdr,
    Networks.TESTNET,
  ) as Transaction;
  tx.sign(signer);
  return tx.toXDR();
}

describe("wallet ownership challenge", () => {
  const wallet = Keypair.random();

  function freshChallenge(): string {
    return buildWalletChallengeTx({
      walletPublicKey: wallet.publicKey(),
      networkPassphrase: Networks.TESTNET,
      nonce: NONCE,
    });
  }

  it("builds an unsigned single-op manageData tx bound to the wallet", () => {
    const tx = TransactionBuilder.fromXDR(
      freshChallenge(),
      Networks.TESTNET,
    ) as Transaction;
    expect(tx.signatures).toHaveLength(0);
    expect(tx.operations).toHaveLength(1);
    const op = tx.operations[0]!;
    expect(op.type).toBe("manageData");
    if (op.type === "manageData") {
      expect(op.name).toBe(WALLET_CHALLENGE_DATA_NAME);
      expect(op.source).toBe(wallet.publicKey());
    }
    // The tx source is a throwaway account, never the wallet: the envelope is
    // missing its required source signature and can never be submitted.
    expect(tx.source).not.toBe(wallet.publicKey());
  });

  it("accepts a challenge signed by the wallet key", () => {
    const signed = signChallenge(freshChallenge(), wallet);
    expect(
      verifyWalletChallengeTx({
        signedXdr: signed,
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: NONCE,
      }),
    ).toBe(true);
  });

  it("rejects an unsigned challenge", () => {
    expect(
      verifyWalletChallengeTx({
        signedXdr: freshChallenge(),
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: NONCE,
      }),
    ).toBe(false);
  });

  it("rejects a challenge signed by a different key", () => {
    const signed = signChallenge(freshChallenge(), Keypair.random());
    expect(
      verifyWalletChallengeTx({
        signedXdr: signed,
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: NONCE,
      }),
    ).toBe(false);
  });

  it("rejects a nonce mismatch (token/tx cross-check)", () => {
    const signed = signChallenge(freshChallenge(), wallet);
    expect(
      verifyWalletChallengeTx({
        signedXdr: signed,
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: "b".repeat(48),
      }),
    ).toBe(false);
  });

  it("rejects a signature made for another network passphrase", () => {
    // Same structure, signed against PUBLIC — the network is part of the
    // signed hash, so a testnet verification must fail.
    const publicChallenge = buildWalletChallengeTx({
      walletPublicKey: wallet.publicKey(),
      networkPassphrase: Networks.PUBLIC,
      nonce: NONCE,
    });
    const tx = TransactionBuilder.fromXDR(
      publicChallenge,
      Networks.PUBLIC,
    ) as Transaction;
    tx.sign(wallet);
    expect(
      verifyWalletChallengeTx({
        signedXdr: tx.toXDR(),
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: NONCE,
      }),
    ).toBe(false);
  });

  it("rejects garbage XDR without throwing", () => {
    expect(
      verifyWalletChallengeTx({
        signedXdr: "not-xdr",
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: NONCE,
      }),
    ).toBe(false);
  });

  it("refuses to build with an oversized nonce", () => {
    expect(() =>
      buildWalletChallengeTx({
        walletPublicKey: wallet.publicKey(),
        networkPassphrase: Networks.TESTNET,
        nonce: "x".repeat(65),
      }),
    ).toThrow();
  });
});
