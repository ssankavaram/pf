# Srija Sankavaram · Portfolio

Next.js rebuild of srijasankavaram.com (moved off Framer).

## Run it locally

You need [Node.js](https://nodejs.org) (LTS) installed once.

```bash
npm install          # install dependencies (first time only)
npm run fetch-assets # download all images/videos into public/media (first time, or after adding new media)
npm run dev          # open http://localhost:3000
```

## Where things live

| What | File |
| --- | --- |
| Name, bio, nav links, tool icons | `content/site.json` |
| Case studies (copy, media, order) | `content/projects.json` |
| Colors, type, spacing | `app/globals.css` (`:root` variables at the top) |
| Home page | `app/page.tsx` |
| Case study template | `app/[slug]/page.tsx` |
| Components | `components/` |
| Fonts | `public/fonts/` |
| Images & videos | `public/media/` |

**Edit copy:** change the text in `content/projects.json`. Each case study has `title`, `meta`, `intro`, `hero`, and `sections` (each with `heading`, `body`, `media`).

**Add a case study:** copy one object in `projects.json`, give it a new `slug` (that becomes the URL), and drop its media into `public/media/` (reference it as `/media/filename.png`).

## To finish

- [ ] **Font:** download Open Runde (github.com/lauridskern/open-runde) and put `OpenRunde-Regular.woff2`, `OpenRunde-Medium.woff2`, `OpenRunde-Semibold.woff2` in `public/fonts/`.
- [ ] **Nav links:** fill in the `TODO` hrefs for About, Resume, Email, LinkedIn in `content/site.json`.
- [ ] **Framer code components:** port StickyScrollSection, IconStack, CardFan, DotGridBackground, etc. into `components/` (see below).

## Porting Framer code components

Framer components are plain React, so most of the code carries over:

1. Add `"use client";` at the top of the file.
2. Delete `import { addPropertyControls, ControlType } from "framer"` and the `addPropertyControls(...)` block.
3. Keep the props as normal TypeScript props with defaults.
4. Replace `ControlType.Link` / Framer `Link` with Next's `import Link from "next/link"`.
5. Framer Motion: `npm install framer-motion` and keep the imports as they are.

## Deploy (Vercel)

1. Push this repo to GitHub.
2. On vercel.com, **Add New → Project**, pick the repo, keep the defaults, Deploy.
3. Every push to `main` redeploys automatically.
4. Custom domain: Vercel project → **Settings → Domains** → add `srijasankavaram.com`, then update DNS where you bought the domain (Vercel shows the exact records). Disconnect the domain from Framer first.
