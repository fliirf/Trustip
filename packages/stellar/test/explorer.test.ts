import { describe, expect, it } from "vitest";
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerTxUrl,
} from "../src/explorer.js";

describe("explorer links", () => {
  it("builds testnet tx links", () => {
    expect(explorerTxUrl("testnet", "abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });

  it("builds mainnet (public) tx links", () => {
    expect(explorerTxUrl("mainnet", "abc123")).toBe(
      "https://stellar.expert/explorer/public/tx/abc123",
    );
  });

  it("builds account links", () => {
    expect(explorerAccountUrl("testnet", "GABC")).toBe(
      "https://stellar.expert/explorer/testnet/account/GABC",
    );
  });

  it("builds contract links", () => {
    expect(explorerContractUrl("mainnet", "CABC")).toBe(
      "https://stellar.expert/explorer/public/contract/CABC",
    );
  });
});
