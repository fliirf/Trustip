"use client";

// ⚠️ DEV ONLY — manual wallet-signing check. NOT a checkout page.
// Does NOT submit transactions. Does NOT mark any payment as paid.
// Testnet only. Exists purely to verify the Freighter/xBull signing layer
// against a real browser extension.

import { useState } from "react";
import {
  buildDevSigningCheckXdr,
  currentNetwork,
  getAvailableWallets,
  getWalletAdapter,
  signTransactionWithWallet,
  WalletError,
  type WalletAvailability,
  type WalletId,
} from "@trustip/stellar";

function describeError(e: unknown): string {
  return e instanceof WalletError ? `${e.code}: ${e.message}` : String(e);
}

export default function DevWalletPage() {
  const [wallets, setWallets] = useState<WalletAvailability[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pubkey, setPubkey] = useState<string>("");
  const [xdr, setXdr] = useState<string>("");
  const [signed, setSigned] = useState<string>("");

  async function refresh(): Promise<void> {
    setWallets(await getAvailableWallets());
  }

  async function connect(id: WalletId): Promise<void> {
    setStatus(`connecting ${id}…`);
    setSigned("");
    try {
      const adapter = getWalletAdapter(id);
      const pk = await adapter.connect();
      setPubkey(pk);
      let net = "unreported";
      try {
        net = (await adapter.getNetwork()).networkPassphrase;
      } catch {
        /* wallet cannot report network */
      }
      const ok = net === currentNetwork.networkPassphrase;
      setStatus(
        `connected ${id}: ${pk.slice(0, 10)}… | wallet net: ${net} | expected: ${currentNetwork.networkPassphrase} | ${ok ? "NETWORK OK" : "WRONG NETWORK"}`,
      );
    } catch (e) {
      setStatus(`error: ${describeError(e)}`);
    }
  }

  async function generateDevXdr(): Promise<void> {
    if (!pubkey) {
      setStatus("connect a wallet first to use its public key as the source");
      return;
    }
    setStatus("generating unsigned testnet DEV signing-check XDR…");
    setSigned("");
    try {
      const generated = await buildDevSigningCheckXdr({
        source: pubkey,
        networkPassphrase: currentNetwork.networkPassphrase,
      });
      setXdr(generated);
      setStatus(
        "unsigned DEV signing-check XDR generated (testnet). Not submitted.",
      );
    } catch (e) {
      setStatus(`generate error: ${describeError(e)}`);
    }
  }

  async function sign(id: WalletId): Promise<void> {
    setSigned("");
    try {
      const adapter = getWalletAdapter(id);
      const result = await signTransactionWithWallet(adapter, xdr, {
        networkPassphrase: currentNetwork.networkPassphrase,
        address: pubkey || undefined,
      });
      setSigned(result); // signed XDR only — NOT submitted anywhere
    } catch (e) {
      setStatus(`sign error: ${describeError(e)}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 820, fontFamily: "monospace" }}>
      <h1>DEV — Wallet Signing Check</h1>
      <p style={{ color: "#ef4444" }}>
        DEV ONLY. Does not submit. Does not mark payment. Testnet only.
      </p>
      <p style={{ color: "#ef4444" }}>
        This only tests wallet signing. It does not submit a transaction or mark
        payment as paid.
      </p>
      <p>Expected network passphrase: {currentNetwork.networkPassphrase}</p>

      <button onClick={refresh}>Detect wallets</button>
      <ul>
        {wallets.map((w) => (
          <li key={w.id}>
            {w.name} — installed: {String(w.installed)}{" "}
            <button onClick={() => connect(w.id)}>Connect</button>{" "}
            <button onClick={() => sign(w.id)}>Sign XDR (no submit)</button>
          </li>
        ))}
      </ul>

      <p>Status: {status}</p>
      <p>Public key: {pubkey}</p>

      <p>
        <button onClick={generateDevXdr}>
          Generate DEV signing-check XDR (testnet)
        </button>{" "}
        <small>
          harmless manageData tx from your connected key — never submitted
        </small>
      </p>

      <label>
        Unsigned transaction XDR (generated above, or paste a testnet XDR):
        <textarea
          value={xdr}
          onChange={(e) => setXdr(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />
      </label>

      {signed && (
        <div>
          <p>Signed XDR (not submitted):</p>
          <textarea
            readOnly
            value={signed}
            rows={4}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </main>
  );
}
