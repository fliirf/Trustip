import type { Metadata } from "next";
import { Space_Grotesk, Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trustip — Protected Checkout for Social Commerce",
  description:
    "Buyer funds stay protected until the order is received. Stellar-native USDC escrow for jastip, pre-order, group buy, and informal online commerce.",
  keywords: [
    "Trustip",
    "Stellar",
    "USDC",
    "Soroban",
    "Escrow",
    "Protected Checkout",
    "Social Commerce",
    "Jastip",
  ],
  authors: [{ name: "Trustip Protocol" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "Trustip — Protected Checkout",
    description: "Buyer funds stay protected until the order is received.",
    siteName: "Trustip",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${geist.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} antialiased`}
        style={{ backgroundColor: "#050505", color: "#EDEAE3" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
