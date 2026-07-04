// Buyer checkout page (RSC shell). Reads PUBLIC checkout-link context with the
// anon client — RLS only exposes ACTIVE links to anon, so unknown/inactive
// slugs render the unavailable panel. Lightweight product route: no landing
// animation system, no 3D, no smooth-scroll libraries — VOID identity is
// carried by CSS alone.

import { supabase } from "@trustip/database";
import { BuyerCheckout } from "../../../features/checkout/BuyerCheckout";

export const dynamic = "force-dynamic";

/** Display-format a numeric USDC price (trim trailing zeros). Display only —
 * every trusted amount comes from backend API responses. */
function formatUsdc(value: number): string {
  return value
    .toFixed(7)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="micro-label text-ash">
        Trustip <span className="text-blood">·</span> Protected Checkout
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-bone">
        Link checkout tidak tersedia
      </h1>
      <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-mist/80">
        Link ini tidak ditemukan, sudah tidak aktif, atau sudah kedaluwarsa.
        Hubungi penjual untuk mendapatkan link terbaru.
      </p>
      <div className="mt-8 h-px w-16 bg-hairline" />
    </main>
  );
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: link } = await supabase
    .from("checkout_links")
    .select("slug, title, description, price_usdc, status, expires_at")
    .eq("slug", slug)
    .maybeSingle();

  if (
    !link ||
    link.status !== "active" ||
    (link.expires_at !== null && Date.parse(link.expires_at) <= Date.now())
  ) {
    return <Unavailable />;
  }

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <main className="relative mx-auto max-w-3xl px-4 py-12 md:py-16">
        <header className="mb-10">
          <div className="micro-label flex items-center gap-2 text-ash">
            <span aria-hidden className="text-blood">
              ◈
            </span>
            Trustip · Protected Checkout
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-bone md:text-4xl">
            {link.title}
          </h1>
          <p className="mt-2 text-sm text-mist/80">
            Pembayaran kamu ditahan aman sampai pesanan diterima.
          </p>
        </header>

        <BuyerCheckout
          link={{
            slug: link.slug,
            title: link.title,
            description: link.description,
            priceUsdc: formatUsdc(link.price_usdc),
          }}
        />
      </main>
    </>
  );
}
