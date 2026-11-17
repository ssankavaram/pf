import { Bulb, Flower, Sparkle, Sprig, Yarn } from "./Doodles";

type Item = { label: string; href: string };

export default function Footer({
  name,
  currently,
  nav,
}: {
  name: string;
  currently: { linkLabel: string; href: string };
  nav: Item[];
}) {
  const email = nav.find((i) => i.href.startsWith("mailto:"));
  const elsewhere = nav.filter((i) => i.href.startsWith("http"));
  const resume = nav.find((i) => i.label.toLowerCase() === "resume");
  const links = resume && !elsewhere.includes(resume) ? [...elsewhere, resume] : elsewhere;
  const first = name.split(" ")[0].toLowerCase();

  return (
    <footer id="contact" className="footer">
      <div className="footer-panel">
        <div className="footer-top small">
          <span>© {new Date().getFullYear()} {name}</span>
          <a href="#top" className="ulink">Back to top ↑</a>
        </div>

        <div className="footer-cols">
          <div>
            <span className="footer-pill">currently</span>
            <p className="footer-big">
              Designing at{" "}
              <a href={currently.href} target="_blank" rel="noreferrer" className="ulink">{currently.linkLabel}</a>
            </p>
          </div>
          {email && (
            <div>
              <span className="footer-pill">say hi</span>
              <a href={email.href} className="footer-big ulink">{email.href.replace("mailto:", "")}</a>
            </div>
          )}
          <div>
            <span className="footer-pill">elsewhere</span>
            <ul className="footer-links">
              {links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="footer-big ulink">{l.label} ↗</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-mark" aria-hidden>
          <span className="footer-word">{first}</span>
          <span className="sticker s1"><Flower /></span>
          <span className="sticker s2"><Yarn /></span>
          <span className="sticker s3"><Bulb /></span>
          <span className="sticker s4"><Sparkle /></span>
          <span className="sticker s5"><Sprig /></span>
        </div>
      </div>
    </footer>
  );
}
