import {
  Keypair,
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { buildSep10Challenge, verifySep10Challenge } from "../src/sep10.js";

const NETWORK = Networks.TESTNET;
const HOME = "trustip.local";
const WEB_AUTH = "trustip.local";

const server = Keypair.random();
const client = Keypair.random();

function challengeFor(clientAccount: string): string {
  return buildSep10Challenge({
    serverSigningSecret: server.secret(),
    clientAccount,
    homeDomain: HOME,
    webAuthDomain: WEB_AUTH,
    networkPassphrase: NETWORK,
  });
}

function sign(challengeXdr: string, signer: Keypair): string {
  const tx = TransactionBuilder.fromXDR(challengeXdr, NETWORK) as Transaction;
  tx.sign(signer);
  return tx.toXDR();
}

describe("SEP-10 challenge (WebAuth wrapper)", () => {
  it("round-trips: build → client signs → verify returns the account + jti", () => {
    const signed = sign(challengeFor(client.publicKey()), client);
    const res = verifySep10Challenge({
      challengeXdr: signed,
      serverAccountId: server.publicKey(),
      homeDomain: HOME,
      webAuthDomain: WEB_AUTH,
      networkPassphrase: NETWORK,
    });
    expect(res.account).toBe(client.publicKey());
    expect(res.jti).toMatch(/^[0-9a-f]{64}$/); // tx hash hex
  });

  it("rejects an unsigned challenge (no client signature)", () => {
    expect(() =>
      verifySep10Challenge({
        challengeXdr: challengeFor(client.publicKey()),
        serverAccountId: server.publicKey(),
        homeDomain: HOME,
        webAuthDomain: WEB_AUTH,
        networkPassphrase: NETWORK,
      }),
    ).toThrow();
  });

  it("rejects a challenge signed by the wrong wallet", () => {
    const signed = sign(challengeFor(client.publicKey()), Keypair.random());
    expect(() =>
      verifySep10Challenge({
        challengeXdr: signed,
        serverAccountId: server.publicKey(),
        homeDomain: HOME,
        webAuthDomain: WEB_AUTH,
        networkPassphrase: NETWORK,
      }),
    ).toThrow();
  });

  it("rejects verification against the wrong server account", () => {
    const signed = sign(challengeFor(client.publicKey()), client);
    expect(() =>
      verifySep10Challenge({
        challengeXdr: signed,
        serverAccountId: Keypair.random().publicKey(),
        homeDomain: HOME,
        webAuthDomain: WEB_AUTH,
        networkPassphrase: NETWORK,
      }),
    ).toThrow();
  });

  it("rejects a challenge for the wrong home domain", () => {
    const signed = sign(challengeFor(client.publicKey()), client);
    expect(() =>
      verifySep10Challenge({
        challengeXdr: signed,
        serverAccountId: server.publicKey(),
        homeDomain: "evil.example",
        webAuthDomain: WEB_AUTH,
        networkPassphrase: NETWORK,
      }),
    ).toThrow();
  });
});
