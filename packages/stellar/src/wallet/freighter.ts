import { toWalletError, WalletError } from "./errors.js";
import type { SignOptions, WalletAdapter, WalletNetwork } from "./types.js";

/**
 * Minimal Freighter provider surface (subset of @stellar/freighter-api v6).
 * Injectable so the adapter is unit-testable without a browser extension.
 */
export interface FreighterProvider {
  isConnected(): Promise<{ isConnected: boolean; error?: unknown }>;
  requestAccess(): Promise<{ address: string; error?: unknown }>;
  getAddress(): Promise<{ address: string; error?: unknown }>;
  getNetwork(): Promise<{
    network: string;
    networkPassphrase: string;
    error?: unknown;
  }>;
  signTransaction(
    xdr: string,
    opts: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedTxXdr: string; signerAddress: string; error?: unknown }>;
}

export type FreighterProviderLoader = () => Promise<FreighterProvider>;

/** Lazily loads the real Freighter API in a browser; no top-level import. */
async function defaultFreighterLoader(): Promise<FreighterProvider> {
  if (typeof window === "undefined") {
    throw new WalletError(
      "UnsupportedWallet",
      "Freighter is only available in the browser",
    );
  }
  const api = await import("@stellar/freighter-api");
  return {
    isConnected: () => api.isConnected(),
    requestAccess: () => api.requestAccess(),
    getAddress: () => api.getAddress(),
    getNetwork: () => api.getNetwork(),
    signTransaction: (xdr, opts) => api.signTransaction(xdr, opts),
  };
}

export class FreighterAdapter implements WalletAdapter {
  readonly id = "freighter" as const;
  readonly name = "Freighter";

  constructor(private readonly loadProvider: FreighterProviderLoader) {}

  private provider(): Promise<FreighterProvider> {
    return this.loadProvider();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await (await this.provider()).isConnected();
      return !res.error && res.isConnected;
    } catch {
      return false;
    }
  }

  async connect(): Promise<string> {
    const res = await this.provider().then((p) => p.requestAccess());
    if (res.error) throw toWalletError(res.error, "WalletNotConnected");
    if (!res.address) {
      throw new WalletError("WalletNotConnected", "no address returned");
    }
    return res.address;
  }

  async disconnect(): Promise<void> {
    // Freighter has no programmatic disconnect; connection is user-managed.
  }

  async getPublicKey(): Promise<string> {
    const res = await this.provider().then((p) => p.getAddress());
    if (res.error) throw toWalletError(res.error, "WalletNotConnected");
    if (!res.address) {
      throw new WalletError("WalletNotConnected", "wallet not connected");
    }
    return res.address;
  }

  async getNetwork(): Promise<WalletNetwork> {
    const res = await this.provider().then((p) => p.getNetwork());
    if (res.error) throw toWalletError(res.error, "UnknownWalletError");
    return { network: res.network, networkPassphrase: res.networkPassphrase };
  }

  async signTransaction(xdr: string, options: SignOptions): Promise<string> {
    let res: Awaited<ReturnType<FreighterProvider["signTransaction"]>>;
    try {
      res = await this.provider().then((p) =>
        p.signTransaction(xdr, {
          networkPassphrase: options.networkPassphrase,
          address: options.address,
        }),
      );
    } catch (e) {
      throw toWalletError(e, "SigningFailed");
    }
    if (res.error) throw toWalletError(res.error, "SigningFailed");
    if (!res.signedTxXdr) {
      throw new WalletError("SigningFailed", "wallet returned no signed XDR");
    }
    return res.signedTxXdr;
  }

  async requestNetwork(): Promise<void> {
    throw new WalletError(
      "UnsupportedWallet",
      "Freighter does not support programmatic network switching",
    );
  }
}

/** Create a Freighter adapter. Inject `provider` in tests; omit in the browser. */
export function createFreighterAdapter(
  provider?: FreighterProvider,
): FreighterAdapter {
  const loader: FreighterProviderLoader = provider
    ? async () => provider
    : defaultFreighterLoader;
  return new FreighterAdapter(loader);
}
