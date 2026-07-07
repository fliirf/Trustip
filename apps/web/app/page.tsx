import { VoidLanding } from "../features/landing/VoidLanding";

export const metadata = {
  title: "Trustip · Protected Checkout",
  description:
    "Checkout terlindungi untuk social commerce. Pembeli membayar USDC di Stellar, dana terkunci di escrow sampai pesanan selesai.",
};

export default function HomePage() {
  return <VoidLanding />;
}
