import Link from "next/link";
import { site, asset } from "@/lib/content";
import Menu from "./Menu";

export default function Header() {
  return (
    <header className="header">
      <div className="header-top">
        <div>
          <h1 className="name">
            <Link href="/">{site.name}</Link>
          </h1>
          <p className="small">
            {site.currently.text}{" "}
            <a className="ulink" href={site.currently.href} target="_blank" rel="noreferrer">
              {site.currently.linkLabel}
            </a>
          </p>
        </div>
        <Menu items={site.nav} />
      </div>
      <p className="bio">{site.bio}</p>
      <div className="tools">
        {site.tools.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.name} src={asset(t.src)} alt={t.name} width={18} height={18} />
        ))}
      </div>
    </header>
  );
}
