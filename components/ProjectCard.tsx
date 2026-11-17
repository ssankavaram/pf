import Link from "next/link";
import Media from "./Media";
import type { Project } from "@/lib/content";

export default function ProjectCard({ p }: { p: Project }) {
  // meta looks like "Case study · Enterprise · Lead designer · In development"
  const [tag, category] = p.meta.split(" · ");
  return (
    <Link href={`/${p.slug}`} className="card">
      <Media src={p.cover} className="card-media" />
      <div className="card-row">
        <span className="card-label">{category}</span>
        <span className="card-pill">{tag}</span>
      </div>
      <p className="card-title"><span className="ulink">{p.title}</span></p>
    </Link>
  );
}
