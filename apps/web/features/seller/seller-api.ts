// Typed fetch wrappers for seller onboarding. Client-safe: local response types
// only — never imports @trustip/payments (server-only deps). Every status shown
// to the seller comes from these BACKEND responses; the client never marks a
// wallet verified or primary itself.

export class SellerApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "SellerApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SellerProfile {
  id: string;
  userId: string;
  storeName: string;
  category: string | null;
  socialUrl: string | null;
}

export interface SellerWallet {
  id: string;
  userId: string;
  walletProvider: "freighter" | "xbull";
  publicKey: string;
  network: "testnet" | "mainnet";
  isPrimary: boolean;
  verifiedAt: string | null;
}

export interface SellerOnboardingStatus {
  profile: SellerProfile | null;
  wallets: SellerWallet[];
  /** Backend truth: verified primary wallet on the configured network. */
  checkoutReady: boolean;
}

export interface WalletChallenge {
  challengeXdr: string;
  challengeToken: string;
  expiresAt: string;
  networkPassphrase: string;
}

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let code = "InternalError";
    let message = "terjadi kesalahan";
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // non-JSON error body — keep defaults
    }
    const retryAfter = res.headers.get("retry-after");
    throw new SellerApiError(
      code,
      message,
      res.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }
  return (await res.json()) as T;
}

export function getOnboarding(token: string): Promise<SellerOnboardingStatus> {
  return request<SellerOnboardingStatus>("/api/seller/profile", token);
}

export function saveProfile(
  token: string,
  input: { storeName: string; category?: string; socialUrl?: string },
): Promise<SellerProfile> {
  return request<SellerProfile>("/api/seller/profile", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function registerWallet(
  token: string,
  input: {
    walletProvider: "freighter" | "xbull";
    publicKey: string;
    network: "testnet" | "mainnet";
  },
): Promise<SellerWallet> {
  return request<SellerWallet>("/api/seller/wallets", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestWalletChallenge(
  token: string,
  input: { publicKey: string; network: "testnet" | "mainnet" },
): Promise<WalletChallenge> {
  return request<WalletChallenge>("/api/seller/wallets/challenge", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyWallet(
  token: string,
  input: {
    publicKey: string;
    network: "testnet" | "mainnet";
    signedXdr: string;
    challengeToken: string;
  },
): Promise<SellerWallet> {
  return request<SellerWallet>("/api/seller/wallets/verify", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setPrimaryWallet(
  token: string,
  input: { walletId: string },
): Promise<SellerWallet> {
  return request<SellerWallet>("/api/seller/wallets/primary", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface SellerCheckoutLink {
  id: string;
  sellerProfileId: string;
  slug: string;
  title: string;
  description: string | null;
  priceUsdc: string;
  status: string;
  createdAt: string;
  requiresShipping: boolean;
}

export function listCheckoutLinks(
  token: string,
): Promise<{ links: SellerCheckoutLink[] }> {
  return request<{ links: SellerCheckoutLink[] }>(
    "/api/seller/checkout-links",
    token,
  );
}

export interface SellerOrderBuyer {
  name: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface SellerShipment {
  status: string;
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

export interface SellerOrder {
  orderId: string;
  orderNo: string;
  status: string;
  totalUsdc: string;
  quantity: number | null;
  createdAt: string;
  /** Set only once the order has actually completed (buyer-confirmed release). */
  completedAt: string | null;
  link: { title: string; slug: string } | null;
  buyer: SellerOrderBuyer | null;
  payment: { status: string; txHash: string | null } | null;
  /** `releaseTxHash` is null until the escrow is actually released on-chain —
   * never rendered as proof before then. */
  escrow: {
    status: string;
    fundedTxHash: string | null;
    releaseTxHash: string | null;
  } | null;
  shipment: SellerShipment | null;
  requiresShipping: boolean;
}

export function listSellerOrders(
  token: string,
): Promise<{ orders: SellerOrder[] }> {
  return request<{ orders: SellerOrder[] }>("/api/seller/orders", token);
}

/** Seller shipment lifecycle write (Phase 8B). The status union is the ONLY
 * thing this client can send — no paid/funded/released/completed exists here.
 * All transition legality is enforced by the backend. */
export function updateShipment(
  token: string,
  orderNo: string,
  input: {
    status: "processing" | "packed" | "shipped" | "delivered";
    courier?: string;
    trackingNumber?: string;
    note?: string;
  },
): Promise<{
  orderNo: string;
  orderStatus: string;
  shipment: SellerShipment;
  updatedAt: string;
}> {
  return request(
    `/api/seller/orders/${encodeURIComponent(orderNo)}/shipment`,
    token,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function createCheckoutLink(
  token: string,
  input: {
    title: string;
    description?: string;
    priceUsdc: string;
    requiresShipping?: boolean;
  },
): Promise<SellerCheckoutLink> {
  return request<SellerCheckoutLink>("/api/seller/checkout-links", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface TrustProfile {
  sellerProfileId: string;
  totalOrders: number;
  completedOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
  totalReviews: number;
  averageRating: string;
  refundRate: string;
  trustScore: string;
  level: string;
}

export interface TrustReview {
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface TrustEvent {
  eventType: string;
  scoreDelta: string;
  createdAt: string;
}

export interface SellerTrust {
  profile: TrustProfile;
  reviews: TrustReview[];
  events: TrustEvent[];
}

export function getSellerTrust(token: string): Promise<SellerTrust> {
  return request<SellerTrust>("/api/seller/trust", token);
}

export type PayoutMethodType =
  | "usdc_wallet"
  | "xlm_wallet"
  | "moneygram_cashout";

export interface PayoutMethod {
  id: string;
  methodType: PayoutMethodType;
  displayName: string;
  isDefault: boolean;
  status: string;
  stellarAddress: string | null;
  assetCode: string | null;
  cashoutCountry: string | null;
  cashoutCurrency: string | null;
  createdAt: string;
}

export function listPayoutMethods(
  token: string,
): Promise<{ methods: PayoutMethod[] }> {
  return request<{ methods: PayoutMethod[] }>("/api/seller/payout-methods", token);
}

/** Discriminated by methodType. usdc/xlm reference a VERIFIED wallet by id;
 * moneygram carries country/currency only. */
export type AddPayoutMethodBody =
  | {
      methodType: "usdc_wallet" | "xlm_wallet";
      displayName: string;
      walletId: string;
      isDefault?: boolean;
    }
  | {
      methodType: "moneygram_cashout";
      displayName: string;
      cashoutCountry: string;
      cashoutCurrency: string;
      isDefault?: boolean;
    };

export function addPayoutMethod(
  token: string,
  body: AddPayoutMethodBody,
): Promise<PayoutMethod> {
  return request<PayoutMethod>("/api/seller/payout-methods", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function setDefaultPayoutMethod(
  token: string,
  id: string,
): Promise<{ payoutMethodId: string; isDefault: true }> {
  return request(`/api/seller/payout-methods/${encodeURIComponent(id)}/set-default`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function disablePayoutMethod(
  token: string,
  id: string,
): Promise<{ payoutMethodId: string; status: "disabled" }> {
  return request(`/api/seller/payout-methods/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
}
