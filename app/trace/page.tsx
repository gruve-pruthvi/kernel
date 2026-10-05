import type { Metadata } from "next";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getExperience, getSystem } from "@/core/content";
import { formatMonth, formatPeriod } from "@/core/format";

export const metadata: Metadata = { title: "Trace", description: "A career read as commit history." };

export default function TracePage() {
  const experience = getExperience();
  return (
    <div className="py-14 sm:py-20">
      <SectionLabel>Trace</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">git log --career</h1>
      <p className="mt-3 max-w-2xl text-muted">Each role is a branch. Each milestone is a commit. Newest first.</p>

      <ol className="mt-12 space-y-12">
        {experience.map((e) => (
          <li
            key={e.id}
            className="relative pl-8 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%+3rem)] before:w-px before:bg-border last:before:hidden"
          >
            <span className="absolute left-0 top-1 grid size-[15px] place-items-center rounded-full border border-accent bg-bg" aria-hidden>
              <span className="size-[5px] rounded-full bg-accent" />
            </span>
            <p className="font-mono text-xs text-accent">
              branch: <span className="text-text">{e.branch}</span>
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              {e.role} <span className="font-normal text-muted">· {e.organisation}</span>
            </h2>
            <p className="mt-1 font-mono text-[11px] text-faint">{formatPeriod(e.start, e.end)}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{e.summary}</p>

            <ul className="mt-5 space-y-3 border-l border-dashed border-border pl-5">
              {e.commits.map((c) => (
                <li key={c.hash} className="relative">
                  <span className="absolute -left-[24px] top-[7px] size-[7px] rounded-full bg-border-strong" aria-hidden />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <code className="font-mono text-xs text-accent">{c.hash}</code>
                    <span className="text-sm text-text">{c.message}</span>
                    <span className="ml-auto font-mono text-[11px] text-faint">{formatMonth(c.date)}</span>
                  </div>
                  {c.body && <p className="mt-1 text-sm text-muted">{c.body}</p>}
                  {c.systems && c.systems.length > 0 && (
                    <p className="mt-1 flex gap-2 font-mono text-[11px]">
                      {c.systems.map((slug) => (
                        <Link key={slug} href={`/systems/${slug}`} className="text-muted underline-offset-2 hover:text-text hover:underline">
                          → {getSystem(slug)?.name ?? slug}
                        </Link>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
