import Link from "next/link";
import ContactIcons from "./ContactIcons";

type Item = { label: string; href: string };

// Plain footer for now: thanks line, page links, contact icons and "Back to top".
export default function RippleFooter({ nav }: { nav: Item[] }) {
  return (
    <footer id="contact" className="rfooter">
      <div className="rfooter-content">
        <p className="rfooter-thanks">You&rsquo;ve reached the end! Thanks for visiting.</p>
        <nav className="rfooter-links" aria-label="Footer">
          <Link href="/">Work</Link>
          <span aria-disabled="true" title="Coming soon">Playground</span>
          <Link href="/about">About</Link>
        </nav>
        <ContactIcons nav={nav} />
      </div>
      <a href="#top" className="rfooter-top">Back to top</a>
    </footer>
  );
}
