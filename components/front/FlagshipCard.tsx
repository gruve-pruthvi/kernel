"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import type { System } from "@/core/schema";
import { useMotionAllowed } from "@/lib/use-motion-allowed";

export function FlagshipCard({ system, outcome, stack }: { system: System; outcome: string; stack: string[] }) {
  const [peek, setPeek] = useState(false);
  const motion = useMotionAllowed();
  return (
    <article
      className="vt-boot group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong"
      style={{ "--vt": `boot-system-${system.slug}` } as CSSProperties}
      onPointerEnter={() => setPeek(true)}
      onPointerLeave={() => setPeek(false)}
      onFocus={() => setPeek(true)}
      onBlur={() => setPeek(false)}
    >
      <p className="font-mono text-[11px] text-faint">{system.category}</p>
      <h3 className="mt-1 text-lg font-semibold">{system.name}</h3>
      <p className="mt-2 text-sm font-medium text-accent">{outcome}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{system.summary}</p>
      <div className={`mt-4 overflow-hidden rounded-md border border-border bg-bg transition-all duration-300 ${peek ? "max-h-56 opacity-100" : "max-h-0 border-transparent opacity-0"}`} aria-hidden={!peek}>
        {peek && (
          <ArchitectureDiagram
            architecture={system.architecture}
            focusId={null}
            activeId={null}
            motion={motion}
            onHover={() => {}}
            onSelect={() => {}}
            className="h-auto w-full"
          />
        )}
      </div>
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Stack">
        {stack.map((t) => (
          <li key={t} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {t}
          </li>
        ))}
      </ul>
      <Link href={`/systems/${system.slug}`} className="mt-auto pt-5 text-sm text-text underline-offset-4 hover:underline">
        Case study →
      </Link>
    </article>
  );
}
