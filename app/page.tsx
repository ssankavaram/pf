import Nav from "@/components/Nav";
import Hero, { type HeroItem } from "@/components/Hero";
import About from "@/components/About";
import Collab from "@/components/Collab";
import Footer from "@/components/Footer";
import SectionDots from "@/components/SectionDots";
import { projects, site, asset, isVideo } from "@/lib/content";

export default function Home() {
  // Project cards for the hero row. meta looks like "Case study · Enterprise · Lead designer · ..."
  const heroItems: HeroItem[] = projects.map((p) => {
    const cover = asset(p.cover);
    return {
      slug: p.slug,
      title: p.short ?? p.title,
      client: p.meta.split(" · ")[1] ?? "",
      cover,
      isVideo: isVideo(cover),
    };
  });

  return (
    <>
      <Nav name={site.name} items={site.nav} cta={site.cta} />

      {/* Everything above the footer slides up to reveal it */}
      <main className="page">
        <Hero items={heroItems} />

        <About
          label={site.about.label}
          line={site.about.line}
          bio={site.bio}
          resume={site.nav.find((i) => i.label.toLowerCase() === "resume")}
        />

        <Collab quote={site.collab.quote} by={site.collab.by} you={site.collab.you} names={site.collab.cursors} />
      </main>

      <Footer name={site.name} currently={site.currently} nav={site.nav} />

      {/* Last, so it measures the page after the pinned sections have set up */}
      <SectionDots />
    </>
  );
}
