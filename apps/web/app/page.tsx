import { MotionProvider } from "../features/motion/MotionProvider";
import { VoidLanding } from "../features/landing/VoidLanding";

export const metadata = {
  title: "Trustip · Protected Checkout",
  description:
    "Checkout terlindungi untuk social commerce. Pembeli membayar USDC di Stellar, dana ditahan aman sampai pesanan selesai.",
};

export default function HomePage() {
  // Smallest client boundary: MotionProvider runs Lenis + registers
  // ScrollTrigger; VoidLanding is passed as children so it stays a Server
  // Component. Landing route only — no other route imports this.
  return (
    <MotionProvider smoothScroll>
      <VoidLanding />
    </MotionProvider>
  );
}
