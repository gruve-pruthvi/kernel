import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { timeline } from "@/core/front";

export function Experience({ entries }: { entries: ReturnType<typeof timeline> }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="experience" className="mt-20">
      <SectionLabel>Experience</SectionLabel>
      <h2 id="experience" className="sr-only">Experience</h2>
      <ol className="mt-5 divide-y divide-border rounded-lg border border-border">
        {entries.map((e) => (
          <li key={e.id} className="grid gap-1 p-5 sm:grid-cols-[1fr_auto] sm:gap-6">
            <div>
              <p className="font-semibold">
                {e.role} <span className="font-normal text-muted">· {e.organisation}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{e.highlight}</p>
            </div>
            <p className="font-mono text-xs text-faint sm:text-right">{e.period}</p>
          </li>
        ))}
      </ol>
      <Link href="/trace" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        Full history →
      </Link>
    </section>
  );
}
