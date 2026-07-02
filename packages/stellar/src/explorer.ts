export type NetworkName = "testnet" | "mainnet";

const EXPLORER_BASE: Record<NetworkName, string> = {
  testnet: "https://stellar.expert/explorer/testnet",
  mainnet: "https://stellar.expert/explorer/public",
};

export function explorerTxUrl(network: NetworkName, txHash: string): string {
  return `${EXPLORER_BASE[network]}/tx/${txHash}`;
}

export function explorerAccountUrl(
  network: NetworkName,
  address: string,
): string {
  return `${EXPLORER_BASE[network]}/account/${address}`;
}

export function explorerContractUrl(
  network: NetworkName,
  contractId: string,
): string {
  return `${EXPLORER_BASE[network]}/contract/${contractId}`;
}
