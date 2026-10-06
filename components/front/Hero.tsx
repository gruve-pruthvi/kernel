import Link from "next/link";
import type { CSSProperties } from "react";
import { btnGhost, btnPrimary } from "@/components/ui/styles";
import type { Identity } from "@/core/schema";

export function Hero({ identity }: { identity: Identity }) {
  return (
    <section id="top" aria-labelledby="hero-name" className="pt-14 sm:pt-24">
      {identity.availability && (
        <p className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          {identity.availability}
        </p>
      )}
      <h1 id="hero-name" className="vt-boot mt-5 text-4xl font-semibold tracking-tight sm:text-6xl" style={{ "--vt": "kernel-name" } as CSSProperties}>
        {identity.name}
      </h1>
      <p className="mt-3 text-lg text-muted sm:text-xl">
        {identity.role}
        {identity.location ? ` · ${identity.location}` : ""}
      </p>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text">{identity.tagline}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/connect" className={btnPrimary}>
          Contact
        </Link>
        {identity.links.resume && (
          <a href={identity.links.resume} className={btnGhost} download>
            Résumé ↓
          </a>
        )}
        <a href="#ask" className="inline-flex items-center px-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline">
          Ask about me →
        </a>
      </div>
    </section>
  );
}
