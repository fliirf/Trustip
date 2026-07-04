// Seller-facing Indonesian copy. Product-first wording; status text always
// reflects BACKEND state.

export const STEP_LABELS = [
  { key: "profile", label: "Profil Toko" },
  { key: "connect", label: "Wallet Terhubung" },
  { key: "register", label: "Wallet Terdaftar" },
  { key: "verify", label: "Kepemilikan Terverifikasi" },
  { key: "primary", label: "Wallet Utama Dipilih" },
] as const;

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
