import { rpc } from "@stellar/stellar-sdk";
import {
  currentNetwork,
  getEscrowContractId,
  type NetworkConfig,
} from "@trustip/config";
import { EscrowClient } from "./escrow.js";
import type { NetworkName } from "./explorer.js";

export { getNetworkConfig, currentNetwork } from "@trustip/config";
export type { NetworkConfig } from "@trustip/config";

/** Soroban RPC client for the given (default: active) network. */
export function getRpcServer(cfg: NetworkConfig = currentNetwork): rpc.Server {
  return new rpc.Server(cfg.rpcUrl, {
    allowHttp: cfg.rpcUrl.startsWith("http://"),
  });
}

/** "testnet" | "mainnet" derived from the network passphrase. */
export function networkName(cfg: NetworkConfig = currentNetwork): NetworkName {
  return cfg.networkPassphrase.includes("Public") ? "mainnet" : "testnet";
}

/** Escrow client wired to the active network + deployed contract id (env). */
export function createEscrowClient(): EscrowClient {
  return new EscrowClient({
    server: getRpcServer(),
    networkPassphrase: currentNetwork.networkPassphrase,
    contractId: getEscrowContractId(),
  });
}
