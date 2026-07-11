// Buyer-facing status copy. Lifecycle derivation lives in
// `features/escrow/lifecycle` and is shared with the seller dashboard, so both
// surfaces read the same backend truth. Re-exported here so buyer components
// keep importing lifecycle helpers from one place.

import { isReleased } from "../escrow/lifecycle";
import type { PublicOrderStatus } from "./status-api";

export {
  awaitingShipment,
  escrowCoreState,
  isProtected,
  isReleased,
  isTerminalBad,
  lifecycleRail,
  shipmentProgress,
} from "../escrow/lifecycle";
export type { RailStep, RailStepState } from "../escrow/lifecycle";

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
  // Buyer-facing: the reading says what the money is doing, not which
  // mechanism holds it. "Escrow"/"Soroban" stay in the metadata layer
  // (telemetry rails, receipt network line).
  funded: "Dana Ditahan Aman",
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

export const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  processing: "Pesanan Diproses",
  packed: "Pesanan Dikemas",
  shipped: "Pesanan Dikirim",
};
