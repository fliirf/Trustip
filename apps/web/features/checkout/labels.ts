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

/** Sub-line naming the protocol step actually in flight. Shown under the phase
 * headline while busy, so a slow Stellar confirmation reads as progress instead
 * of a hang. Only phases that wait on something external get one. */
export const PHASE_DETAIL: Partial<Record<CheckoutPhase, string>> = {
  "creating-escrow": "Menyiapkan perlindungan dana",
  preparing: "Menyiapkan transaksi pembayaran",
  // Actionable, not descriptive: this is the one step where the buyer has to
  // DO something outside this page.
  "awaiting-signature": "Buka jendela wallet kamu dan setujui permintaan tanda tangan",
  submitting: "Menunggu jaringan Stellar",
  confirming: "Memverifikasi pembayaran. Biasanya hanya beberapa detik",
};

/** What the buyer should DO about each failure. The `errorLabel` copy says what
 * happened; this says how to recover. Absent = the retry button is the answer. */
export function errorHint(code: string): string | null {
  switch (code) {
    case "WrongNetwork":
    case "WalletWrongNetwork":
      return "Buka wallet kamu, pindah ke jaringan Stellar yang benar, lalu muat ulang halaman ini.";
    case "MissingWallet":
    case "WalletNotConnected":
    case "WalletNotInstalled":
      return "Pasang Freighter atau xBull, lalu muat ulang halaman ini.";
    case "UserRejected":
      return "Kamu menolak permintaan tanda tangan. Dana kamu belum berpindah.";
    case "SubmitRejected":
      return "Pastikan saldo USDC kamu cukup untuk membayar pesanan ini.";
    case "RpcFailure":
      return "Jaringan Stellar sedang sibuk. Dana kamu belum berpindah.";
    case "WrongBuyer":
      return "Hubungkan wallet yang kamu pakai saat membuat pesanan ini.";
    case "EscrowAlreadyFunded":
      return "Buka halaman status pesanan untuk melihat perlindungan dana kamu.";
    case "CheckoutNotAvailable":
    case "OrderNotPayable":
      return "Minta link checkout baru ke penjual.";
    // A backend failure can land either side of the signature, so we must not
    // claim the funds did or did not move. Point at the status page instead of
    // inviting a second payment.
    case "ServiceUnavailable":
    case "InternalError":
      return "Kalau kamu sudah menandatangani transaksi di wallet, jangan bayar ulang. Buka halaman status pesanan untuk memeriksanya.";
    default:
      return null;
  }
}

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
    case "ServiceUnavailable":
      return "Trustip sedang mengalami gangguan sementara.";
    case "InternalError":
      return "Terjadi kesalahan.";
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
    "ServiceUnavailable",
  ].includes(code);
}
