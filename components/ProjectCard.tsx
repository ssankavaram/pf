import Link from "next/link";
import Media from "./Media";
import type { Project } from "@/lib/content";

export default function ProjectCard({ p }: { p: Project }) {
  return (
    <Link href={`/${p.slug}`} className="card">
      <Media src={p.cover} className="card-media" />
      <p className="card-title"><span className="ulink">{p.title}</span></p>
      <p className="small">{p.meta}</p>
    </Link>
  );
}
