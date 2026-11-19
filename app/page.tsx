import GlassNav from "@/components/GlassNav";
import DarkHome, { type HomeItem } from "@/components/DarkHome";
import CollabFooter from "@/components/CollabFooter";
import { projects, site } from "@/lib/content";

export default function Home() {
  const items: HomeItem[] = projects.map((p) => ({
    slug: p.slug,
    short: p.short ?? p.title,
    line: p.line ?? p.title,
    cover: p.homeCover,
    tags: p.cardTags ?? p.tags?.slice(0, 3) ?? p.meta.split(" · ").slice(0, 3),
  }));

  return (
    <>
      <GlassNav />
      {/* Everything above the footer slides up to reveal it */}
      <main className="page">
        <DarkHome name={site.name} bio={site.bio} currently={site.currently} nav={site.nav} items={items} />
      </main>
      <CollabFooter nav={site.nav} />
    </>
  );
}
