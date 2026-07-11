// Route-level loading UI: /checkout/[slug] blocks on a server fetch
// (force-dynamic), and without this file the tap on a shared checkout link
// gives no feedback until the database answers. Reuses the terminal's own
// boot primitive — the machine powering on, not a spinner.
export default function CheckoutLoading() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-6 py-16">
      <div className="w-full" role="status" aria-label="Menyiapkan checkout">
        <div className="micro-label text-ash">Trustip · Protected Checkout</div>
        <p className="os-body mt-4 text-mist">Menyiapkan checkout…</p>
        <div className="relative mt-6 h-[2px] w-full overflow-hidden bg-hairline">
          <div className="boot-bar absolute inset-0 bg-blood" />
        </div>
      </div>
    </main>
  );
}
