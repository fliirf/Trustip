import {
  Address,
  rpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { currentNetwork, getEscrowContractId } from "@trustip/config";
import { createEscrowClient } from "./network.js";
import { createEnvOperatorSigner, type OperatorSigner } from "./operator.js";
import type { EscrowStatusName } from "./scval.js";

// ---------------------------------------------------------------------------
// Normalized, RPC-type-free view of the escrow contract, tailored to the
// payment backend (prepare/submit/sync). Keeping stellar-sdk / rpc types inside
// this package (never leaking into @trustip/payments) preserves the module
// boundary: all chain access goes through @trustip/stellar.
// ---------------------------------------------------------------------------

/** Subset of on-chain order state the payment backend reasons about. */
export interface GatewayOrderView {
  status: EscrowStatusName;
  amount: bigint;
  buyer: string;
  seller: string;
  /** Frozen on-chain release destination (set at create_order). Optional so
   * existing fakes/tests stay valid; the live gateway always provides it. */
  payoutRecipient?: string;
}

/** Result of statically inspecting a wallet-signed fund transaction (offline). */
export interface ParsedFundTx {
  /** Transaction hash (hex) — deterministic, used for idempotency. */
  hash: string;
  /** Source account of the transaction (must be the paying buyer). */
  source: string;
  /** Whether the tx carries a Soroban invokeHostFunction op. */
  invokesContract: boolean;
  /** Contract id targeted by the invocation, if extractable. */
  contractId?: string;
  /** Invoked function name, if extractable. */
  functionName?: string;
  /**
   * Decoded `fund_order(order_id, buyer, amount)` arguments, when the invocation
   * is a `fund_order` call. Used to bind the signed tx to the exact order,
   * buyer, and amount of the prepared payment attempt.
   */
  contractOrderId?: string; // BytesN<32> order id, hex
  buyer?: string; // buyer Address argument
  amountUnits?: bigint; // i128 amount (7-decimal USDC units)
}

export type SubmitStatus =
  "PENDING" | "DUPLICATE" | "ERROR" | "TRY_AGAIN_LATER";

export interface SubmitResult {
  hash: string;
  status: SubmitStatus;
  /** Serialized RPC error result, present only on ERROR/TRY_AGAIN_LATER. */
  errorResult?: string;
}

export type TxResultStatus = "SUCCESS" | "FAILED" | "NOT_FOUND";

export interface TxResult {
  status: TxResultStatus;
  ledger?: number;
}

export interface FundOrderXdrInput {
  buyerPublicKey: string;
  contractOrderIdHex: string;
  /** Amount in 7-decimal USDC units (contract i128). */
  amountUnits: bigint;
}

/** Inputs for an admin/operator-signed `create_order` invocation. All values are
 * server-derived (never client amount/status). */
export interface CreateOrderGatewayInput {
  buyerPublicKey: string;
  sellerPublicKey: string;
  payoutRecipient: string;
  contractOrderIdHex: string;
  amountUnits: bigint;
  /** Fund-window expiry as a unix timestamp in seconds (contract u64). */
  expiresAt: bigint;
}

export interface CreateOrderGatewayResult {
  hash: string;
  status: SubmitStatus;
  /** Serialized RPC error result, present only on ERROR/TRY_AGAIN_LATER. */
  errorResult?: string;
  /** Admin/operator source account that signed create_order. */
  sourceAccount: string;
}

/**
 * Normalized escrow gateway used by the payment backend. The concrete
 * implementation wraps `EscrowClient` + Soroban RPC; unit tests supply an
 * in-memory fake with the same shape.
 */
export interface EscrowGateway {
  readonly networkPassphrase: string;
  readonly contractId: string;
  /** Read on-chain order state, or null if it does not exist / is unreadable. */
  readOrder(contractOrderIdHex: string): Promise<GatewayOrderView | null>;
  /** Build+sign(admin/operator)+submit a `create_order` tx. The operator signer
   * is server-only and resolved lazily; this throws `OperatorSignerError` when
   * the signer is unavailable or not permitted on the active network. */
  createOrder(
    input: CreateOrderGatewayInput,
  ): Promise<CreateOrderGatewayResult>;
  /** Build+sign(admin/operator)+submit a `release_to_recipient` tx. Same
   * fail-closed operator policy as `createOrder` (mainnet refused unless the
   * signer strategy is explicitly allowed). */
  releaseOrder(input: {
    contractOrderIdHex: string;
  }): Promise<CreateOrderGatewayResult>;
  /** Build the buyer's unsigned, simulation-prepared `fund_order` XDR. */
  buildFundOrderXdr(input: FundOrderXdrInput): Promise<string>;
  /** Statically inspect a signed fund tx (no network I/O). */
  parseFundTx(signedXdr: string): ParsedFundTx;
  /** Submit a wallet-signed tx to the network. */
  submit(signedXdr: string): Promise<SubmitResult>;
  /** Poll a submitted tx's final result. */
  getTransactionResult(hash: string): Promise<TxResult>;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`invalid hex string: ${hex}`);
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

interface DecodedInvocation {
  contractId?: string;
  functionName?: string;
  contractOrderId?: string;
  buyer?: string;
  amountUnits?: bigint;
}

/**
 * Decode a Soroban invokeHostFunction: the target contract, function name, and
 * — when it is `fund_order(order_id, buyer, amount)` — the three arguments. All
 * decoding is defensive; anything unrecognized is left undefined so callers can
 * fail closed.
 */
function decodeInvocation(func: xdr.HostFunction): DecodedInvocation {
  try {
    if (func.switch().name !== "hostFunctionTypeInvokeContract") return {};
    const invoke = func.invokeContract();
    const contractId = Address.fromScAddress(
      invoke.contractAddress(),
    ).toString();
    const functionName = invoke.functionName().toString();
    const decoded: DecodedInvocation = { contractId, functionName };

    if (functionName === "fund_order") {
      const args = invoke.args();
      // fund_order(order_id: BytesN<32>, buyer: Address, amount: i128)
      if (args.length >= 3) {
        const orderIdNative = scValToNative(args[0]);
        if (
          orderIdNative instanceof Uint8Array ||
          Buffer.isBuffer(orderIdNative)
        ) {
          decoded.contractOrderId = Buffer.from(orderIdNative).toString("hex");
        }
        const buyerNative = scValToNative(args[1]);
        if (typeof buyerNative === "string") decoded.buyer = buyerNative;
        const amountNative = scValToNative(args[2]);
        if (
          typeof amountNative === "bigint" ||
          typeof amountNative === "number" ||
          typeof amountNative === "string"
        ) {
          decoded.amountUnits = BigInt(amountNative);
        }
      }
    }
    return decoded;
  } catch {
    return {};
  }
}

/**
 * Statically inspect a signed transaction XDR (no network I/O, no env). Exposed
 * standalone so it is unit-testable without a configured contract id. Rejects
 * fee-bump envelopes (buyer fund txs are plain v1 transactions).
 */
export function parseSignedFundTx(
  signedXdr: string,
  networkPassphrase: string,
): ParsedFundTx {
  const parsed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  if (!(parsed instanceof Transaction)) {
    throw new Error("expected a plain (non-fee-bump) transaction");
  }
  const tx = parsed;
  let invokesContract = false;
  let decoded: DecodedInvocation = {};
  for (const op of tx.operations) {
    const anyOp = op as unknown as {
      type?: string;
      func?: xdr.HostFunction;
    };
    if (anyOp.type === "invokeHostFunction" && anyOp.func) {
      invokesContract = true;
      decoded = decodeInvocation(anyOp.func);
      break;
    }
  }
  return {
    hash: tx.hash().toString("hex"),
    source: tx.source,
    invokesContract,
    contractId: decoded.contractId,
    functionName: decoded.functionName,
    contractOrderId: decoded.contractOrderId,
    buyer: decoded.buyer,
    amountUnits: decoded.amountUnits,
  };
}

class SorobanEscrowGateway implements EscrowGateway {
  readonly networkPassphrase = currentNetwork.networkPassphrase;
  readonly contractId = getEscrowContractId();
  private readonly client = createEscrowClient();
  private readonly server = new rpc.Server(currentNetwork.rpcUrl, {
    allowHttp: currentNetwork.rpcUrl.startsWith("http://"),
  });
  /** Lazily resolved so prepare/submit/sync never touch the operator secret and
   * a testnet dev without it can still run the buyer flow. */
  private operatorSigner?: OperatorSigner;

  private operator(): OperatorSigner {
    return (this.operatorSigner ??= createEnvOperatorSigner());
  }

  async readOrder(
    contractOrderIdHex: string,
  ): Promise<GatewayOrderView | null> {
    const view = await this.client.readOrder(hexToBytes(contractOrderIdHex));
    if (!view) return null;
    return {
      status: view.status,
      amount: view.amount,
      buyer: view.buyer,
      seller: view.seller,
      payoutRecipient: view.payoutRecipient,
    };
  }

  async releaseOrder(input: {
    contractOrderIdHex: string;
  }): Promise<CreateOrderGatewayResult> {
    const operator = this.operator(); // throws OperatorSignerError if unavailable
    const tx = await this.client.buildReleaseToRecipient(
      operator.publicKey,
      hexToBytes(input.contractOrderIdHex),
    );
    const signedXdr = await operator.signXdr(
      tx.toXDR(),
      this.networkPassphrase,
    );
    const res = await this.client.submit(signedXdr);
    const errorResult = res.errorResult
      ? JSON.stringify(res.errorResult)
      : undefined;
    return {
      hash: res.hash,
      status: res.status as SubmitStatus,
      errorResult,
      sourceAccount: operator.publicKey,
    };
  }

  async createOrder(
    input: CreateOrderGatewayInput,
  ): Promise<CreateOrderGatewayResult> {
    const operator = this.operator(); // throws OperatorSignerError if unavailable
    const tx = await this.client.buildCreateOrder({
      admin: operator.publicKey,
      orderId: hexToBytes(input.contractOrderIdHex),
      buyer: input.buyerPublicKey,
      seller: input.sellerPublicKey,
      payoutRecipient: input.payoutRecipient,
      amount: input.amountUnits,
      expiresAt: input.expiresAt,
    });
    const signedXdr = await operator.signXdr(
      tx.toXDR(),
      this.networkPassphrase,
    );
    const res = await this.client.submit(signedXdr);
    const errorResult = res.errorResult
      ? JSON.stringify(res.errorResult)
      : undefined;
    return {
      hash: res.hash,
      status: res.status as SubmitStatus,
      errorResult,
      sourceAccount: operator.publicKey,
    };
  }

  async buildFundOrderXdr(input: FundOrderXdrInput): Promise<string> {
    const tx = await this.client.buildFundOrder({
      buyer: input.buyerPublicKey,
      orderId: hexToBytes(input.contractOrderIdHex),
      amount: input.amountUnits,
    });
    return tx.toXDR();
  }

  parseFundTx(signedXdr: string): ParsedFundTx {
    return parseSignedFundTx(signedXdr, this.networkPassphrase);
  }

  async submit(signedXdr: string): Promise<SubmitResult> {
    const res = await this.client.submit(signedXdr);
    const errorResult = res.errorResult
      ? JSON.stringify(res.errorResult)
      : undefined;
    return { hash: res.hash, status: res.status as SubmitStatus, errorResult };
  }

  async getTransactionResult(hash: string): Promise<TxResult> {
    const res = await this.server.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { status: "SUCCESS", ledger: res.ledger };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { status: "FAILED", ledger: res.ledger };
    }
    return { status: "NOT_FOUND" };
  }
}

/** Create the live escrow gateway wired to the active network + env contract. */
export function createEscrowGateway(): EscrowGateway {
  return new SorobanEscrowGateway();
}
