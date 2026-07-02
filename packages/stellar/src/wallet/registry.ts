import { createFreighterAdapter } from "./freighter.js";
import { createXBullAdapter } from "./xbull.js";
import type {
  WalletAdapter,
  WalletAvailability,
  WalletId,
  WalletMetadata,
} from "./types.js";

export const WALLET_METADATA: Record<WalletId, WalletMetadata> = {
  freighter: {
    id: "freighter",
    name: "Freighter",
    installUrl: "https://www.freighter.app/",
    supportedNetworks: ["testnet", "mainnet"],
  },
  xbull: {
    id: "xbull",
    name: "xBull",
    installUrl: "https://xbull.app/",
    supportedNetworks: ["testnet", "mainnet"],
  },
};

/** Construct an adapter for a wallet id (browser providers wired lazily). */
export function getWalletAdapter(id: WalletId): WalletAdapter {
  switch (id) {
    case "freighter":
      return createFreighterAdapter();
    case "xbull":
      return createXBullAdapter();
    default: {
      const exhaustive: never = id;
      throw new Error(`unknown wallet id: ${String(exhaustive)}`);
    }
  }
}

/** Metadata for all wallets plus a runtime `installed` probe (never throws). */
export async function getAvailableWallets(): Promise<WalletAvailability[]> {
  const ids = Object.keys(WALLET_METADATA) as WalletId[];
  return Promise.all(
    ids.map(async (id) => {
      let installed = false;
      try {
        installed = await getWalletAdapter(id).isAvailable();
      } catch {
        installed = false;
      }
      return { ...WALLET_METADATA[id], installed };
    }),
  );
}
