import { SectionLabel } from "@/components/ui/SectionLabel";
import type { Identity } from "@/core/schema";

export function HowIThink({ identity }: { identity: Identity }) {
  return (
    <section id="human" aria-labelledby="human-title" className="mt-20 scroll-mt-20">
      <SectionLabel>How I think</SectionLabel>
      <h2 id="human-title" className="mt-3 text-2xl font-semibold tracking-tight">Behind the systems</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">{identity.human.about}</p>
      {identity.principles.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {identity.principles.map((p, i) => (
            <article key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      )}
      {identity.human.interests.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Interests">
          {identity.human.interests.map((x) => (
            <li key={x} className="rounded-full border border-border px-3 py-1 text-sm text-muted">
              {x}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
