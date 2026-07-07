import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

/* Landing-only fonts — loaded here (not in the root layout) so checkout and
   seller routes keep the lighter system stack. */
export const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-jb",
  display: "swap",
});
