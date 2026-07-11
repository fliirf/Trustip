import Link from "next/link";
import { InfoShell } from "../../features/info/InfoShell";

// PHASE 16 — FAQ. Real human questions, short calming answers, zero jargon in
// the questions. Native <details> rows on engraved rules — no client JS, no new
// visual language. Answers never promise UI that does not exist yet and never
// claim more than the backend enforces.

export const metadata = {
  title: "Pertanyaan Umum · Trustip",
  description: "Jawaban singkat untuk pertanyaan paling umum tentang Trustip.",
};

const FAQ = [
  {
    // The one comparison first-timers actually make. Factual only: no
    // competitor named, no marketing claim.
    q: "Apa bedanya dengan transfer biasa?",
    a: "Transfer biasa langsung memindahkan uang ke penjual saat itu juga. Lewat Trustip, dana ditahan aman lebih dulu dan baru diteruskan setelah kamu mengonfirmasi pesanan diterima.",
  },
  {
    q: "Apakah uang saya langsung masuk ke penjual?",
    a: "Tidak. Dana kamu ditahan aman lebih dulu, dan hanya diteruskan ke penjual setelah kamu mengonfirmasi pesanan sudah diterima.",
  },
  {
    q: "Bagaimana kalau barang tidak dikirim?",
    a: "Dana tidak akan diteruskan ke penjual tanpa konfirmasi dari kamu, jadi uang kamu tidak hilang begitu saja. Hubungi penjual lebih dulu; kalau tidak menemukan jalan keluar, kamu bisa mengajukan bantuan ke Trustip.",
  },
  {
    q: "Bagaimana kalau saya berubah pikiran?",
    a: "Sebelum membayar, cukup tinggalkan halaman checkout. Tidak ada dana yang berpindah. Setelah membayar, dana tetap tertahan aman; hubungi penjual untuk membatalkan pesanan.",
  },
  {
    q: "Bagaimana kalau internet saya terputus saat membayar?",
    a: "Pembayaran diverifikasi dari jaringan, bukan dari browser kamu. Buka halaman status pesanan untuk memeriksa hasilnya, dan jangan membayar ulang sebelum memeriksanya.",
  },
  {
    q: "Bagaimana saya tahu pembayaran berhasil?",
    a: "Halaman status pesanan menampilkan “Pesanan Aman” setelah pembayaran terverifikasi. Kamu juga mendapat bukti transaksi yang tercatat permanen.",
  },
  {
    q: "Apakah saya harus mengerti crypto?",
    a: "Tidak perlu memahami teknologinya. Kamu hanya butuh wallet Stellar (Freighter atau xBull) dengan saldo USDC, dan Trustip memandu setiap langkahnya.",
  },
  {
    q: "Apakah pembayaran saya bisa diverifikasi?",
    a: "Ya. Setiap pembayaran tercatat permanen dan bisa diperiksa siapa pun lewat tombol “Lihat di Explorer” di halaman status pesanan.",
  },
  {
    q: "Di mana saya bisa melihat transaksinya?",
    a: "Di halaman status pesanan, bagian Bukti Transaksi. Dari sana kamu bisa menyalin buktinya, mencetaknya, atau membukanya di explorer publik.",
  },
] as const;

export default function FaqPage() {
  return (
    <InfoShell>
      <section className="py-14">
        <h1 className="os-title text-bone">Pertanyaan Umum</h1>
        <p className="os-body mt-4 max-w-[52ch] text-mist/80">
          Jawaban singkat untuk hal-hal yang paling sering ditanyakan sebelum
          dan sesudah membayar lewat Trustip.
        </p>

        <div className="mt-12">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group engraved-b">
              <summary className="os-press flex list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="os-body font-medium text-bone">{q}</span>
                {/* The word is the affordance, in the OS's own voice. */}
                <span
                  aria-hidden
                  className="micro-label shrink-0 text-ash group-open:hidden"
                >
                  Buka
                </span>
                <span
                  aria-hidden
                  className="micro-label hidden shrink-0 text-blood group-open:inline"
                >
                  Tutup
                </span>
              </summary>
              <p className="os-body max-w-[56ch] pb-6 text-mist/80">{a}</p>
            </details>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-5 pb-8">
          <Link
            href="/cara-kerja"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            Lihat Cara Kerja
          </Link>
          <Link
            href="/buyer"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            Buka Checkout atau Cek Status
          </Link>
        </div>
      </section>
    </InfoShell>
  );
}
