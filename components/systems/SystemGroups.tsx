import { SystemCard } from "@/components/systems/SystemCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { System } from "@/core/schema";

// Unfiltered "Featured / Other" listing — shared by the interactive explorer and its static fallback.
export function SystemGroups({ systems }: { systems: System[] }) {
  const other = systems.filter((s) => !s.featured);
  return (
    <>
      <div className="mt-10">
        <SectionLabel>Featured</SectionLabel>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {systems.filter((s) => s.featured).map((s) => (
            <SystemCard key={s.slug} system={s} />
          ))}
        </div>
      </div>
      {other.length > 0 && (
        <div className="mt-10">
          <SectionLabel>Other systems</SectionLabel>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {other.map((s) => (
              <SystemCard key={s.slug} system={s} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
