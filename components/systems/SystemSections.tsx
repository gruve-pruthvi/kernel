import { SectionLabel } from "@/components/ui/SectionLabel";
import type { Decision, System } from "@/core/schema";

export function Section({ id, label, title, children }: { id: string; label: string; title?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border py-10">
      <SectionLabel>{label}</SectionLabel>
      {title && (
        <h2 id={id} className="mt-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>
      )}
      {!title && <h2 id={id} className="sr-only">{label}</h2>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Decisions({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {decisions.map((d) => (
        <article key={d.title} className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug">{d.title}</h3>
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase text-faint">{d.status}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{d.context}</p>
          <ul className="mt-4 space-y-1.5">
            {d.options.map((o) => (
              <li key={o} className={`flex items-center gap-2 font-mono text-[12px] ${o === d.choice ? "text-accent" : "text-faint"}`}>
                <span aria-hidden>{o === d.choice ? "●" : "○"}</span>
                {o}
                {o === d.choice && <span className="sr-only">(chosen)</span>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-text">{d.rationale}</p>
        </article>
      ))}
    </div>
  );
}

export function TradeOffs({ system }: { system: System }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {system.challenges && system.challenges.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Challenges</h3>
          <ul className="space-y-2 text-sm text-muted">
            {system.challenges.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-accent" aria-hidden>
                  —
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {system.tradeOffs && system.tradeOffs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Trade-offs</h3>
          <ul className="space-y-3">
            {system.tradeOffs.map((t) => (
              <li key={t.gained} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="font-mono text-[11px] text-accent">+</span>
                <span>{t.gained}</span>
                <span className="font-mono text-[11px] text-faint">−</span>
                <span className="text-muted">{t.cost}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Impact({ impact }: { impact: NonNullable<System["impact"]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {impact.map((i) => (
        <div key={i.label} className="rounded-lg border border-border bg-surface p-5">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight text-accent">{i.value}</dd>
          {i.note && <dd className="mt-1 font-mono text-[10px] text-faint">{i.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
