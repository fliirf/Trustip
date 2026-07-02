import React from "react";
import "./globals.css";

export const metadata = {
  title: "Trustip v1.1 - Secure Protected Checkout",
  description:
    "Stellar-native social commerce protected checkout using Soroban escrows",
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
