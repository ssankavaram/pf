"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Frosted pill nav, top right. "Playground" has no page yet, so it shows a little "soon" on hover.
export default function GlassNav() {
  const path = usePathname();
  const links = [
    { label: "Case studies", href: "/" },
    { label: "About", href: "/about" },
  ];
  return (
    <nav className="gnav" aria-label="Main">
      <Link href={links[0].href} className="glass-pill" aria-current={path === "/" ? "page" : undefined}>{links[0].label}</Link>
      <span className="glass-pill is-soon" aria-disabled="true" tabIndex={0}>
        Playground <span className="soon-badge" aria-hidden>soon</span>
      </span>
      <Link href={links[1].href} className="glass-pill" aria-current={path === "/about" ? "page" : undefined}>{links[1].label}</Link>
    </nav>
  );
}
