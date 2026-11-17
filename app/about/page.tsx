import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import About from "@/components/About";
import Footer from "@/components/Footer";
import { site, moreLinks } from "@/lib/content";

export const metadata: Metadata = {
  title: `About · ${site.name}`,
  description: site.bio,
};

export default function AboutPage() {
  return (
    <>
      <TopNav name={site.name} more={moreLinks()} />
      <main className="page">
        <About title={site.about.title} bio={site.bio} />
      </main>
      <Footer name={site.name} currently={site.currently} nav={site.nav} />
    </>
  );
}
