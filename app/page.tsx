import Link from "next/link";
import { AskButton } from "@/components/home/AskButton";
import { HeroGraph } from "@/components/home/HeroGraph";
import { BootSequence } from "@/components/shell/BootSequence";
import { SystemCard } from "@/components/systems/SystemCard";
import { Kbd } from "@/components/ui/Kbd";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { btnPrimary } from "@/components/ui/styles";
import { getFeaturedSystems, getIdentity, portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";

const ENTRIES = [
  { href: "/graph", label: "Graph", body: "Technologies, capabilities and systems as one connected map." },
  { href: "/trace", label: "Trace", body: "A career read as commit history — branches, merges and milestones." },
  { href: "/human", label: "Human", body: "How I think, what I value, and what I do away from the keyboard." },
];

export default function Home() {
  const identity = getIdentity();
  const featured = getFeaturedSystems();
  const { nodes, edges } = layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 });

  return (
    <>
      <BootSequence />
      <section className="relative isolate -mx-4 overflow-hidden px-4 pb-20 pt-20 sm:-mx-6 sm:px-6 sm:pt-28">
        <div className="bg-grid absolute inset-0 -z-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <HeroGraph nodes={nodes} edges={edges} />
        <SectionLabel className="animate-fade-up">{identity.role}</SectionLabel>
        <h1
          className="animate-fade-up mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          {identity.tagline}
        </h1>
        <p className="animate-fade-up mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg" style={{ animationDelay: "120ms" }}>
          {identity.summary}
        </p>
        <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
          <Link href="/systems" className={btnPrimary}>
            Explore systems <span aria-hidden>→</span>
          </Link>
          <AskButton />
        </div>
        <p className="mt-6 hidden items-center gap-2 font-mono text-[11px] text-faint sm:flex">
          <Kbd>/</Kbd> ask anything <span aria-hidden>·</span> <Kbd>⌘K</Kbd> command line
        </p>
      </section>

      <section aria-labelledby="featured" className="py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <SectionLabel>Featured systems</SectionLabel>
            <h2 id="featured" className="mt-2 text-2xl font-semibold tracking-tight">
              Don&apos;t read about it. Inspect it.
            </h2>
          </div>
          <Link href="/systems" className="hidden font-mono text-xs text-muted hover:text-text sm:block">
            all systems →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {featured.map((s) => (
            <SystemCard key={s.slug} system={s} />
          ))}
        </div>
      </section>

      <section aria-label="Explore" className="grid gap-4 py-12 md:grid-cols-3">
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group rounded-lg border border-border p-5 transition hover:border-border-strong hover:bg-surface"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{e.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{e.body}</p>
            <p className="mt-4 font-mono text-xs text-faint transition group-hover:text-text">open →</p>
          </Link>
        ))}
      </section>
    </>
  );
}
