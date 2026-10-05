import Link from "next/link";
import { SampleTag } from "@/components/ui/SampleTag";
import { getTechnology } from "@/core/content";
import { systemNumber } from "@/core/format";
import type { System } from "@/core/schema";

export function SystemCard({ system }: { system: System }) {
  const impact = system.impact?.[0];
  return (
    <Link
      href={`/systems/${system.slug}`}
      className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-faint">
        <span>SYSTEM / {systemNumber(system.number)}</span>
        <span className={system.status === "production" ? "text-accent" : undefined}>{system.status}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-text">{system.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{system.tagline}</p>
      {impact && (
        <p className="mt-5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-accent">{impact.value}</span>
          <span className="text-xs text-muted">{impact.label}</span>
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-5">
        {system.technologies.slice(0, 4).map((t) => (
          <span key={t} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {getTechnology(t)?.name ?? t}
          </span>
        ))}
        {system.technologies.length > 4 && (
          <span className="font-mono text-[10px] text-faint">+{system.technologies.length - 4}</span>
        )}
        <span className="ml-auto">
          <SampleTag show={system.placeholder} />
        </span>
      </div>
    </Link>
  );
}
