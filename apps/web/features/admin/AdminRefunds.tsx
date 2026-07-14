"use client";

// Internal admin refund queue (REFUND-2). Ops-facing tool — deliberately
// plain: sign in with an admin Supabase account, review open requests,
// approve (on-chain refund to the funding wallet) or reject. All authority
// lives server-side (users.role = 'admin'); this UI is just a window.
// ponytail: hardcoded strings, no i18n — internal tool, not buyer-facing.

import { useCallback, useEffect, useState } from "react";
import { useSellerSession } from "../seller/useSellerSession";

interface AdminRefundRow {
  id: string;
  orderNo: string;
  status: string;
  reasonCode: string;
  description: string | null;
  requestedAmountUsdc: string | null;
  createdAt: string;
  orderStatus: string;
  escrowStatus: string | null;
  shipmentStatus: string | null;
}

interface ResolveResult {
  refundRequestId: string;
  status: string;
  refundTxHash: string | null;
}

interface EvidenceItem {
  id: string;
  fileType: string;
  evidenceType: string;
  note: string | null;
  createdAt: string;
  signedUrl: string;
}

export function AdminRefunds() {
  const { loading, accessToken, email, signIn, signOut } = useSellerSession();
  const [rows, setRows] = useState<AdminRefundRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [lastResult, setLastResult] = useState<ResolveResult | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    const res = await fetch("/api/admin/refunds", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 403) {
      setError("This account is not an admin.");
      setRows(null);
      return;
    }
    if (!res.ok) {
      setError(`Failed to load refunds (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { refunds: AdminRefundRow[] };
    setRows(body.refunds);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, action: "approve" | "reject") {
    if (!accessToken) return;
    setBusyId(id);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const body = (await res.json()) as
        | ResolveResult
        | { error?: { code?: string; message?: string } };
      if (!res.ok) {
        const err = (body as { error?: { code?: string; message?: string } })
          .error;
        setError(`${err?.code ?? res.status}: ${err?.message ?? "failed"}`);
        return;
      }
      setLastResult(body as ResolveResult);
      setNote("");
      setConfirmingId(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="p-8 text-mist">Checking session…</p>;

  if (!accessToken) return <AdminSignIn signIn={signIn} />;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-bone">Refund Queue</h1>
        <div className="text-sm text-ash">
          {email}{" "}
          <button
            type="button"
            onClick={() => void signOut()}
            className="underline underline-offset-4 hover:text-mist"
          >
            sign out
          </button>
        </div>
      </div>

      {error && <p className="mt-6 text-blood">{error}</p>}
      {lastResult && (
        <p className="mt-6 text-mist">
          Refund {lastResult.refundRequestId.slice(0, 8)} →{" "}
          <strong>{lastResult.status}</strong>
          {lastResult.refundTxHash && (
            <span className="font-mono text-sm"> tx {lastResult.refundTxHash}</span>
          )}
        </p>
      )}

      {rows && rows.length === 0 && (
        <p className="mt-10 text-mist">No open refund requests.</p>
      )}

      <ul className="mt-8 space-y-6">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="border border-hairline px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-sm text-bone">{r.orderNo}</span>
              <span className="text-sm text-ash">
                {r.requestedAmountUsdc ?? "—"} USDC · {r.status}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-mist md:grid-cols-4">
              <div>
                <dt className="text-ash">Reason</dt>
                <dd>{r.reasonCode}</dd>
              </div>
              <div>
                <dt className="text-ash">Order</dt>
                <dd>{r.orderStatus}</dd>
              </div>
              <div>
                <dt className="text-ash">Escrow</dt>
                <dd>{r.escrowStatus ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ash">Shipment</dt>
                <dd>{r.shipmentStatus ?? "—"}</dd>
              </div>
            </dl>
            {r.description && (
              <p className="mt-3 max-w-[70ch] text-sm text-mist/80">
                “{r.description}”
              </p>
            )}

            <AdminEvidence id={r.id} accessToken={accessToken} />

            {confirmingId === r.id ? (
              <div className="mt-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Decision note (optional)"
                  rows={2}
                  className="w-full border border-hairline bg-void px-3 py-2 text-sm text-mist"
                />
                <div className="mt-3 flex gap-4">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void resolve(r.id, "approve")}
                    className="border border-hairline px-4 py-2 text-sm font-semibold text-bone disabled:opacity-50"
                  >
                    {busyId === r.id
                      ? "Refunding on-chain…"
                      : "Confirm APPROVE (refund buyer)"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void resolve(r.id, "reject")}
                    className="border border-hairline px-4 py-2 text-sm text-mist disabled:opacity-50"
                  >
                    Confirm REJECT
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => setConfirmingId(null)}
                    className="text-sm text-ash underline underline-offset-4"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(r.id);
                  setNote("");
                }}
                className="mt-4 text-sm text-bone underline underline-offset-4"
              >
                Resolve…
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminEvidence({
  id,
  accessToken,
}: {
  id: string;
  accessToken: string;
}) {
  const [items, setItems] = useState<EvidenceItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/refunds/${id}/evidence`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setError(`Failed to load evidence (${res.status}).`);
        return;
      }
      const body = (await res.json()) as { evidence: EvidenceItem[] };
      setItems(body.evidence);
    } finally {
      setLoading(false);
    }
  }

  if (items === null) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="mt-3 text-sm text-ash underline underline-offset-4 hover:text-mist disabled:opacity-50"
      >
        {loading ? "Loading evidence…" : "View evidence"}
      </button>
    );
  }

  if (error) return <p className="mt-3 text-sm text-blood">{error}</p>;
  if (items.length === 0)
    return <p className="mt-3 text-sm text-ash">No evidence attached.</p>;

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {items.map((it) => (
        <a
          key={it.id}
          href={it.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-hairline p-1"
          title={it.evidenceType}
        >
          {it.fileType === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={it.signedUrl}
              alt={it.evidenceType}
              className="h-24 w-24 object-cover"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center px-2 text-center text-xs text-mist">
              {it.fileType} · {it.evidenceType}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function AdminSignIn({
  signIn,
}: {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(email, password);
    if (res.error) setError(res.error);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm px-5 py-20">
      <h1 className="text-xl font-semibold text-bone">Admin Sign In</h1>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
        className="mt-6 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        className="mt-3 w-full border border-hairline bg-void px-3 py-2.5 text-mist"
      />
      {error && <p className="mt-4 text-sm text-blood">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 border border-hairline px-5 py-2.5 font-semibold text-bone disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
