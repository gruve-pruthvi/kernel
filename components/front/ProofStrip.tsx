export function ProofStrip({ stats }: { stats: { value: string; label: string; slug: string }[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-label="Impact" className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.slug} className="bg-surface p-6">
          <p className="text-3xl font-semibold tracking-tight text-accent sm:text-4xl">{s.value}</p>
          <p className="mt-2 text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
