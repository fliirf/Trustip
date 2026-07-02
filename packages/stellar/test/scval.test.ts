import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  addressToScVal,
  bytes32ToScVal,
  contractOrderIdToHex,
  deriveContractOrderId,
  i128ToScVal,
  normalizeEscrowStatus,
  u64ToScVal,
} from "../src/scval.js";

// A guaranteed-valid Ed25519 public key (strkey) for address encoding checks.
const G_ADDRESS = Keypair.random().publicKey();

describe("scval builders", () => {
  it("encodes i128 amounts", () => {
    expect(i128ToScVal(1_000n).switch().name).toBe("scvI128");
  });

  it("encodes u64 values", () => {
    expect(u64ToScVal(42n).switch().name).toBe("scvU64");
  });

  it("encodes addresses", () => {
    expect(addressToScVal(G_ADDRESS).switch().name).toBe("scvAddress");
  });

  it("encodes 32-byte values as bytes", () => {
    const id = deriveContractOrderId("order-1");
    expect(bytes32ToScVal(id).switch().name).toBe("scvBytes");
  });

  it("rejects non-32-byte values", () => {
    expect(() => bytes32ToScVal(new Uint8Array(16))).toThrow(/32-byte/);
  });
});

describe("deriveContractOrderId", () => {
  it("produces a deterministic 32-byte id", () => {
    const a = deriveContractOrderId("order-uuid-abc");
    const b = deriveContractOrderId("order-uuid-abc");
    expect(a.length).toBe(32);
    expect(contractOrderIdToHex(a)).toBe(contractOrderIdToHex(b));
  });

  it("produces different ids for different refs", () => {
    const a = contractOrderIdToHex(deriveContractOrderId("order-1"));
    const b = contractOrderIdToHex(deriveContractOrderId("order-2"));
    expect(a).not.toBe(b);
  });

  it("hex round-trips to 64 chars", () => {
    expect(contractOrderIdToHex(deriveContractOrderId("x"))).toHaveLength(64);
  });
});

describe("normalizeEscrowStatus", () => {
  it("handles array-encoded unit enums", () => {
    expect(normalizeEscrowStatus(["Funded"])).toBe("Funded");
  });

  it("handles string-encoded status", () => {
    expect(normalizeEscrowStatus("Created")).toBe("Created");
  });

  it("handles tag-object encoding", () => {
    expect(normalizeEscrowStatus({ tag: "Released" })).toBe("Released");
  });

  it("throws on unknown status", () => {
    expect(() => normalizeEscrowStatus(["Bogus"])).toThrow(/unrecognized/);
  });
});
