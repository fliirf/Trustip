// Buyer-facing Indonesian copy per the approved UX language. Status text always
// reflects BACKEND state — the client never invents a success message.

import type { CheckoutPhase } from "./useCheckoutFlow";

export const PHASE_LABEL: Record<CheckoutPhase, string> = {
  form: "Isi Data Pesanan",
  "creating-order": "Membuat pesanan…",
  "order-ready": "Hubungkan Wallet",
  connecting: "Menghubungkan wallet…",
  connected: "Siap Membayar",
  "requesting-token": "Menyiapkan pembayaran…",
  "creating-escrow": "Menyiapkan pembayaran…",
  preparing: "Menyiapkan pembayaran…",
  "awaiting-signature": "Tanda Tangani di Wallet",
  submitting: "Mengirim transaksi…",
  confirming: "Pembayaran Diproses",
  confirmed: "Pesanan Aman",
  failed: "Pembayaran Gagal",
};

/** Step labels for the visible progress timeline. */
export const TIMELINE_STEPS = [
  { key: "order", label: "Pesanan Dibuat" },
  { key: "wallet", label: "Wallet Terhubung" },
  { key: "sign", label: "Tanda Tangan" },
  { key: "confirm", label: "Pembayaran Diproses" },
  { key: "safe", label: "Pesanan Aman" },
] as const;

/** Map backend/wallet error codes to buyer-friendly Indonesian copy. */
export function errorLabel(code: string, fallback: string): string {
  switch (code) {
    case "WrongNetwork":
    case "WalletWrongNetwork":
      return "Jaringan wallet tidak sesuai. Pastikan wallet berada di jaringan Stellar yang benar.";
    case "UserRejected":
      return "Transaksi ditolak di wallet. Silakan coba lagi.";
    case "SigningFailed":
      return "Tanda tangan gagal di wallet. Silakan coba lagi.";
    case "MissingWallet":
    case "WalletNotConnected":
      return "Wallet belum terpasang atau belum terhubung.";
    case "SubmitRejected":
      return "Transaksi ditolak jaringan. Periksa saldo USDC kamu, lalu coba lagi.";
    case "RpcFailure":
      return "Pembayaran belum bisa disiapkan. Periksa saldo USDC di wallet kamu, lalu coba lagi.";
    case "RateLimited":
      return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
    case "CheckoutNotFound":
      return "Link checkout tidak ditemukan.";
    case "CheckoutNotAvailable":
      return "Link checkout sudah tidak aktif.";
    case "OrderNotPayable":
      return "Pesanan ini sudah tidak bisa dibayar.";
    case "EscrowAlreadyFunded":
      return "Pembayaran untuk pesanan ini sudah diterima.";
    case "WrongBuyer":
      return "Wallet yang terhubung tidak cocok dengan pesanan ini.";
    case "WalletNotInstalled":
      return "Wallet belum terpasang di browser ini.";
    case "InvalidInput":
      return fallback || "Data tidak valid. Periksa kembali isian kamu.";
    default:
      return fallback || "Terjadi kesalahan. Silakan coba lagi.";
  }
}

/** Errors where a plain retry of the same step is likely to succeed. */
export function isRetryable(code: string): boolean {
  return [
    "RpcFailure",
    "RateLimited",
    "UserRejected",
    "SigningFailed",
    "SubmitRejected",
    "InternalError",
  ].includes(code);
}
