// Seller-facing Indonesian copy. Product-first wording; status text always
// reflects BACKEND state.

export const STEP_LABELS = [
  { key: "profile", label: "Profil Toko" },
  { key: "connect", label: "Wallet Terhubung" },
  { key: "register", label: "Wallet Terdaftar" },
  { key: "verify", label: "Kepemilikan Terverifikasi" },
  { key: "primary", label: "Wallet Utama Dipilih" },
] as const;

/** Seller-facing order status copy (only statuses the backend actually has —
 * consistent with the buyer checkout language). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Menunggu Pembayaran",
  payment_submitted: "Pembayaran Diproses",
  payment_confirmed: "Pembayaran Dikonfirmasi",
  escrow_locked: "Pembayaran Dilindungi",
  processing: "Pesanan Diproses",
  packed: "Dikemas",
  shipped: "Dikirim",
  delivered: "Pesanan Diterima",
  completed: "Selesai",
  payout_pending: "Menunggu Pencairan",
  payout_completed: "Pencairan Selesai",
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
  not_created: "Belum Dibuat",
  created: "Menunggu Dana",
  funded: "Dana Terkunci",
  released: "Dana Diteruskan",
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

/** Map backend/wallet error codes to seller-friendly Indonesian copy. */
export function sellerErrorLabel(code: string, fallback: string): string {
  switch (code) {
    case "Forbidden":
      return "Sesi kamu berakhir. Silakan masuk lagi.";
    case "WrongNetwork":
    case "WalletWrongNetwork":
      return "Jaringan wallet tidak sesuai. Pindahkan wallet ke jaringan Stellar yang benar.";
    case "UserRejected":
      return "Tanda tangan dibatalkan di wallet.";
    case "SigningFailed":
      return "Tanda tangan gagal di wallet. Silakan coba lagi.";
    case "MissingWallet":
    case "WalletNotConnected":
      return "Wallet belum terpasang atau belum terhubung.";
    case "WalletNotFound":
      return "Wallet belum terdaftar. Daftarkan wallet dulu.";
    case "WalletChallengeUnavailable":
      return "Verifikasi wallet belum dikonfigurasi di server ini.";
    case "SellerNotReady":
      return "Selesaikan persiapan toko dulu (profil + wallet utama terverifikasi).";
    case "Conflict":
      return fallback.includes("verified")
        ? "Wallet harus diverifikasi dulu sebelum jadi wallet utama."
        : "Terjadi bentrok data. Silakan coba lagi.";
    case "RateLimited":
      return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
    case "InvalidInput":
      return (
        fallback ||
        "Data tidak valid atau verifikasi gagal. Minta tantangan baru dan tanda tangani dengan wallet yang terdaftar."
      );
    default:
      return fallback || "Terjadi kesalahan. Silakan coba lagi.";
  }
}
