import { SectionLabel } from "@/components/ui/SectionLabel";
import { outcomeOf } from "@/core/front";
import type { Portfolio, System } from "@/core/schema";
import { FlagshipCard } from "./FlagshipCard";

export function Flagships({ systems, p }: { systems: System[]; p: Portfolio }) {
  if (systems.length === 0) return null;
  const nameOf = (id: string) => p.technologies.find((t) => t.id === id)?.name ?? id;
  return (
    <section aria-labelledby="work" className="mt-20">
      <SectionLabel>Selected work</SectionLabel>
      <h2 id="work" className="mt-3 text-2xl font-semibold tracking-tight">What I&apos;ve built</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {systems.map((s) => (
          <FlagshipCard key={s.slug} system={s} outcome={outcomeOf(s)} stack={s.technologies.slice(0, 5).map(nameOf)} />
        ))}
      </div>
    </section>
  );
}
