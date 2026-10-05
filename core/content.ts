import { rawPortfolio } from "@/content";
import { portfolioSchema, type Commit, type Portfolio, type System } from "./schema";

function duplicates(values: (string | number)[]): (string | number)[] {
  const seen = new Set<string | number>();
  const dupes = new Set<string | number>();
  for (const v of values) (seen.has(v) ? dupes : seen).add(v);
  return [...dupes];
}

export function checkIntegrity(p: Portfolio): string[] {
  const errors: string[] = [];
  const techIds = new Set(p.technologies.map((t) => t.id));
  const capIds = new Set(p.capabilities.map((c) => c.id));
  const systemIds = new Set(p.systems.map((s) => s.id));

  for (const d of duplicates(p.technologies.map((t) => t.id))) errors.push(`technologies: duplicate id "${d}"`);
  for (const d of duplicates(p.capabilities.map((c) => c.id))) errors.push(`capabilities: duplicate id "${d}"`);
  for (const d of duplicates(p.systems.map((s) => s.slug))) errors.push(`systems: duplicate slug "${d}"`);
  for (const d of duplicates(p.systems.map((s) => s.number))) errors.push(`systems: duplicate number ${d}`);

  for (const c of p.capabilities) {
    for (const t of c.technologies) {
      if (!techIds.has(t)) errors.push(`capabilities.${c.id}.technologies: unknown technology "${t}"`);
    }
  }

  for (const s of p.systems) {
    const at = `systems.${s.slug}`;
    for (const t of s.technologies) if (!techIds.has(t)) errors.push(`${at}.technologies: unknown technology "${t}"`);
    for (const c of s.capabilities) if (!capIds.has(c)) errors.push(`${at}.capabilities: unknown capability "${c}"`);

    const nodeIds = new Set(s.architecture.nodes.map((n) => n.id));
    for (const d of duplicates(s.architecture.nodes.map((n) => n.id))) errors.push(`${at}.architecture.nodes: duplicate id "${d}"`);
    s.architecture.nodes.forEach((n) => {
      for (const t of n.tech ?? []) if (!techIds.has(t)) errors.push(`${at}.architecture.nodes.${n.id}.tech: unknown technology "${t}"`);
    });
    s.architecture.edges.forEach((e, i) => {
      for (const end of [e.from, e.to]) {
        if (!nodeIds.has(end)) errors.push(`${at}.architecture.edges[${i}]: unknown node "${end}"`);
      }
    });
    s.simulation?.steps.forEach((step, i) => {
      if (!nodeIds.has(step.nodeId)) errors.push(`${at}.simulation.steps[${i}]: unknown node "${step.nodeId}"`);
    });
  }

  for (const e of p.experience) {
    e.commits.forEach((c, i) => {
      for (const sys of c.systems ?? []) {
        if (!systemIds.has(sys)) errors.push(`experience.${e.id}.commits[${i}]: unknown system "${sys}"`);
      }
    });
  }

  return errors;
}

export function validatePortfolio(raw: unknown): Portfolio {
  const parsed = portfolioSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid portfolio content:\n${lines.join("\n")}`);
  }
  const errors = checkIntegrity(parsed.data);
  if (errors.length > 0) throw new Error(`Portfolio integrity errors:\n${errors.join("\n")}`);

  const p = parsed.data;
  return {
    ...p,
    systems: [...p.systems].sort((a, b) => a.number - b.number),
    experience: [...p.experience].sort((a, b) => b.start.localeCompare(a.start)),
  };
}

export const portfolio: Portfolio = validatePortfolio(rawPortfolio);

export const getIdentity = () => portfolio.identity;
export const getSystems = () => portfolio.systems;
export const getFeaturedSystems = () => portfolio.systems.filter((s) => s.featured);
export const getSystem = (slug: string): System | undefined => portfolio.systems.find((s) => s.slug === slug);
export const getTechnologies = () => portfolio.technologies;
export const getTechnology = (id: string) => portfolio.technologies.find((t) => t.id === id);
export const getCapabilities = () => portfolio.capabilities;
export const getCapability = (id: string) => portfolio.capabilities.find((c) => c.id === id);
export const getExperience = () => portfolio.experience;
export const getSystemsByTechnology = (id: string) => portfolio.systems.filter((s) => s.technologies.includes(id));
export const getSystemsByCapability = (id: string) => portfolio.systems.filter((s) => s.capabilities.includes(id));

export function getRelatedSystems(slug: string, limit = 3): System[] {
  const self = getSystem(slug);
  if (!self) return [];
  return portfolio.systems
    .filter((s) => s.slug !== slug)
    .map((s) => ({ s, shared: s.technologies.filter((t) => self.technologies.includes(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.s.number - b.s.number)
    .slice(0, limit)
    .map((x) => x.s);
}

export function getCommits(): (Commit & { experienceId: string; organisation: string })[] {
  return portfolio.experience
    .flatMap((e) => e.commits.map((c) => ({ ...c, experienceId: e.id, organisation: e.organisation })))
    .sort((a, b) => b.date.localeCompare(a.date));
}
