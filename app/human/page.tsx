import type { Metadata } from "next";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getIdentity } from "@/core/content";

export const metadata: Metadata = { title: "Human", description: "How I think and what I value." };

export default function HumanPage() {
  const identity = getIdentity();
  return (
    <div className="py-14 sm:py-20">
      <SectionLabel>Human</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Behind the systems.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{identity.human.about}</p>

      <section aria-labelledby="principles" className="mt-16">
        <SectionLabel>How I think</SectionLabel>
        <h2 id="principles" className="sr-only">
          Principles
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {identity.principles.map((p, i) => (
            <article key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="interests" className="mt-16">
        <SectionLabel>Off the clock</SectionLabel>
        <h2 id="interests" className="sr-only">
          Interests
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {identity.human.interests.map((x) => (
            <li key={x} className="rounded-full border border-border px-3 py-1 text-sm text-muted">
              {x}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
