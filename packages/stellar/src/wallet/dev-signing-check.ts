import {
  Account,
  BASE_FEE,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { getRpcServer } from "../network.js";
import { WalletError } from "./errors.js";

/** Marker written by the DEV signing-check transaction. */
export const DEV_SIGNING_CHECK_LABEL = "DEV SIGNING CHECK ONLY";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export interface DevSigningCheckParams {
  /** Connected wallet public key (used as the transaction source). */
  source: string;
  /** Must be the testnet passphrase — this helper refuses any other network. */
  networkPassphrase: string;
}

/**
 * DEV / TESTNET ONLY. Builds a harmless UNSIGNED transaction whose sole purpose
 * is to verify wallet signing. It contains a single `manageData` op labeled
 * "DEV SIGNING CHECK ONLY" plus a memo. It is NEVER submitted and does NOT
 * represent or imply any payment.
 *
 * Requires a funded testnet source account (loads sequence via testnet RPC). If
 * the account cannot be loaded (e.g. unfunded), throws a typed WalletError —
 * it never fabricates an XDR.
 */
export async function buildDevSigningCheckXdr(
  params: DevSigningCheckParams,
): Promise<string> {
  if (params.networkPassphrase !== TESTNET_PASSPHRASE) {
    throw new WalletError(
      "WrongNetwork",
      "DEV signing check is testnet-only; refusing to build for another network",
    );
  }

  const server = getRpcServer();
  let account: Account;
  try {
    account = await server.getAccount(params.source);
  } catch (e) {
    throw new WalletError(
      "RpcFailure",
      "Could not load the source account on testnet (is it funded?)",
      e,
    );
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.manageData({
        name: "trustip:dev-signing-check",
        value: DEV_SIGNING_CHECK_LABEL,
      }),
    )
    .addMemo(Memo.text("DEV SIGNING CHECK"))
    .setTimeout(120)
    .build();

  return tx.toXDR();
}
