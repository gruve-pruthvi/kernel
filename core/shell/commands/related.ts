import type { Portfolio } from "../../schema";

export function getRelatedSystemsFrom(p: Portfolio, slug: string, limit = 3): string[] {
  const self = p.systems.find((s) => s.slug === slug);
  if (!self) return [];
  return p.systems
    .filter((s) => s.slug !== slug)
    .map((s) => ({ slug: s.slug, shared: s.technologies.filter((t) => self.technologies.includes(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((x) => x.slug);
}
