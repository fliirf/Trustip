// Buyer checkout page (RSC shell). Reads PUBLIC checkout-link context with the
// anon client — RLS only exposes ACTIVE links to anon, so unknown/inactive
// slugs render the unavailable panel. Lightweight product route: no landing
// animation system, no 3D, no smooth-scroll libraries — VOID identity is
// carried by CSS alone.

import { supabase } from "@trustip/database";
import { BuyerCheckout } from "../../../features/checkout/BuyerCheckout";
import { EmptyState } from "../../../features/ui/ErrorState";
import { getServerLocale, getDict } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

// Static on purpose: naming the product in a per-link title would need a second
// fetch in generateMetadata, and the tab only has to say which surface this is.
// noindex: a checkout URL is a capability URL — robots.txt stops crawling, but
// only this meta stops indexing when the link is shared somewhere public.
export const metadata = {
  title: "Checkout · Trustip",
  robots: { index: false, follow: false },
};

/** Display-format a numeric USDC price (trim trailing zeros). Display only —
 * every trusted amount comes from backend API responses. */
function formatUsdc(value: number): string {
  return value
    .toFixed(7)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
}

/** A powered terminal with nothing to charge: the machine is up, the lock is
 *  dormant, and there is no order to run. Not an error page. */
function Unavailable({ d }: { d: ReturnType<typeof getDict> }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-6 py-16">
      <div className="w-full">
        <EmptyState
          surface="checkout"
          title={d.checkout.unavailable.title}
          detail={d.checkout.unavailable.detail}
        />
      </div>
    </main>
  );
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = getDict(await getServerLocale());

  const { data: link } = await supabase
    .from("checkout_links")
    .select(
      `slug, title, description, price_usdc, status, expires_at, requires_shipping,
       seller_profiles ( store_name,
         trust_profiles ( level, average_rating, total_reviews, completed_orders ) )`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (
    !link ||
    link.status !== "active" ||
    (link.expires_at !== null && Date.parse(link.expires_at) <= Date.now())
  ) {
    return <Unavailable d={d} />;
  }

  // Public trust signal (trust_profiles is publicly readable). Shown only when
  // the seller has a real track record so a brand-new store isn't flagged as
  // "0.0". Read-only projection — every number is backend-derived.
  const seller = link.seller_profiles as unknown as {
    store_name: string | null;
    trust_profiles: {
      level: string;
      average_rating: number;
      total_reviews: number;
      completed_orders: number;
    } | null;
  } | null;
  const trust = seller?.trust_profiles ?? null;
  const showTrust =
    !!trust && (trust.completed_orders > 0 || trust.total_reviews > 0);

  return (
    <>
      <div className="grain-overlay" aria-hidden />
      <main className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
        {/* The chassis plate. A machine states its identity and its network on
            the metal, at small size, before it states the job. */}
        <header className="engraved-b mb-12 flex flex-wrap items-end justify-between gap-4 pb-5">
          <div>
            <div className="micro-label text-ash">{d.checkout.protectedCheckout}</div>
            <h1 className="os-title mt-3 text-bone">
              {link.title}
            </h1>
            {showTrust && trust && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="desk-stamp micro-label px-2 py-1 text-bone">
                  {d.checkout.trust.levels[trust.level] ?? trust.level}
                </span>
                {trust.total_reviews > 0 && (
                  <span className="micro-label text-mist">
                    <span aria-hidden className="text-blood">★</span>{" "}
                    {trust.average_rating.toFixed(1)}
                    <span className="text-ash">
                      {" "}
                      · {d.checkout.trust.reviews(trust.total_reviews)}
                    </span>
                  </span>
                )}
                {trust.completed_orders > 0 && (
                  <span className="micro-label text-ash">
                    {d.checkout.trust.completed(trust.completed_orders)}
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="max-w-[34ch] text-sm leading-relaxed text-mist/80">
            {d.checkout.headerNote}
          </p>
        </header>

        <BuyerCheckout
          link={{
            slug: link.slug,
            title: link.title,
            description: link.description,
            priceUsdc: formatUsdc(link.price_usdc),
            requiresShipping: link.requires_shipping,
          }}
        />
      </main>
    </>
  );
}
