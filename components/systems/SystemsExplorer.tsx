"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SystemCard } from "@/components/systems/SystemCard";
import { SystemGroups } from "@/components/systems/SystemGroups";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { chip, chipActive } from "@/components/ui/styles";
import type { Capability, System, Technology } from "@/core/schema";

export function SystemsExplorer({
  systems,
  technologies,
  capabilities,
}: {
  systems: System[];
  technologies: Technology[];
  capabilities: Capability[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tech = params.get("tech");
  const capability = params.get("capability");

  const usedTech = technologies.filter((t) => systems.some((s) => s.technologies.includes(t.id)));
  const usedCaps = capabilities.filter((c) => systems.some((s) => s.capabilities.includes(c.id)));

  const setFilter = (key: "tech" | "capability", value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filtered = systems.filter(
    (s) => (!tech || s.technologies.includes(tech)) && (!capability || s.capabilities.includes(capability)),
  );
  const isFiltering = Boolean(tech || capability);

  return (
    <div>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 font-mono text-[11px] uppercase tracking-wider text-faint">Capability</span>
          {usedCaps.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={capability === c.id}
              className={capability === c.id ? chipActive : chip}
              onClick={() => setFilter("capability", capability === c.id ? null : c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 font-mono text-[11px] uppercase tracking-wider text-faint">Technology</span>
          {usedTech.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tech === t.id}
              className={tech === t.id ? chipActive : chip}
              onClick={() => setFilter("tech", tech === t.id ? null : t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        {isFiltering && (
          <button type="button" className="font-mono text-xs text-muted hover:text-text" onClick={() => router.replace(pathname, { scroll: false })}>
            clear filters ×
          </button>
        )}
      </div>

      {isFiltering ? (
        <div className="mt-8">
          <SectionLabel>
            {filtered.length} {filtered.length === 1 ? "system" : "systems"} match
          </SectionLabel>
          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No systems match both filters.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {filtered.map((s) => (
                <SystemCard key={s.slug} system={s} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <SystemGroups systems={systems} />
      )}
    </div>
  );
}
