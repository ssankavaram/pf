import type { Metadata } from "next";
import { site, asset } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  title: site.title,
  description: site.bio,
  icons: { icon: asset(site.favicon) },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
