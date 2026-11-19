import type { Metadata } from "next";
import GlassNav from "@/components/GlassNav";
import About from "@/components/About";
import CollabFooter from "@/components/CollabFooter";
import { site } from "@/lib/content";

export const metadata: Metadata = {
  title: `About · ${site.name}`,
  description: site.bio,
};

export default function AboutPage() {
  return (
    <>
      <GlassNav />
      <main className="page">
        <About title={site.about.title} bio={site.bio} />
      </main>
      <CollabFooter nav={site.nav} />
    </>
  );
}
