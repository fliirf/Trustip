import React from "react";
import "./globals.css";

export const metadata = {
  // No internal version number in a buyer's browser tab. The description is
  // what a link preview shows a BUYER when a checkout link is shared in chat,
  // so it follows the buyer language rules: Indonesian, no protocol terms.
  title: "Trustip · Protected Checkout",
  description:
    "Checkout terlindungi untuk belanja di social commerce. Dana kamu ditahan aman dan baru diteruskan ke penjual setelah pesanan diterima.",
};

// Mobile browser chrome (address bar / task switcher) matches the VOID ground
// instead of defaulting to white around a black page.
export const viewport = {
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
