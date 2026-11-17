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
      fit: p.coverFit ?? "cover",
    };
  });
  const email = site.nav.find((i) => i.href.startsWith("mailto:"));

  return (
    <>
      {/* Everything above the footer slides up to reveal it */}
      <main className="page">
        <Hero name={site.name} tagline={site.tagline} currently={site.currently} items={heroItems} />

        <About title={site.about.title} bio={site.bio} />

        <Collab
          heading={site.collab.heading}
          cta={email && { label: site.collab.cta, href: email.href }}
          you={site.collab.you}
          names={site.collab.cursors}
        />
      </main>

      <Footer name={site.name} currently={site.currently} nav={site.nav} />

      {/* Last, so it measures the page after the pinned sections have set up */}
      <SectionDots />
    </>
  );
}
