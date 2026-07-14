import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  rpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  addressToScVal,
  bytes32ToScVal,
  contractOrderIdToHex,
  type EscrowStatusName,
  i128ToScVal,
  normalizeEscrowStatus,
  u64ToScVal,
} from "./scval.js";

/** Decoded on-chain escrow order (see `EscrowOrder` in the Rust contract). */
export interface EscrowOrderView {
  orderId: string; // 32-byte contract order id, hex
  buyer: string;
  seller: string;
  payoutRecipient: string;
  amount: bigint;
  asset: string;
  status: EscrowStatusName;
  createdAt: bigint;
  fundedAt: bigint | null;
  releasedAt: bigint | null;
  refundedAt: bigint | null;
  expiresAt: bigint;
}

export interface EscrowClientOptions {
  server: rpc.Server;
  networkPassphrase: string;
  contractId: string;
}

export interface CreateOrderParams {
  /** Admin signs create_order. */
  admin: string;
  orderId: Uint8Array;
  buyer: string;
  seller: string;
  payoutRecipient: string;
  amount: bigint;
  expiresAt: bigint;
}

export interface FundOrderParams {
  buyer: string;
  orderId: Uint8Array;
  /** Amount the buyer expects to pay; must equal the stored amount. */
  amount: bigint;
}

/**
 * Builds (simulates + assembles) escrow contract transactions for wallet
 * signing, and reads on-chain order state. This layer never signs or submits
 * on behalf of a user — callers sign the returned transaction with their wallet
 * and submit via `submit`.
 *
 * The transaction `source` for each method is the address whose `require_auth`
 * the contract enforces (admin for create/release/refund/pause/unpause/admin
 * proposal, buyer for fund, proposed admin for acceptance, admin-or-buyer for
 * cancel), so source-account authorization satisfies the contract's checks.
 */
export class EscrowClient {
  private readonly server: rpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;

  constructor(options: EscrowClientOptions) {
    this.server = options.server;
    this.networkPassphrase = options.networkPassphrase;
    this.contractId = options.contractId;
  }

  private contract(): Contract {
    return new Contract(this.contractId);
  }

  private async buildInvoke(
    source: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<Transaction> {
    const account = await this.server.getAccount(source);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract().call(method, ...args))
      .setTimeout(180)
      .build();
    // Simulate + assemble Soroban footprint, auth, and resource fees.
    return this.server.prepareTransaction(tx);
  }

  buildProposeAdmin(admin: string, newAdmin: string): Promise<Transaction> {
    return this.buildInvoke(admin, "propose_admin", [
      addressToScVal(admin),
      addressToScVal(newAdmin),
    ]);
  }

  buildAcceptAdmin(newAdmin: string): Promise<Transaction> {
    return this.buildInvoke(newAdmin, "accept_admin", [
      addressToScVal(newAdmin),
    ]);
  }

  buildCreateOrder(params: CreateOrderParams): Promise<Transaction> {
    return this.buildInvoke(params.admin, "create_order", [
      bytes32ToScVal(params.orderId),
      addressToScVal(params.buyer),
      addressToScVal(params.seller),
      addressToScVal(params.payoutRecipient),
      i128ToScVal(params.amount),
      u64ToScVal(params.expiresAt),
    ]);
  }

  buildFundOrder(params: FundOrderParams): Promise<Transaction> {
    return this.buildInvoke(params.buyer, "fund_order", [
      bytes32ToScVal(params.orderId),
      addressToScVal(params.buyer),
      i128ToScVal(params.amount),
    ]);
  }

  buildReleaseToRecipient(
    admin: string,
    orderId: Uint8Array,
  ): Promise<Transaction> {
    return this.buildInvoke(admin, "release_to_recipient", [
      bytes32ToScVal(orderId),
      addressToScVal(admin),
    ]);
  }

  buildRefundToBuyer(admin: string, orderId: Uint8Array): Promise<Transaction> {
    return this.buildInvoke(admin, "refund_to_buyer", [
      bytes32ToScVal(orderId),
      addressToScVal(admin),
    ]);
  }

  buildCancelOrder(caller: string, orderId: Uint8Array): Promise<Transaction> {
    return this.buildInvoke(caller, "cancel_order", [
      bytes32ToScVal(orderId),
      addressToScVal(caller),
    ]);
  }

  buildPause(admin: string): Promise<Transaction> {
    return this.buildInvoke(admin, "pause_contract", [addressToScVal(admin)]);
  }

  buildUnpause(admin: string): Promise<Transaction> {
    return this.buildInvoke(admin, "unpause_contract", [addressToScVal(admin)]);
  }

  /** Read the currently configured on-chain admin. */
  async readAdmin(): Promise<string | null> {
    return this.readAddress("get_admin");
  }

  /** Read the USDC SAC address configured by the contract constructor. */
  async readUsdcToken(): Promise<string | null> {
    return this.readAddress("get_usdc_token");
  }

  private async readAddress(
    method: "get_admin" | "get_usdc_token",
  ): Promise<string | null> {
    const reader = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(reader, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract().call(method))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;
    const retval = sim.result?.retval;
    return retval ? String(scValToNative(retval)) : null;
  }

  /** Read an order's on-chain state; returns null if not found / unreadable. */
  async readOrder(orderId: Uint8Array): Promise<EscrowOrderView | null> {
    // A read-only simulation needs a source account but no signature/funding.
    const reader = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(reader, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract().call("get_order", bytes32ToScVal(orderId)))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;
    const retval = sim.result?.retval;
    if (!retval) return null;
    try {
      return decodeEscrowOrder(retval);
    } catch {
      return null;
    }
  }

  /** Submit a wallet-signed transaction XDR. Caller polls `getTransaction`. */
  submit(signedTxXdr: string): Promise<rpc.Api.SendTransactionResponse> {
    const tx = TransactionBuilder.fromXDR(
      signedTxXdr,
      this.networkPassphrase,
    ) as Transaction;
    return this.server.sendTransaction(tx);
  }

  getTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
    return this.server.getTransaction(hash);
  }
}

function decodeEscrowOrder(retval: xdr.ScVal): EscrowOrderView {
  const raw = scValToNative(retval) as Record<string, unknown>;
  const asBig = (v: unknown): bigint => BigInt(v as string | number | bigint);
  const asOptBig = (v: unknown): bigint | null => (v == null ? null : asBig(v));

  return {
    orderId: contractOrderIdToHex(raw.order_id as Uint8Array),
    buyer: String(raw.buyer),
    seller: String(raw.seller),
    payoutRecipient: String(raw.payout_recipient),
    amount: asBig(raw.amount),
    asset: String(raw.asset),
    status: normalizeEscrowStatus(raw.status),
    createdAt: asBig(raw.created_at),
    fundedAt: asOptBig(raw.funded_at),
    releasedAt: asOptBig(raw.released_at),
    refundedAt: asOptBig(raw.refunded_at),
    expiresAt: asBig(raw.expires_at),
  };
}
