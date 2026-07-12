import { AnchorTopup } from "../../features/anchor/AnchorTopup";

export const metadata = {
  title: "Isi Saldo USDC · Trustip",
  description:
    "Top up USDC ke wallet Stellar kamu lewat anchor, lalu pakai untuk membayar di Trustip.",
  robots: { index: false },
};

export default function TopupPage() {
  return (
    <main className="min-h-screen bg-void">
      <AnchorTopup />
    </main>
  );
}
