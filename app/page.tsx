import TopNav from "@/components/TopNav";
import Hero, { type WorkItem } from "@/components/Hero";
import Collab from "@/components/Collab";
import Footer from "@/components/Footer";
import SectionDots from "@/components/SectionDots";
import { projects, site, asset, isVideo, moreLinks } from "@/lib/content";

export default function Home() {
  const items: WorkItem[] = projects.map((p) => {
    const cover = asset(p.cover);
    return {
      slug: p.slug,
      title: p.title,
      cover,
      isVideo: isVideo(cover),
      aspect: p.coverAspect ?? 1.25,
      // Explicit tags, else the labels from meta ("Case study · Enterprise · …")
      tags: p.tags ?? p.meta.split(" · "),
    };
  });
  const tools = site.tools.map((t) => ({ name: t.name, src: asset(t.src) }));
  const email = site.nav.find((i) => i.href.startsWith("mailto:"));

  return (
    <>
      <TopNav name={site.name} more={moreLinks()} />

      {/* Everything above the footer slides up to reveal it */}
      <main className="page">
        <Hero name={site.name} tagline={site.tagline} currently={site.currently} tools={tools} items={items} />

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
