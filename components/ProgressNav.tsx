"use client";
import { useEffect, useState } from "react";

export default function ProgressNav({ headings }: { headings: string[] }) {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const els = headings.map((_, i) => document.getElementById(`s-${i}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number(e.target.id.slice(2)));
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);
  return (
    <aside className="progress">
      <ol>
        {headings.map((h, i) => (
          <li key={h} className={i === active ? "on" : ""}>
            <a href={`#s-${i}`}>{h}</a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
