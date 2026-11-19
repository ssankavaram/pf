import fs from "node:fs";
import path from "node:path";
import projectsData from "@/content/projects.json";
import siteData from "@/content/site.json";

export type Section = {
  heading: string;
  body: string[];
  media?: string[];
  link?: { label: string; href: string };
};

export type HomeLayers = { bg: string; fg: string; at: number[] };

export type Project = {
  slug: string;
  short?: string;
  coverFit?: "cover" | "contain"; // "contain" shows the whole cover on a grey card (e.g. a phone screen)
  coverAspect?: number; // cover width ÷ height, so gallery cards get the right shape before media loads
  tags?: string[];      // pills under the project in the home gallery (falls back to meta)
  line?: string;        // one-liner after the name under the home card
  cardTags?: string[];  // tags under the home card (falls back to tags / meta)
  homeLayers?: HomeLayers; // the card split in two: moving gradient background + foreground image (x, y, w, h on the 780×437 card)
  homeCover?: string;   // finished card image for the home carousel (else plain fractal glass)
  title: string;
  meta: string;
  cover: string;
  intro: string[];
  hero: string;
  link?: { label: string; href: string };
  sections: Section[];
};

export const projects = projectsData as Project[];
export const site = siteData;

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

/** Outside links for the nav's "More" menu: everything in site.nav that isn't an on-site page. */
export const moreLinks = () => site.nav.filter((i) => !i.href.startsWith("/"));

const MEDIA_DIR = path.join(process.cwd(), "public", "media");

/** Use the local copy in /public/media if it exists (after `npm run fetch-assets`), else the original URL. */
export function asset(url: string): string {
  const file = path.basename(new URL(url).pathname);
  return fs.existsSync(path.join(MEDIA_DIR, file)) ? `/media/${file}` : url;
}

export const isVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src.split("?")[0]);
