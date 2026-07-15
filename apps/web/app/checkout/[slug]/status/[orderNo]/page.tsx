import { OrderStatusPage } from "../../../../../features/status/OrderStatusPage";
import { getServerLocale } from "../../../../../lib/i18n/server";

// noindex: slug + order number is the whole access credential for this page.
export async function generateMetadata() {
  const locale = await getServerLocale();
  return {
    title: locale === "en" ? "Order Status · Trustip" : "Status Pesanan · Trustip",
    robots: { index: false, follow: false },
  };
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string; orderNo: string }>;
}) {
  const { slug, orderNo } = await params;
  return <OrderStatusPage slug={slug} orderNo={orderNo} />;
}
