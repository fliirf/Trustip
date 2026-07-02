import { toWalletError, WalletError } from "./errors.js";
import type { SignOptions, WalletAdapter, WalletNetwork } from "./types.js";

/**
 * xBull injected-SDK surface (`window.xBullSDK`). GUARDED / UNVERIFIED: the
 * exact browser API could not be verified against a live extension in this
 * environment. Detection is real (no faking) and all failures map to typed
 * WalletError. Verify method names + `signXDR` network semantics against the
 * live xBull extension before relying on it in production.
 */
export interface XBullProvider {
  connect(permissions: {
    canRequestPublicKey: boolean;
    canRequestSign: boolean;
  }): Promise<void>;
  getPublicKey(): Promise<string>;
  signXDR(
    xdr: string,
    options?: { network?: string; publicKey?: string },
  ): Promise<string>;
  getNetwork?(): Promise<{ network?: string; networkPassphrase?: string }>;
}

export type XBullProviderLoader = () => XBullProvider | undefined;

function defaultXBullLoader(): XBullProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { xBullSDK?: XBullProvider }).xBullSDK;
}

export class XBullAdapter implements WalletAdapter {
  readonly id = "xbull" as const;
  readonly name = "xBull";

  constructor(private readonly loadProvider: XBullProviderLoader) {}

  private require(): XBullProvider {
    const p = this.loadProvider();
    if (!p) {
      throw new WalletError("MissingWallet", "xBull is not installed/detected");
    }
    return p;
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.loadProvider() !== undefined;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    const p = this.require();
    try {
      await p.connect({ canRequestPublicKey: true, canRequestSign: true });
      return await p.getPublicKey();
    } catch (e) {
      throw toWalletError(e, "WalletNotConnected");
    }
  }

  async disconnect(): Promise<void> {
    // xBull injected SDK exposes no disconnect; connection is user-managed.
  }

  async getPublicKey(): Promise<string> {
    const p = this.require();
    try {
      return await p.getPublicKey();
    } catch (e) {
      throw toWalletError(e, "WalletNotConnected");
    }
  }

  async getNetwork(): Promise<WalletNetwork> {
    const p = this.require();
    if (!p.getNetwork) {
      throw new WalletError(
        "UnsupportedWallet",
        "xBull injected SDK does not report the active network",
      );
    }
    try {
      const res = await p.getNetwork();
      if (!res.networkPassphrase) {
        throw new WalletError(
          "UnsupportedWallet",
          "xBull did not return a network passphrase",
        );
      }
      return {
        network: res.network ?? "",
        networkPassphrase: res.networkPassphrase,
      };
    } catch (e) {
      throw toWalletError(e, "UnknownWalletError");
    }
  }

  async signTransaction(xdr: string, options: SignOptions): Promise<string> {
    const p = this.require();
    try {
      const signed = await p.signXDR(xdr, {
        network: options.networkPassphrase,
        publicKey: options.address,
      });
      if (!signed) {
        throw new WalletError("SigningFailed", "xBull returned no signed XDR");
      }
      return signed;
    } catch (e) {
      throw toWalletError(e, "SigningFailed");
    }
  }

  async requestNetwork(): Promise<void> {
    throw new WalletError(
      "UnsupportedWallet",
      "xBull does not support programmatic network switching",
    );
  }
}

/** Create an xBull adapter. Inject `provider` in tests; omit in the browser. */
export function createXBullAdapter(provider?: XBullProvider): XBullAdapter {
  const loader: XBullProviderLoader = provider
    ? () => provider
    : defaultXBullLoader;
  return new XBullAdapter(loader);
}
