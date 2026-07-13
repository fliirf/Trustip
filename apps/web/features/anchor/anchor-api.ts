// Client-side SEP-24 on-ramp against a Stellar anchor (Roadmap B). All calls run
// in the browser: the anchor's stellar.toml + SEP-10/SEP-24 endpoints are
// fetched directly, the buyer's wallet signs the SEP-10 challenge, and the
// interactive deposit UI opens in a new tab. No Trustip backend is involved —
// the anchor JWT is the buyer's session with the anchor, held only in memory.

/** `message` is either a sentinel code (translated at the render site via
 * `d.anchor.errors`, since this module has no useDict access) or the external
 * anchor's own error text, passed through unchanged. */
export class AnchorApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnchorApiError";
  }
}

export interface AnchorInfo {
  /** SEP-10 Web Auth endpoint. */
  webAuthEndpoint: string;
  /** SEP-24 transfer server base URL. */
  transferServerSep24: string;
}

/** SEP-1 discovery: resolve the anchor's SEP-10 + SEP-24 endpoints from its
 * published stellar.toml. */
export async function fetchAnchorInfo(domain: string): Promise<AnchorInfo> {
  const res = await fetch(`https://${domain}/.well-known/stellar.toml`);
  if (!res.ok) throw new AnchorApiError("ANCHOR_INFO_UNAVAILABLE");
  const toml = await res.text();
  const grab = (key: string): string | undefined =>
    toml.match(new RegExp(`${key}\\s*=\\s*"([^"]+)"`))?.[1];
  const webAuthEndpoint = grab("WEB_AUTH_ENDPOINT");
  const transferServerSep24 = grab("TRANSFER_SERVER_SEP0024");
  if (!webAuthEndpoint || !transferServerSep24) {
    throw new AnchorApiError("ANCHOR_UNSUPPORTED");
  }
  return { webAuthEndpoint, transferServerSep24 };
}

/** SEP-10 step 1 — request a challenge transaction for the account. */
export async function getAnchorChallenge(
  webAuthEndpoint: string,
  account: string,
): Promise<{ transaction: string; networkPassphrase: string }> {
  const res = await fetch(
    `${webAuthEndpoint}?account=${encodeURIComponent(account)}`,
  );
  const body = (await res.json().catch(() => ({}))) as {
    transaction?: string;
    network_passphrase?: string;
    error?: string;
  };
  if (!res.ok || !body.transaction) {
    throw new AnchorApiError(body.error ?? "ANCHOR_AUTH_REJECTED");
  }
  return {
    transaction: body.transaction,
    networkPassphrase: body.network_passphrase ?? "",
  };
}

/** SEP-10 step 2 — exchange the signed challenge for the anchor's session JWT. */
export async function postAnchorToken(
  webAuthEndpoint: string,
  signedXdr: string,
): Promise<string> {
  const res = await fetch(webAuthEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    error?: string;
  };
  if (!res.ok || !body.token) {
    throw new AnchorApiError(body.error ?? "ANCHOR_TOKEN_REJECTED");
  }
  return body.token;
}

export interface InteractiveDeposit {
  /** Anchor-hosted interactive URL to open (new tab). */
  url: string;
  /** Anchor transaction id, for status polling. */
  id: string;
}

/** SEP-24 — start an interactive deposit for `assetCode` to `account`. */
export async function startInteractiveDeposit(
  transferServerSep24: string,
  jwt: string,
  input: { assetCode: string; account: string },
): Promise<InteractiveDeposit> {
  const res = await fetch(
    `${transferServerSep24}/transactions/deposit/interactive`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        asset_code: input.assetCode,
        account: input.account,
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    id?: string;
    error?: string;
  };
  if (!res.ok || !body.url || !body.id) {
    throw new AnchorApiError(body.error ?? "ANCHOR_DEPOSIT_START_FAILED");
  }
  return { url: body.url, id: body.id };
}

export interface AnchorTransaction {
  /** SEP-24 status: incomplete, pending_user_transfer_start, pending_anchor,
   * pending_trust, completed, error, refunded, … */
  status: string;
  amountOut: string | null;
  stellarTxId: string | null;
}

/** SEP-24 — poll a transaction's status. */
export async function getAnchorTransaction(
  transferServerSep24: string,
  jwt: string,
  id: string,
): Promise<AnchorTransaction> {
  const res = await fetch(
    `${transferServerSep24}/transaction?id=${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${jwt}` } },
  );
  const body = (await res.json().catch(() => ({}))) as {
    transaction?: {
      status?: string;
      amount_out?: string;
      stellar_transaction_id?: string;
    };
    error?: string;
  };
  const tx = body.transaction;
  if (!res.ok || !tx?.status) {
    throw new AnchorApiError(body.error ?? "ANCHOR_STATUS_UNAVAILABLE");
  }
  return {
    status: tx.status,
    amountOut: tx.amount_out ?? null,
    stellarTxId: tx.stellar_transaction_id ?? null,
  };
}
