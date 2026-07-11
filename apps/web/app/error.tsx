"use client";

// Global error boundary. A render crash on a payments product must never show
// the framework's default screen: it has to say, in the product's own voice,
// that the buyer's money state is unaffected and give a way forward. The error
// object is never printed — no stack traces or internals reach the user.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-start justify-center px-6 py-16">
      <div className="micro-label text-blood">Terjadi gangguan</div>
      <h1 className="os-title mt-4 text-bone">
        Halaman ini mengalami gangguan sementara.
      </h1>
      <p className="os-body mt-4 max-w-[46ch] text-mist">
        Ini hanya gangguan tampilan. Status pesanan dan dana kamu tidak
        terpengaruh dan tetap tercatat di jaringan.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="mat-illuminated os-press micro-label px-6 py-3.5 text-void hover:text-bone"
        >
          Muat Ulang
        </button>
        <a
          href="/buyer"
          className="mat-key os-press micro-label border border-hairline px-6 py-3.5 text-mist hover:text-bone"
        >
          Cek Status Pesanan
        </a>
      </div>
    </main>
  );
}
