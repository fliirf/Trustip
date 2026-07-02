import { describe, expect, it } from "vitest";
import {
  assertNetworkPassphrase,
  buildDevSigningCheckXdr,
  createFreighterAdapter,
  createXBullAdapter,
  type FreighterProvider,
  getAvailableWallets,
  getWalletAdapter,
  signTransactionWithWallet,
  toWalletError,
  WALLET_METADATA,
  WalletError,
  type WalletErrorCode,
} from "../src/wallet/index.js";

const TESTNET = "Test SDF Network ; September 2015";
const MAINNET = "Public Global Stellar Network ; September 2015";

function mockFreighter(
  overrides: Partial<FreighterProvider> = {},
): FreighterProvider {
  return {
    isConnected: async () => ({ isConnected: true }),
    requestAccess: async () => ({ address: "GBUYER" }),
    getAddress: async () => ({ address: "GBUYER" }),
    getNetwork: async () => ({
      network: "TESTNET",
      networkPassphrase: TESTNET,
    }),
    signTransaction: async () => ({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: "GBUYER",
    }),
    ...overrides,
  };
}

async function rejectsWithCode(
  fn: () => Promise<unknown>,
  code: WalletErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(WalletError);
    expect((e as WalletError).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection with code ${code}`);
}

describe("wallet registry", () => {
  it("builds adapters by id", () => {
    expect(getWalletAdapter("freighter").id).toBe("freighter");
    expect(getWalletAdapter("xbull").id).toBe("xbull");
  });

  it("exposes metadata", () => {
    expect(WALLET_METADATA.freighter.name).toBe("Freighter");
    expect(WALLET_METADATA.xbull.supportedNetworks).toContain("testnet");
  });

  it("reports availability (both uninstalled in Node)", async () => {
    const avail = await getAvailableWallets();
    expect(avail.map((w) => w.id).sort()).toEqual(["freighter", "xbull"]);
    expect(avail.every((w) => w.installed === false)).toBe(true);
  });
});

describe("missing wallet", () => {
  it("xBull with no provider is unavailable and connect throws MissingWallet", async () => {
    const x = createXBullAdapter(); // no window.xBullSDK in Node
    expect(await x.isAvailable()).toBe(false);
    await rejectsWithCode(() => x.connect(), "MissingWallet");
  });

  it("Freighter reports unavailable when not connected", async () => {
    const f = createFreighterAdapter(
      mockFreighter({ isConnected: async () => ({ isConnected: false }) }),
    );
    expect(await f.isAvailable()).toBe(false);
  });
});

describe("network safety", () => {
  it("assertNetworkPassphrase passes on match, throws WrongNetwork on mismatch", () => {
    expect(() => assertNetworkPassphrase(TESTNET, TESTNET)).not.toThrow();
    try {
      assertNetworkPassphrase(TESTNET, MAINNET);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WalletError);
      expect((e as WalletError).code).toBe("WrongNetwork");
    }
  });

  it("refuses to sign when wallet is on the wrong network", async () => {
    const f = createFreighterAdapter(
      mockFreighter({
        getNetwork: async () => ({
          network: "PUBLIC",
          networkPassphrase: MAINNET,
        }),
      }),
    );
    await rejectsWithCode(
      () => signTransactionWithWallet(f, "XDR", { networkPassphrase: TESTNET }),
      "WrongNetwork",
    );
  });
});

describe("signing", () => {
  it("returns signed XDR through the wrapper", async () => {
    const f = createFreighterAdapter(mockFreighter());
    const signed = await signTransactionWithWallet(f, "XDR", {
      networkPassphrase: TESTNET,
    });
    expect(signed).toBe("SIGNED_XDR");
  });

  it("maps a rejected signature to UserRejected", async () => {
    const f = createFreighterAdapter(
      mockFreighter({
        signTransaction: async () => ({
          signedTxXdr: "",
          signerAddress: "",
          error: { message: "User declined access" },
        }),
      }),
    );
    await rejectsWithCode(
      () => f.signTransaction("XDR", { networkPassphrase: TESTNET }),
      "UserRejected",
    );
  });

  it("xBull without network reporting signs by default, refuses when required", async () => {
    const x = createXBullAdapter({
      connect: async () => {},
      getPublicKey: async () => "GBUYER",
      signXDR: async () => "XBULL_SIGNED",
    });
    expect(
      await signTransactionWithWallet(x, "XDR", { networkPassphrase: TESTNET }),
    ).toBe("XBULL_SIGNED");
    await rejectsWithCode(
      () =>
        signTransactionWithWallet(x, "XDR", {
          networkPassphrase: TESTNET,
          requireNetworkCheck: true,
        }),
      "WrongNetwork",
    );
  });
});

describe("dev signing-check builder", () => {
  it("refuses to build for a non-testnet passphrase (before any RPC call)", async () => {
    await rejectsWithCode(
      () =>
        buildDevSigningCheckXdr({
          source: "GBUYER",
          networkPassphrase: MAINNET,
        }),
      "WrongNetwork",
    );
  });
});

describe("error mapping", () => {
  it("classifies wallet error messages", () => {
    expect(toWalletError("User rejected the request").code).toBe(
      "UserRejected",
    );
    expect(toWalletError("Freighter is not installed").code).toBe(
      "MissingWallet",
    );
    expect(toWalletError({ message: "wallet is locked" }).code).toBe(
      "WalletNotConnected",
    );
    expect(toWalletError("boom", "SigningFailed").code).toBe("SigningFailed");
  });
});
