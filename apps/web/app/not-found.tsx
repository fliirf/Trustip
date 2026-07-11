import Link from "next/link";

// 404 in the product's own voice. Without this file Next serves its default
// white page — a jarring identity break on a VOID-black product, and a dead end
// for a buyer who mistyped a checkout link. Uses only existing OS classes.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-start justify-center px-6 py-16">
      <div className="micro-label text-ash">404 · Halaman tidak ditemukan</div>
      <h1 className="os-title mt-4 text-bone">
        Halaman ini tidak ada atau sudah dipindahkan.
      </h1>
      <p className="os-body mt-4 max-w-[46ch] text-mist">
        Kalau kamu membuka link checkout dari seller, periksa kembali linknya
        atau minta link terbaru.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/buyer"
          className="mat-illuminated os-press micro-label px-6 py-3.5 text-void hover:text-bone"
        >
          Buka Checkout / Cek Status
        </Link>
        <Link
          href="/"
          className="mat-key os-press micro-label border border-hairline px-6 py-3.5 text-mist hover:text-bone"
        >
          Ke Beranda
        </Link>
      </div>
    </main>
  );
}
