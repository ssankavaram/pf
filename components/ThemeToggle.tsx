"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Sun/moon glass button. Starts from the device setting; remembers an explicit choice. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    // Follow the device setting until the visitor picks one themselves.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("theme"); } catch {}
      if (saved) return;
      apply(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const apply = (next: Theme) => {
    const html = document.documentElement;
    html.classList.add("theme-anim"); // crossfade colours, then stop animating everything
    html.dataset.theme = next;
    setTheme(next);
    window.setTimeout(() => html.classList.remove("theme-anim"), 600);
  };

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", next); } catch {}
    apply(next);
  };

  const dark = theme === "dark";
  return (
    <button
      className="glass-pill theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      suppressHydrationWarning
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className={`tt-icon tt-sun${dark ? "" : " on"}`}>
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.6" x2="12" y2="4.8" transform={`rotate(${a} 12 12)`} />
          ))}
        </g>
      </svg>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className={`tt-icon tt-moon${dark ? " on" : ""}`}>
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" fill="currentColor" />
      </svg>
    </button>
  );
}
