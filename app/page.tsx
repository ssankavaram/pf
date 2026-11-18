import GlassNav from "@/components/GlassNav";
import GlassDock from "@/components/GlassDock";
import GlassHome, { type GlassItem } from "@/components/GlassHome";
import Footer from "@/components/Footer";
import { projects, site, asset, isVideo } from "@/lib/content";

export default function Home() {
  const items: GlassItem[] = projects.map((p) => {
    const cover = asset(p.cover);
    const metric = p.title.match(/\d+%/)?.[0]; // e.g. "47%" from "Lifting engagement by 47%…"
    return {
      slug: p.slug,
      title: p.title,
      cover,
      isVideo: isVideo(cover),
      aspect: p.coverAspect ?? 1.25,
      short: p.short ?? p.title,
      category: p.meta.split(" · ")[1] ?? p.meta.split(" · ")[0],
      metric,
    };
  });

  return (
    <>
      <GlassNav />
      <GlassDock nav={site.nav} />

      {/* Everything above the footer slides up to reveal it */}
      <main className="page">
        <GlassHome name={site.name} bio={site.bio} currently={site.currently} items={items} />
      </main>

      <Footer name={site.name} currently={site.currently} nav={site.nav} />
    </>
  );
}
