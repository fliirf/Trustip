import { StrKey } from "@stellar/stellar-sdk";

/** True if `value` is a valid Stellar ed25519 public key (G... strkey). */
export function isValidPublicKey(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value);
}

/** True if `value` is a valid Stellar contract id (C... strkey). */
export function isValidContractId(value: string): boolean {
  return StrKey.isValidContract(value);
}
