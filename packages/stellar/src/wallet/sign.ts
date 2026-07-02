import { WalletError } from "./errors.js";
import type { SignOptions, WalletAdapter } from "./types.js";

/** Throws WrongNetwork unless the two network passphrases match exactly. */
export function assertNetworkPassphrase(
  expected: string,
  actual: string,
): void {
  if (expected !== actual) {
    throw new WalletError(
      "WrongNetwork",
      `wallet network mismatch: expected "${expected}", wallet is on "${actual}"`,
    );
  }
}

export interface SignWithWalletOptions extends SignOptions {
  /**
   * If true, refuse to sign when the wallet cannot report its active network
   * (defaults to false — the signature is still bound to `networkPassphrase`).
   */
  requireNetworkCheck?: boolean;
}

/**
 * Network-safe signing: validates the wallet's active network (when the wallet
 * can report it) against the target passphrase, then requests a signature and
 * returns the signed XDR.
 *
 * This helper NEVER: exposes secret keys, submits the transaction, or reports a
 * payment as successful. It only returns signed XDR for a caller to submit and
 * verify on-chain.
 */
export async function signTransactionWithWallet(
  adapter: WalletAdapter,
  xdr: string,
  options: SignWithWalletOptions,
): Promise<string> {
  try {
    const net = await adapter.getNetwork();
    assertNetworkPassphrase(options.networkPassphrase, net.networkPassphrase);
  } catch (e) {
    if (e instanceof WalletError && e.code === "WrongNetwork") {
      throw e;
    }
    if (e instanceof WalletError && e.code === "UnsupportedWallet") {
      if (options.requireNetworkCheck) {
        throw new WalletError(
          "WrongNetwork",
          "wallet cannot report its active network; refusing to sign",
        );
      }
      // Proceed: the signature remains bound to `options.networkPassphrase`.
    } else {
      throw e;
    }
  }

  return adapter.signTransaction(xdr, {
    networkPassphrase: options.networkPassphrase,
    address: options.address,
  });
}
