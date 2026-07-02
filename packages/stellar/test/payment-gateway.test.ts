import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { isValidContractId, isValidPublicKey } from "../src/keys.js";
import { parseSignedFundTx } from "../src/payment-gateway.js";
import { addressToScVal, bytes32ToScVal, i128ToScVal } from "../src/scval.js";

const TESTNET = "Test SDF Network ; September 2015";
const CONTRACT_ID = "CDJO4D3R34KGLXHTD6ZVGERKOIKM66JVICY6RJABWWL2CXII7PCTBD3L";

describe("key validation", () => {
  it("accepts a real ed25519 public key and rejects junk", () => {
    const pk = Keypair.random().publicKey();
    expect(isValidPublicKey(pk)).toBe(true);
    expect(isValidPublicKey("not-a-key")).toBe(false);
    expect(isValidPublicKey("")).toBe(false);
  });

  it("validates contract ids", () => {
    expect(
      isValidContractId(
        "CDJO4D3R34KGLXHTD6ZVGERKOIKM66JVICY6RJABWWL2CXII7PCTBD3L",
      ),
    ).toBe(true);
    expect(isValidContractId("GABC")).toBe(false);
  });
});

describe("gateway.parseFundTx (offline)", () => {
  it("returns hash + source and reports no contract invocation for a plain tx", () => {
    const kp = Keypair.random();
    const account = new Account(kp.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: TESTNET,
    })
      .addOperation(Operation.manageData({ name: "x", value: "y" }))
      .setTimeout(60)
      .build();
    tx.sign(kp);

    const parsed = parseSignedFundTx(tx.toXDR(), TESTNET);
    expect(parsed.source).toBe(kp.publicKey());
    expect(parsed.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.invokesContract).toBe(false);
    expect(parsed.contractOrderId).toBeUndefined();
  });

  it("decodes fund_order(order_id, buyer, amount) from a real invocation", () => {
    const kp = Keypair.random();
    const orderId = Buffer.alloc(32, 9);
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call(
      "fund_order",
      bytes32ToScVal(orderId),
      addressToScVal(kp.publicKey()),
      i128ToScVal(105_000_000n),
    );
    const tx = new TransactionBuilder(new Account(kp.publicKey(), "0"), {
      fee: BASE_FEE,
      networkPassphrase: TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();
    tx.sign(kp);

    const parsed = parseSignedFundTx(tx.toXDR(), TESTNET);
    expect(parsed.invokesContract).toBe(true);
    expect(parsed.contractId).toBe(CONTRACT_ID);
    expect(parsed.functionName).toBe("fund_order");
    expect(parsed.contractOrderId).toBe(orderId.toString("hex"));
    expect(parsed.buyer).toBe(kp.publicKey());
    expect(parsed.amountUnits).toBe(105_000_000n);
    expect(parsed.source).toBe(kp.publicKey());
  });
});
