type Item = { label: string; href: string };

// Frosted circle buttons, bottom right: email, résumé, LinkedIn. Labels slide out on hover.
export default function GlassDock({ nav }: { nav: Item[] }) {
  const find = (pred: (i: Item) => boolean) => nav.find(pred);
  const items = [
    { item: find((i) => i.href.startsWith("mailto:")), icon: "/icons/mail.svg", label: "Email" },
    { item: find((i) => i.label.toLowerCase() === "resume"), icon: "/icons/file.svg", label: "Résumé" },
    { item: find((i) => i.label.toLowerCase() === "linkedin"), icon: "/icons/linkedin.svg", label: "LinkedIn" },
  ].filter((x) => x.item);

  return (
    <aside className="gdock" aria-label="Contact">
      {items.map(({ item, icon, label }) => {
        const ext = item!.href.startsWith("http");
        return (
          <a key={label} href={item!.href} className="glass-circle" aria-label={label} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt="" width={22} height={22} />
            <span className="glass-tip" aria-hidden>{label}</span>
          </a>
        );
      })}
    </aside>
  );
}
