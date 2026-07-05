import { OrderStatusPage } from "../../../../../features/status/OrderStatusPage";

export const metadata = { title: "Status Pesanan — Trustip" };

export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string; orderNo: string }>;
}) {
  const { slug, orderNo } = await params;
  return <OrderStatusPage slug={slug} orderNo={orderNo} />;
}
