import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { ArchitectureExplorer } from "@/components/architecture/ArchitectureExplorer";
import { AskButton } from "@/components/home/AskButton";
import { SystemCard } from "@/components/systems/SystemCard";
import { Decisions, Impact, Section, TradeOffs } from "@/components/systems/SystemSections";
import { SampleTag } from "@/components/ui/SampleTag";
import { Tag } from "@/components/ui/Tag";
import { getCapability, getRelatedSystems, getSystem, getSystems, getTechnologies, getTechnology } from "@/core/content";
import { systemNumber } from "@/core/format";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getSystems().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getSystem(slug);
  return s ? { title: s.name, description: s.tagline } : {};
}

export default async function SystemPage({ params }: Props) {
  const { slug } = await params;
  const system = getSystem(slug);
  if (!system) notFound();

  const techNames = Object.fromEntries(getTechnologies().map((t) => [t.id, t.name]));
  const related = getRelatedSystems(system.slug);

  return (
    <article className="pb-8">
      <header className="py-14 sm:py-20">
        <Link href="/systems" className="font-mono text-xs text-faint hover:text-text">
          ← systems
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          <span>SYSTEM / {systemNumber(system.number)}</span>
          <span aria-hidden>·</span>
          <span className={system.status === "production" ? "text-accent" : undefined}>{system.status}</span>
          {system.period && (
            <>
              <span aria-hidden>·</span>
              <span>{system.period}</span>
            </>
          )}
          <SampleTag show={system.placeholder} />
        </div>
        <ViewTransition name={`system-title-${system.slug}`} share="morph" default="none">
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{system.name}</h1>
        </ViewTransition>
        <p className="mt-3 max-w-2xl text-lg text-muted">{system.tagline}</p>
        <p className="mt-6 max-w-3xl leading-relaxed text-text">{system.summary}</p>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {system.technologies.map((t) => (
            <Tag key={t} href={`/graph?focus=${encodeURIComponent(`tech:${t}`)}`}>
              {getTechnology(t)?.name ?? t}
            </Tag>
          ))}
        </div>
      </header>

      <Section id="problem" label="01 · Problem" title="Why it exists">
        <div className="grid gap-8 md:grid-cols-2">
          <p className="leading-relaxed text-muted">{system.problem}</p>
          <div>
            {system.context && <p className="leading-relaxed text-muted">{system.context}</p>}
            <p className="mt-4 text-sm">
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">Role </span>
              {system.role}
            </p>
            {system.responsibilities.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {system.responsibilities.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-accent" aria-hidden>
                      ›
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      <Section id="architecture" label="02 · Architecture" title="Inspect the system">
        <ViewTransition name={`system-arch-${system.slug}`} share="morph" default="none">
          <div>
            <ArchitectureExplorer architecture={system.architecture} simulation={system.simulation} techNames={techNames} />
          </div>
        </ViewTransition>
      </Section>

      {system.decisions.length > 0 && (
        <Section id="decisions" label="03 · Decisions" title="Why it's built this way">
          <Decisions decisions={system.decisions} />
        </Section>
      )}

      {Boolean(system.challenges?.length || system.tradeOffs?.length) && (
        <Section id="tradeoffs" label="04 · Trade-offs" title="What it cost">
          <TradeOffs system={system} />
        </Section>
      )}

      {system.impact && system.impact.length > 0 && (
        <Section id="impact" label="05 · Impact" title="What changed">
          <Impact impact={system.impact} />
        </Section>
      )}

      <Section id="evidence" label="06 · Evidence">
        <div className="flex flex-wrap items-center gap-2">
          {system.capabilities.map((c) => (
            <Tag key={c} tone="accent" href={`/graph?focus=${encodeURIComponent(`cap:${c}`)}`}>
              {getCapability(c)?.name ?? c}
            </Tag>
          ))}
          {system.links?.repo && (
            <a href={system.links.repo} className="ml-auto font-mono text-xs text-muted hover:text-text" target="_blank" rel="noreferrer">
              repository ↗
            </a>
          )}
          {system.links?.demo && (
            <a href={system.links.demo} className="font-mono text-xs text-muted hover:text-text" target="_blank" rel="noreferrer">
              demo ↗
            </a>
          )}
        </div>
        <div className="mt-6">
          <AskButton label={`Ask about ${system.name}`} seed={`How does ${system.name} work?`} />
        </div>
      </Section>

      {related.length > 0 && (
        <Section id="related" label="Related systems">
          <div className="grid gap-4 md:grid-cols-3">
            {related.map((s) => (
              <SystemCard key={s.slug} system={s} />
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}
