import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Media from "@/components/Media";
import ProgressNav from "@/components/ProgressNav";
import { projects, getProject, site } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => projects.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProject((await params).slug);
  return { title: p ? `${p.title} · ${site.name}` : site.title, description: p?.intro[0] };
}

export default async function CaseStudy({ params }: Props) {
  const p = getProject((await params).slug);
  if (!p) notFound();

  return (
    <main className="wrap case">
      <Link href="/" className="back">
        <span aria-hidden>←</span> <span className="ulink">Back</span>
      </Link>

      <header className="case-head">
        <h1>{p.title}</h1>
        <p className="small">{p.meta}</p>
        {p.intro.map((t) => (
          <p key={t} className="body">{t}</p>
        ))}
        {p.link && (
          <a className="ulink live" href={p.link.href} target="_blank" rel="noreferrer">
            {p.link.label} ↗
          </a>
        )}
      </header>

      <Media src={p.hero} className="hero" />

      <div className="case-body">
        <ProgressNav headings={p.sections.map((s) => s.heading)} />
        <div className="sections">
          {p.sections.map((s, i) => (
            <section key={s.heading} id={`s-${i}`} className="section">
              <h3>{s.heading}</h3>
              {s.body.map((t) => (
                <p key={t} className="body">{t}</p>
              ))}
              {s.link && (
                <a className="ulink live" href={s.link.href} target="_blank" rel="noreferrer">
                  {s.link.label} ↗
                </a>
              )}
              {s.media?.map((m) => <Media key={m} src={m} />)}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
