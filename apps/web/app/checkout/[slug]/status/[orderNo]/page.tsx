import { OrderStatusPage } from "../../../../../features/status/OrderStatusPage";

// noindex: slug + order number is the whole access credential for this page.
export const metadata = {
  title: "Status Pesanan · Trustip",
  robots: { index: false, follow: false },
};

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string; orderNo: string }>;
}) {
  const { slug, orderNo } = await params;
  return <OrderStatusPage slug={slug} orderNo={orderNo} />;
}
