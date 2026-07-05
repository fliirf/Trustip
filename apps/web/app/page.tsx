import { TrustipEntryPage } from "../features/entry/TrustipEntryPage";

export const metadata = {
  title: "Trustip · Protected Checkout",
  description:
    "Checkout terlindungi untuk social commerce. Dana terkunci di escrow sampai pesanan selesai.",
};

export default function HomePage() {
  return <TrustipEntryPage />;
}
