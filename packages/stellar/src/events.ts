import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { contractOrderIdToHex } from "./scval.js";

/**
 * Escrow contract event reader (Phase 19, Part 3). Reads the events the Soroban
 * escrow contract publishes (escrow_created / _funded / _released / _refunded /
 * _cancelled, contract_paused / _unpaused) from Soroban RPC so the indexer can
 * persist them and reconcile local state. Read-only — no signing, no submit.
 *
 * NOTE: Soroban RPC only retains recent ledgers of events; durability is the
 * indexer's job (it persists every event + a checkpoint). This layer just
 * decodes a page of events and hands back a cursor to resume from.
 */

export type EscrowEventName =
  | "escrow_created"
  | "escrow_funded"
  | "escrow_released"
  | "escrow_refunded"
  | "escrow_cancelled"
  | "contract_paused"
  | "contract_unpaused"
  | "unknown";

export interface EscrowChainEvent {
  name: EscrowEventName;
  /** 32-byte on-chain order id (hex) — matches escrows.contract_order_id. Null
   * for pause/unpause which carry no order. */
  contractOrderIdHex: string | null;
  txHash: string;
  ledger: number;
  /** Best-effort source address from the event payload (buyer for fund). */
  from: string | null;
  /** Best-effort destination address (payout recipient for release, buyer for refund). */
  to: string | null;
  /** USDC amount in stroops (7-dp) as bigint, when the event carries one. */
  amount: bigint | null;
  /** RPC paging token — persist as the resume cursor. */
  cursor: string;
  raw: unknown;
}

export interface ReadEventsResult {
  events: EscrowChainEvent[];
  /** Cursor to resume from on the next poll (last event's, or latest ledger). */
  cursor: string | null;
  latestLedger: number;
}

const KNOWN: readonly EscrowEventName[] = [
  "escrow_created",
  "escrow_funded",
  "escrow_released",
  "escrow_refunded",
  "escrow_cancelled",
  "contract_paused",
  "contract_unpaused",
];

// Some SDK versions hand back parsed ScVal, others base64 XDR strings. Accept both.
function toScVal(x: unknown): xdr.ScVal {
  if (typeof x === "string") return xdr.ScVal.fromXDR(x, "base64");
  return x as xdr.ScVal;
}

function eventName(topic0: unknown): EscrowEventName {
  const name = String(scValToNative(toScVal(topic0)));
  return (KNOWN as readonly string[]).includes(name)
    ? (name as EscrowEventName)
    : "unknown";
}

function orderIdHex(topic1: unknown): string | null {
  if (topic1 == null) return null;
  try {
    const native = scValToNative(toScVal(topic1)) as Uint8Array;
    return native instanceof Uint8Array ? contractOrderIdToHex(native) : null;
  } catch {
    return null;
  }
}

/** Pull addresses + amount out of the decoded event payload, tolerant of shape. */
function decodePayload(value: unknown): {
  addresses: string[];
  amount: bigint | null;
} {
  let native: unknown;
  try {
    native = scValToNative(toScVal(value));
  } catch {
    return { addresses: [], amount: null };
  }
  const items = Array.isArray(native) ? native : [native];
  const addresses: string[] = [];
  let amount: bigint | null = null;
  for (const item of items) {
    if (typeof item === "string" && item.startsWith("G")) addresses.push(item);
    else if (typeof item === "bigint") amount = item;
    else if (typeof item === "number") amount = BigInt(item);
  }
  return { addresses, amount };
}

/**
 * Read a page of escrow contract events. Pass `cursor` to resume (from a prior
 * `ReadEventsResult.cursor`) OR `startLedger` for a cold start — not both.
 */
export async function readEscrowEvents(
  server: rpc.Server,
  contractId: string,
  opts: { startLedger?: number; cursor?: string; limit?: number },
): Promise<ReadEventsResult> {
  const filters = [{ type: "contract" as const, contractIds: [contractId] }];
  const limit = opts.limit ?? 100;
  // GetEventsRequest is a discriminated union: cursor XOR ledger range.
  const request: rpc.Api.GetEventsRequest = opts.cursor
    ? { filters, cursor: opts.cursor, limit }
    : { filters, startLedger: Math.max(1, opts.startLedger ?? 1), limit };

  const page = await server.getEvents(request);
  const raw = page.events ?? [];

  const events: EscrowChainEvent[] = raw.map((e) => {
    const topic = (e.topic ?? []) as unknown[];
    const name = eventName(topic[0]);
    const { addresses, amount } = decodePayload(e.value);
    // For fund/refund the first address is the buyer (source); for release it is
    // the payout recipient (destination). Keep both slots best-effort.
    const from = addresses[0] ?? null;
    const to = name === "escrow_released" ? addresses[0] ?? null : addresses[1] ?? null;
    return {
      name,
      contractOrderIdHex: orderIdHex(topic[1]),
      txHash: e.txHash,
      ledger: e.ledger,
      from: name === "escrow_released" ? null : from,
      to,
      amount,
      cursor: e.id,
      raw: { topicCount: topic.length },
    };
  });

  return { events, cursor: page.cursor ?? null, latestLedger: page.latestLedger };
}
