import Link from "next/link";
import { InfoShell } from "../../features/info/InfoShell";

// PHASE 16 — "Cara Kerja", the plain-language walkthrough. Five human steps,
// zero blockchain terminology in the main flow; the mechanism lives in one
// expandable disclosure at the bottom, where metadata belongs. Reuses the
// existing OS grammar only (spine, nodes, type roles, materials) — no new
// visual language.

export const metadata = {
  title: "Cara Kerja · Trustip",
  description:
    "Lima langkah pembayaran yang dilindungi Trustip, dari checkout sampai dana diteruskan.",
};

const STEPS = [
  {
    title: "Buka link checkout",
    body: "Seller membagikan link Trustip lewat DM, WhatsApp, atau halaman toko. Kamu mengisi data pesanan seperti checkout biasa.",
  },
  {
    title: "Bayar, dan dana langsung diamankan",
    body: "Pembayaran kamu diterima lalu ditahan aman. Dana tidak langsung masuk ke penjual.",
  },
  {
    title: "Penjual mengirim pesanan",
    body: "Kamu bisa memantau perkembangan pesanan kapan saja lewat halaman status, termasuk nomor resi setelah barang dikirim.",
  },
  {
    title: "Kamu konfirmasi penerimaan",
    body: "Setelah barang sampai di tangan kamu, konfirmasi bahwa pesanan sudah diterima.",
  },
  {
    title: "Dana diteruskan ke penjual",
    body: "Transaksi selesai dan tercatat permanen. Bukti transaksi bisa kamu lihat, salin, atau cetak kapan saja.",
  },
] as const;

export default function CaraKerjaPage() {
  return (
    <InfoShell>
      <section className="py-14">
        <h1 className="os-title text-bone">Cara Kerja Trustip</h1>
        <p className="os-body mt-4 max-w-[52ch] text-mist/80">
          Trustip menjaga pembayaran kamu tetap aman sampai pesanan benar-benar
          diterima. Begini jalannya, dari awal sampai selesai.
        </p>

        {/* The flow, descending one spine — the same rule the status page runs. */}
        <div className="relative mt-14 pl-8">
          <span aria-hidden className="control-spine absolute inset-y-0 left-0" />
          <ol className="space-y-12">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <span
                  aria-hidden
                  className="control-node absolute top-[3px] left-[calc(-2rem-2.5px)] size-[7px] bg-void"
                />
                <div className="micro-label text-ash tabular-nums">
                  0{i + 1}
                </div>
                <div className="os-reading mt-2 text-bone">{s.title}</div>
                <p className="os-body mt-2 max-w-[52ch] text-mist/80">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Layer 2 — the mechanism, disclosed on request. Native <details>:
            no client JS on an info route. */}
        <details className="group engraved-t mt-16 pt-8">
          <summary className="os-press micro-label list-none text-mist hover:text-bone [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="mr-3 text-blood group-open:hidden">
              +
            </span>
            <span aria-hidden className="mr-3 hidden text-blood group-open:inline">
              −
            </span>
            Bagaimana Trustip mengamankan dana?
          </summary>
          <div className="mt-5 max-w-[56ch]">
            <p className="os-note text-mist/80">
              Di balik layar, dana kamu disimpan oleh kontrak escrow di jaringan
              Stellar: sebuah smart contract yang tidak dipegang Trustip dan
              tidak dipegang penjual. Pembayaran menggunakan USDC, dan setiap
              langkah tercatat permanen di jaringan sehingga bisa diverifikasi
              siapa pun.
            </p>
            <p className="micro-label mt-4 text-ash">
              USDC · Stellar · Soroban escrow
            </p>
          </div>
        </details>

        <div className="mt-16 flex flex-wrap items-center gap-5 pb-8">
          <Link
            href="/buyer"
            className="mat-illuminated os-press px-6 py-3 text-sm font-semibold tracking-tight text-void hover:text-bone"
          >
            Saya Pembeli
          </Link>
          <Link
            href="/faq"
            className="os-press micro-label py-2 text-ash hover:text-bone"
          >
            Pertanyaan Umum
          </Link>
        </div>
      </section>
    </InfoShell>
  );
}
