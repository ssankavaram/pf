"use client";

import { useRef, useState } from "react";

type Item = { label: string; href: string };

/** Three small glass circles: email (copies the address), résumé, LinkedIn — each says what it does on hover. */
export default function ContactIcons({ nav, className = "" }: { nav: Item[]; className?: string }) {
  const find = (pred: (i: Item) => boolean) => nav.find(pred);
  const items = [
    { item: find((i) => i.href.startsWith("mailto:")), icon: "/home/mail.svg", label: "Copy email", copy: true },
    { item: find((i) => i.label.toLowerCase() === "resume"), icon: "/home/file.svg", label: "View resume", copy: false },
    { item: find((i) => i.label.toLowerCase() === "linkedin"), icon: "/home/linkedin.svg", label: "Connect on LinkedIn", copy: false },
  ].filter((x) => x.item);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copyEmail = (href: string) => {
    const address = href.replace(/^mailto:/, "").split("?")[0];
    navigator.clipboard.writeText(address).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      },
      () => { window.location.href = href; }, // no clipboard access: open the mail app instead
    );
  };

  return (
    <div className={`cicons ${className}`}>
      {items.map(({ item, icon, label, copy }) => {
        const ext = item!.href.startsWith("http");
        const tip = copy && copied ? "Copied!" : label;
        return (
          <a
            key={label}
            href={item!.href}
            className="cicon"
            aria-label={tip}
            onClick={copy ? (e) => { e.preventDefault(); copyEmail(item!.href); } : undefined}
            {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt="" width={17} height={17} />
            <span className="cicon-tip" aria-hidden>{tip}</span>
          </a>
        );
      })}
    </div>
  );
}
