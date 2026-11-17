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

export type Project = {
  slug: string;
  short?: string;
  coverFit?: "cover" | "contain"; // "contain" shows the whole cover on a grey card (e.g. a phone screen)
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

const MEDIA_DIR = path.join(process.cwd(), "public", "media");

/** Use the local copy in /public/media if it exists (after `npm run fetch-assets`), else the original URL. */
export function asset(url: string): string {
  const file = path.basename(new URL(url).pathname);
  return fs.existsSync(path.join(MEDIA_DIR, file)) ? `/media/${file}` : url;
}

export const isVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src.split("?")[0]);
