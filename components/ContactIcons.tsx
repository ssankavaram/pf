type Item = { label: string; href: string };

/** Three small glass circles: email, résumé, LinkedIn. */
export default function ContactIcons({ nav, className = "" }: { nav: Item[]; className?: string }) {
  const find = (pred: (i: Item) => boolean) => nav.find(pred);
  const items = [
    { item: find((i) => i.href.startsWith("mailto:")), icon: "/home/mail.svg", label: "Email" },
    { item: find((i) => i.label.toLowerCase() === "resume"), icon: "/home/file.svg", label: "Résumé" },
    { item: find((i) => i.label.toLowerCase() === "linkedin"), icon: "/home/linkedin.svg", label: "LinkedIn" },
  ].filter((x) => x.item);
  return (
    <div className={`cicons ${className}`}>
      {items.map(({ item, icon, label }) => {
        const ext = item!.href.startsWith("http");
        return (
          <a key={label} href={item!.href} className="cicon" aria-label={label} title={label} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={icon} alt="" width={17} height={17} />
          </a>
        );
      })}
    </div>
  );
}
