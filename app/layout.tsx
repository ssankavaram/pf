import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { site, asset } from "@/lib/content";
import "./globals.css";

// Display serif for big headlines (hero, footer wordmark).
const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: site.title,
  description: site.bio,
  icons: { icon: asset(site.favicon) },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
