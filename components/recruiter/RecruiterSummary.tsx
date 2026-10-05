"use client";

import Link from "next/link";
import { btnGhost, btnPrimary } from "@/components/ui/styles";
import { getFeaturedSystems, getIdentity, getTechnology } from "@/core/content";
import { systemNumber } from "@/core/format";
import { kernel, useKernel } from "@/lib/store";

export function RecruiterSummary() {
  const on = useKernel((s) => s.recruiter);
  if (!on) return null;

  const identity = getIdentity();
  const featured = getFeaturedSystems().slice(0, 3);
  const stack = [...new Set(featured.flatMap((s) => s.technologies))].slice(0, 10);

  return (
    <section aria-label="Recruiter summary" className="mt-6 rounded-lg border border-accent/40 bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Recruiter summary</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{identity.name}</h2>
          <p className="mt-1 text-muted">
            {identity.role}
            {identity.location ? ` · ${identity.location}` : ""}
          </p>
          {identity.availability && <p className="mt-1 text-sm text-accent">{identity.availability}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {identity.links.resume && (
            <a href={identity.links.resume} className={btnPrimary} download>
              Resume
            </a>
          )}
          <Link href="/connect" className={btnGhost}>
            Contact
          </Link>
          <button type="button" onClick={() => kernel.setRecruiter(false)} className="px-2 font-mono text-xs text-muted hover:text-text">
            exit ×
          </button>
        </div>
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {featured.map((s) => {
          const impact = s.impact?.[0];
          return (
            <li key={s.slug}>
              <Link href={`/systems/${s.slug}`} className="block h-full rounded-md border border-border p-4 transition hover:border-border-strong">
                <p className="font-mono text-[10px] text-faint">SYSTEM / {systemNumber(s.number)}</p>
                <p className="mt-1 font-semibold">{s.name}</p>
                <p className="mt-1 text-sm text-muted">{s.tagline}</p>
                {impact && (
                  <p className="mt-3 text-sm">
                    <span className="font-semibold text-accent">{impact.value}</span> <span className="text-muted">{impact.label}</span>
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-sm text-muted">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Core stack </span>
        {stack.map((t) => getTechnology(t)?.name ?? t).join(" · ")}
      </p>
    </section>
  );
}
