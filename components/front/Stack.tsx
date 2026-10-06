import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { stackGroups } from "@/core/front";

export function Stack({ groups }: { groups: ReturnType<typeof stackGroups> }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="stack" className="mt-20">
      <SectionLabel>Stack</SectionLabel>
      <h2 id="stack" className="sr-only">Stack</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.category} className="flex flex-wrap items-baseline gap-2">
            <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-wider text-faint">{g.category}</dt>
            {g.names.map((n) => (
              <dd key={n} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                {n}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <Link href="/graph" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        See how it connects →
      </Link>
    </section>
  );
}
