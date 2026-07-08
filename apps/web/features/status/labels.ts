// Buyer-facing status copy + lifecycle derivation. ONLY real backend statuses
// — nothing here invents progress the backend has not recorded.

import type { PublicOrderStatus } from "./status-api";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Menunggu Pembayaran",
  payment_submitted: "Pembayaran Diproses",
  payment_confirmed: "Pembayaran Dikonfirmasi",
  escrow_locked: "Dana Sudah Dilindungi",
  processing: "Pesanan Diproses",
  packed: "Dikemas",
  shipped: "Dikirim",
  delivered: "Pesanan Diterima",
  completed: "Selesai",
  payout_pending: "Selesai",
  payout_completed: "Selesai",
  refund_requested: "Refund Diajukan",
  refund_review: "Refund Ditinjau",
  refunded: "Dana Dikembalikan",
  cancelled: "Dibatalkan",
  failed: "Gagal",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  awaiting_signature: "Menunggu Tanda Tangan",
  submitted: "Pembayaran Diproses",
  confirmed: "Pembayaran Dikonfirmasi",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Dana Dikembalikan",
};

export const ESCROW_STATUS_LABEL: Record<string, string> = {
  not_created: "Belum Aktif",
  created: "Menunggu Dana",
  funded: "Dana Terkunci di Escrow",
  released: "Dana Diteruskan ke Penjual",
  refunded: "Dana Dikembalikan",
  cancelled: "Dibatalkan",
  paused: "Ditahan Sementara",
};

export function statusLabel(
  map: Record<string, string>,
  status: string | undefined | null,
): string {
  if (!status) return "—";
  return map[status] ?? status;
}

/** True when the buyer's money is actually protected on-chain. */
export function isProtected(order: PublicOrderStatus): boolean {
  return order.escrow?.status === "funded" || order.status === "escrow_locked";
}

export function isTerminalBad(order: PublicOrderStatus): boolean {
  return ["refunded", "cancelled", "failed"].includes(order.status);
}

/** True once the buyer-confirmed release has actually landed on-chain — the
 * only state where the funds have moved to the seller. Backend truth only. */
export function isReleased(order: PublicOrderStatus): boolean {
  return order.escrow?.status === "released" || order.status === "completed";
}

/** Eligible to show the "Saya Sudah Terima Pesanan" CTA. Mirrors the backend
 * release preconditions exactly so the button never appears when a confirm
 * would be rejected: shipped, shipment shipped, escrow funded, payment
 * confirmed, and not already released. */
export function canConfirmReceived(order: PublicOrderStatus): boolean {
  return (
    order.status === "shipped" &&
    order.shipment?.status === "shipped" &&
    order.escrow?.status === "funded" &&
    order.payment?.status === "confirmed" &&
    !isReleased(order)
  );
}

/** Protected + paid but the seller has not shipped yet — buyer waits. */
export function awaitingShipment(order: PublicOrderStatus): boolean {
  return (
    isProtected(order) &&
    !isReleased(order) &&
    order.shipment?.status !== "shipped" &&
    order.status !== "shipped"
  );
}

/** Map confirm-received backend/wallet error codes to buyer-safe Indonesian
 * copy. Never hides a safety failure — every rejection stays visible. */
export function confirmErrorLabel(code: string, fallback: string): string {
  switch (code) {
    case "WrongBuyer":
      return "Wallet ini bukan wallet pembayar pesanan ini.";
    case "Forbidden":
      return "Sesi konfirmasi kedaluwarsa. Coba lagi.";
    case "WrongNetwork":
      return "Jaringan wallet tidak sesuai. Pastikan wallet berada di jaringan Stellar yang benar.";
    case "UserRejected":
      return "Tanda tangan dibatalkan di wallet. Silakan coba lagi.";
    case "SigningFailed":
      return "Tanda tangan gagal di wallet. Silakan coba lagi.";
    case "MissingWallet":
    case "WalletNotConnected":
      return "Wallet belum terpasang atau belum terhubung.";
    case "Conflict":
      return "Pesanan belum bisa dikonfirmasi. Muat ulang halaman lalu coba lagi.";
    case "AmountMismatch":
    case "ChainOrderMismatch":
      return "Data pesanan tidak cocok. Hubungi penjual sebelum melanjutkan.";
    case "RpcFailure":
      return "Jaringan sedang sibuk. Coba lagi sebentar.";
    case "SubmitRejected":
      return "Konfirmasi belum berhasil diproses jaringan. Coba lagi sebentar.";
    case "AdminSignerMissing":
    case "AdminSignerNotAllowedOnMainnet":
    case "WalletChallengeUnavailable":
      return "Layanan konfirmasi belum siap. Coba lagi nanti.";
    case "RateLimited":
      return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
    case "CheckoutNotFound":
      return "Pesanan tidak ditemukan.";
    default:
      return fallback || "Terjadi kesalahan. Silakan coba lagi.";
  }
}

/** Confirm errors where retrying the same step is likely to succeed. */
export function isConfirmRetryable(code: string): boolean {
  return [
    "RpcFailure",
    "SubmitRejected",
    "RateLimited",
    "UserRejected",
    "SigningFailed",
    "Forbidden",
    "InternalError",
  ].includes(code);
}

export type RailStepState = "done" | "current" | "locked";

export interface RailStep {
  key: string;
  label: string;
  state: RailStepState;
}

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  processing: "Pesanan Diproses",
  packed: "Pesanan Dikemas",
  shipped: "Pesanan Dikirim",
};

const PROCESSING_DONE = [
  "processing",
  "packed",
  "shipped",
  "delivered",
  "completed",
];
const SHIPPING_DONE = ["shipped", "delivered", "completed"];
const POST_PROTECTION = [
  "escrow_locked",
  ...PROCESSING_DONE,
  "payout_pending",
  "payout_completed",
];

/** Fulfillment progress index from backend truth (order status OR the real
 * shipment record — whichever is further, both are backend-recorded). */
export function shipmentProgress(order: PublicOrderStatus): number {
  const rank = (s: string | undefined | null): number =>
    s ? ["processing", "packed", "shipped"].indexOf(s) + 1 : 0;
  return Math.max(
    rank(order.shipment?.status),
    SHIPPING_DONE.includes(order.status)
      ? 3
      : order.status === "packed"
        ? 2
        : order.status === "processing"
          ? 1
          : 0,
  );
}

/** Derive the 5-step lifecycle rail from BACKEND state only. Future steps are
 * "locked" (never shown as progress the backend has not recorded). Delivery/
 * completion/release steps deliberately do not exist yet (later guarded phase). */
export function lifecycleRail(order: PublicOrderStatus): RailStep[] {
  const paid =
    order.payment?.status === "confirmed" ||
    POST_PROTECTION.includes(order.status);
  const protectedNow =
    isProtected(order) || POST_PROTECTION.includes(order.status);
  const progress = shipmentProgress(order);
  const processing = progress >= 1;
  const shipped = progress >= 3;

  const step = (
    key: string,
    label: string,
    done: boolean,
    prevDone: boolean,
  ): RailStep => ({
    key,
    label,
    state: done ? "done" : prevDone ? "current" : "locked",
  });

  return [
    { key: "created", label: "Pesanan Dibuat", state: "done" },
    step("paid", "Pembayaran", paid, true),
    step("protected", "Dana Dilindungi", protectedNow, paid),
    step("processing", "Diproses Seller", processing, protectedNow),
    step("shipped", "Dikirim", shipped, processing),
  ];
}
