"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { label: string; href: string };

// Centered top nav: wordmark, page links with a dot under the current one, and a "More" menu
// for outside links (résumé, LinkedIn, email).
export default function TopNav({ name, more }: { name: string; more: Item[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const first = name.split(" ")[0].toLowerCase();

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pages = [
    { label: "Work", href: "/" },
    { label: "About", href: "/about" },
  ];
  const ext = (h: string) => h.startsWith("http");

  return (
    <header className="topnav">
      <Link href="/" className="topnav-logo" aria-label={`${name}, home`}>{first}</Link>
      <nav className="topnav-links" aria-label="Main">
        {pages.map((p) => (
          <Link key={p.href} href={p.href} className={`topnav-link${path === p.href ? " on" : ""}`} aria-current={path === p.href ? "page" : undefined}>
            {p.label}
          </Link>
        ))}
        <div ref={menu} className="topnav-more">
          <button className="topnav-link" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
            More
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={open ? "flip" : ""}>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <ul className="topnav-menu">
              {more.map((i) => (
                <li key={i.label}>
                  <a href={i.href} onClick={() => setOpen(false)} {...(ext(i.href) ? { target: "_blank", rel: "noreferrer" } : {})}>
                    {i.label}{ext(i.href) ? " ↗" : ""}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>
    </header>
  );
}
