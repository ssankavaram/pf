import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import { projects } from "@/lib/content";

export default function Home() {
  return (
    <main className="wrap">
      <Header />
      <section id="projects" className="grid">
        {projects.map((p) => (
          <ProjectCard key={p.slug} p={p} />
        ))}
      </section>
    </main>
  );
}
