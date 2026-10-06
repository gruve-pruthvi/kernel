import { formatPeriod } from "./format";
import { TECH_CATEGORIES, type Portfolio, type System, type TechCategory } from "./schema";

export function flagships(p: Portfolio, limit = 3): System[] {
  const featured = p.systems.filter((s) => s.featured);
  return (featured.length ? featured : p.systems).slice(0, limit);
}

export function proofStats(p: Portfolio, limit = 3): { value: string; label: string; slug: string }[] {
  return flagships(p)
    .flatMap((s) => (s.impact?.[0] ? [{ value: s.impact[0].value, label: s.impact[0].label, slug: s.slug }] : []))
    .slice(0, limit);
}

export function outcomeOf(s: System): string {
  const i = s.impact?.[0];
  return i ? `${i.value} ${i.label}` : s.tagline;
}

export function timeline(p: Portfolio) {
  return p.experience.map((e) => ({
    id: e.id,
    role: e.role,
    organisation: e.organisation,
    period: formatPeriod(e.start, e.end),
    highlight: e.commits[0]?.message ?? e.summary,
  }));
}

export function stackGroups(p: Portfolio): { category: TechCategory; names: string[] }[] {
  return TECH_CATEGORIES.map((category) => ({
    category,
    names: p.technologies.filter((t) => t.category === category).map((t) => t.name),
  })).filter((g) => g.names.length > 0);
}

export function askChips(p: Portfolio): string[] {
  const first = p.identity.name.split(/\s+/)[0];
  return [`What kind of role is ${first} looking for?`, `What is ${first}'s strongest project?`, `How does ${first} work in a team?`];
}
