import type { Metadata } from "next";
import { Instrument_Serif, La_Belle_Aurore, Inter } from "next/font/google";
import { site, asset } from "@/lib/content";
import SmoothScroll from "@/components/SmoothScroll";
import "lenis/dist/lenis.css";
import "./globals.css";

// Display serif for big headlines (hero, footer wordmark).
const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
});

// Handwritten script for the footer wordmark.
const script = La_Belle_Aurore({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-script",
});

// Inter: only for the product mockup animation (matches the Figma file it came from).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: site.title,
  description: site.bio,
  icons: { icon: asset(site.favicon) },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${script.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Set the theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme="dark";`, // the site is dark-only (Figma design)
          }}
        />
      </head>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
