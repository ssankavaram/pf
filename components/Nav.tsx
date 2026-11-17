import Link from "next/link";
import Menu from "./Menu";

type Item = { label: string; href: string };

export default function Nav({ name, items, cta }: { name: string; items: Item[]; cta: string }) {
  const email = items.find((i) => i.href.startsWith("mailto:"));
  const links = items.filter((i) => i !== email);
  return (
    <header className="nav">
      <Link href="/" className="nav-logo">{name}</Link>
      <Menu items={links} />
      {email && (
        <a href={email.href} className="nav-cta">{cta}</a>
      )}
    </header>
  );
}
