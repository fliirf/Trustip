// Buyer checkout page (RSC shell). Reads PUBLIC checkout-link context with the
// anon client — RLS only exposes ACTIVE links to anon, so unknown/inactive
// slugs render the unavailable panel. Lightweight product route: no landing
// animation system, no 3D, no smooth-scroll libraries.

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
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-gray-100">
        Link checkout tidak tersedia
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Link ini tidak ditemukan, sudah tidak aktif, atau sudah kedaluwarsa.
        Hubungi penjual untuk mendapatkan link terbaru.
      </p>
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
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <header className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          Trustip · Protected Checkout
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-gray-50">
          {link.title}
        </h1>
        <p className="mt-1 text-sm text-gray-400">
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
  );
}
