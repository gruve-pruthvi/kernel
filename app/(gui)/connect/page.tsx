import type { Metadata } from "next";
import { CopyButton } from "@/components/connect/CopyButton";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { btnGhost, btnPrimary } from "@/components/ui/styles";
import { getIdentity } from "@/core/content";

export const metadata: Metadata = { title: "Connect", description: "Get in touch." };

export default function ConnectPage() {
  const { links, availability, location, name } = getIdentity();
  const rows = [
    links.github && { label: "GitHub", href: links.github },
    links.linkedin && { label: "LinkedIn", href: links.linkedin },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="py-14 sm:py-20">
      <SectionLabel>Connect</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Let&apos;s build something.</h1>
      {availability && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-sm text-accent">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden /> {availability}
        </p>
      )}

      <div className="mt-10 max-w-xl rounded-lg border border-border bg-surface p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Email</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a href={`mailto:${links.email}`} className="text-lg text-text hover:text-accent">
            {links.email}
          </a>
          <CopyButton value={links.email} />
        </div>
        {rows.length > 0 && (
          <ul className="mt-6 space-y-2 border-t border-border pt-6">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-muted">{r.label}</span>
                <a href={r.href} target="_blank" rel="noreferrer" className="font-mono text-xs text-text hover:text-accent">
                  {r.href.replace(/^https?:\/\//, "")} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`mailto:${links.email}`} className={btnPrimary}>
            Email {name.split(" ")[0]}
          </a>
          {links.resume && (
            <a href={links.resume} className={btnGhost} download>
              Download resume
            </a>
          )}
        </div>
        {location && <p className="mt-6 font-mono text-[11px] text-faint">{location}</p>}
      </div>
    </div>
  );
}
