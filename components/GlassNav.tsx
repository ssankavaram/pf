"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Logo top-left; frosted pill top-right (Work · Playground · About). Current page is bold.
// "Playground" has no page yet, so it shows a small "soon" on hover.
export default function GlassNav() {
  const path = usePathname();
  const on = (href: string) => (path === href ? "page" : undefined);
  return (
    <header className="gnav-bar">
      <Link href="/" className="gnav-logo" aria-label="Home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/home/logo.png" alt="" width={39} height={42} />
      </Link>
      <nav className="gnav" aria-label="Main">
        <Link href="/" className="gnav-link" aria-current={on("/")}>Work</Link>
        <span className="gnav-link is-soon" aria-disabled="true" tabIndex={0}>
          Playground <span className="soon-badge" aria-hidden>soon</span>
        </span>
        <Link href="/about" className="gnav-link" aria-current={on("/about")}>About</Link>
      </nav>
    </header>
  );
}
