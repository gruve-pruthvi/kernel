// Full class names so Tailwind sees them; one column per stat so fewer than three never leaves empty cells.
const COLS = ["sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"];

export function ProofStrip({ stats }: { stats: { value: string; label: string; slug: string }[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-label="Impact" className={`mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border ${COLS[Math.min(stats.length, 3) - 1]}`}>
      {stats.map((s) => (
        <div key={s.slug} className="bg-surface p-6">
          <p className="text-3xl font-semibold tracking-tight text-accent sm:text-4xl">{s.value}</p>
          <p className="mt-2 text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
