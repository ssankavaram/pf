"use client";
import { useState } from "react";

type Item = { label: string; href: string };

export default function Menu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const ext = (h: string) => h.startsWith("http");
  return (
    <nav className="menu">
      <ul className="menu-inline">
        {items.map((i) => (
          <li key={i.label}>
            <a className="ulink" href={i.href} {...(ext(i.href) ? { target: "_blank", rel: "noreferrer" } : {})}>
              {i.label}
            </a>
          </li>
        ))}
      </ul>
      <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span />
        <span />
      </button>
      {open && (
        <ul className="menu-sheet" onClick={() => setOpen(false)}>
          {items.map((i) => (
            <li key={i.label}>
              <a href={i.href} {...(ext(i.href) ? { target: "_blank", rel: "noreferrer" } : {})}>
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
