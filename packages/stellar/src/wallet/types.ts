import type { NetworkName } from "../explorer.js";

export type WalletId = "freighter" | "xbull";

export interface WalletNetwork {
  /** Network label as reported by the wallet (e.g. "TESTNET"). */
  network: string;
  /** Canonical network passphrase (source of truth for network safety). */
  networkPassphrase: string;
}

export interface SignOptions {
  networkPassphrase: string;
  /** Address expected to sign (optional; wallets may enforce). */
  address?: string;
}

/**
 * Common browser-wallet interface. Implementations wrap a specific extension.
 * All rejections are thrown as `WalletError` (see errors.ts) — never silent.
 */
export interface WalletAdapter {
  readonly id: WalletId;
  readonly name: string;

  /** True if the wallet extension is present/reachable. Never throws. */
  isAvailable(): Promise<boolean>;

  /** Prompt the user to authorize; resolves to the account public key. */
  connect(): Promise<string>;

  /** Disconnect if the wallet supports it; otherwise a no-op. */
  disconnect(): Promise<void>;

  /** Currently authorized public key (throws WalletNotConnected if none). */
  getPublicKey(): Promise<string>;

  /** Wallet's active network. Throws UnsupportedWallet if not reportable. */
  getNetwork(): Promise<WalletNetwork>;

  /** Sign a prepared transaction XDR; returns the signed XDR. */
  signTransaction(xdr: string, options: SignOptions): Promise<string>;

  /**
   * Request the wallet switch networks if supported; otherwise throws
   * UnsupportedWallet (neither Freighter nor xBull expose programmatic switch).
   */
  requestNetwork(networkPassphrase: string): Promise<void>;
}

export interface WalletMetadata {
  id: WalletId;
  name: string;
  installUrl: string;
  supportedNetworks: NetworkName[];
}

export interface WalletAvailability extends WalletMetadata {
  installed: boolean;
}
