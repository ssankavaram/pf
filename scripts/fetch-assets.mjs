// Downloads every image/video referenced in /content into /public/media
// so the site no longer depends on Framer's CDN or Cloudinary.
// Usage: npm run fetch-assets
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "public", "media");
await fs.mkdir(outDir, { recursive: true });

const files = ["content/projects.json", "content/site.json"];
const urls = new Set();
for (const f of files) {
  const text = await fs.readFile(path.join(root, f), "utf8");
  for (const m of text.matchAll(/https:\/\/(?:framerusercontent\.com|res\.cloudinary\.com)\/[^"\s]+/g)) urls.add(m[0]);
}

let ok = 0, skipped = 0, failed = 0;
for (const url of urls) {
  const name = path.basename(new URL(url).pathname);
  const dest = path.join(outDir, name);
  try {
    await fs.access(dest);
    skipped++;
    continue;
  } catch {}
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    const mb = (buf.length / 1e6).toFixed(1);
    console.log(`✓ ${name} (${mb} MB)${buf.length > 90e6 ? "  ⚠ over GitHub's 100MB limit, compress it" : ""}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    failed++;
  }
}
console.log(`\nDone: ${ok} downloaded, ${skipped} already there, ${failed} failed.`);
