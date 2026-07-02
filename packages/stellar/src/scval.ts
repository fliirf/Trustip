import { Address, hash, nativeToScVal, xdr } from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// ScVal argument builders for escrow contract calls.
// Types mirror the Rust signatures (Address, BytesN<32>, i128, u64).
// ---------------------------------------------------------------------------

export function addressToScVal(address: string): xdr.ScVal {
  return Address.fromString(address).toScVal();
}

export function i128ToScVal(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

export function u64ToScVal(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

export function bytes32ToScVal(bytes: Uint8Array): xdr.ScVal {
  if (bytes.length !== 32) {
    throw new Error(`expected a 32-byte value, got ${bytes.length}`);
  }
  return nativeToScVal(Buffer.from(bytes), { type: "bytes" });
}

/**
 * Deterministically map a Trustip order reference (the DB order UUID, or any
 * stable per-order string) to the 32-byte on-chain `order_id` via SHA-256.
 * The hex form is stored as `escrows.contract_order_id`.
 */
export function deriveContractOrderId(orderRef: string): Buffer {
  return hash(Buffer.from(orderRef, "utf8"));
}

export function contractOrderIdToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

// ---------------------------------------------------------------------------
// Escrow status decoding
// ---------------------------------------------------------------------------

export type EscrowStatusName =
  "Created" | "Funded" | "Released" | "Refunded" | "Cancelled";

const STATUS_NAMES: readonly EscrowStatusName[] = [
  "Created",
  "Funded",
  "Released",
  "Refunded",
  "Cancelled",
];

/**
 * Normalize the decoded `EscrowStatus` (a Soroban unit enum) into its name.
 * `scValToNative` may yield `["Funded"]`, `"Funded"`, or `{ tag: "Funded" }`
 * depending on encoding, so all three shapes are handled.
 */
export function normalizeEscrowStatus(raw: unknown): EscrowStatusName {
  let name: unknown = raw;
  if (Array.isArray(raw)) {
    name = raw[0];
  } else if (raw && typeof raw === "object" && "tag" in raw) {
    name = (raw as { tag: unknown }).tag;
  }
  if (
    typeof name === "string" &&
    (STATUS_NAMES as readonly string[]).includes(name)
  ) {
    return name as EscrowStatusName;
  }
  throw new Error(`unrecognized escrow status: ${JSON.stringify(raw)}`);
}
