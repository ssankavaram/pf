import type { Metadata } from "next";
import GlassNav from "@/components/GlassNav";
import GlassDock from "@/components/GlassDock";
import About from "@/components/About";
import Footer from "@/components/Footer";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: `About · ${site.name}`,
  description: site.bio,
};

export default function AboutPage() {
  return (
    <>
      <GlassNav />
      <GlassDock nav={site.nav} />
      <main className="page">
        <About title={site.about.title} bio={site.bio} />
      </main>
      <Footer name={site.name} currently={site.currently} nav={site.nav} />
    </>
  );
}
