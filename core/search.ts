import { nodeId } from "./graph";
import type { Portfolio } from "./schema";

export type EntityKind = "system" | "technology" | "capability" | "experience" | "identity";

export interface SearchResult {
  kind: EntityKind;
  id: string;
  title: string;
  href: string;
  score: number;
}

interface SearchDoc {
  kind: EntityKind;
  id: string;
  title: string;
  href: string;
  titleTokens: string[];
  bodyTokens: string[];
}

const STOPWORDS = new Set(
  "a an and are as at be been but by can did do does for from has have he her his how i in is it its me my of on or our she show tell that the their them they this to was we what when where which who why will with you your about any all also".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const cache = new WeakMap<Portfolio, SearchDoc[]>();

function buildIndex(p: Portfolio): SearchDoc[] {
  const cached = cache.get(p);
  if (cached) return cached;

  const techName = (id: string) => p.technologies.find((t) => t.id === id)?.name ?? id;
  const capName = (id: string) => p.capabilities.find((c) => c.id === id)?.name ?? id;
  const doc = (kind: EntityKind, id: string, title: string, href: string, body: string[]): SearchDoc => ({
    kind,
    id,
    title,
    href,
    titleTokens: tokenize(title),
    bodyTokens: tokenize(body.join(" ")),
  });

  const docs: SearchDoc[] = [
    ...p.systems.map((s) =>
      doc("system", s.slug, s.name, `/systems/${s.slug}`, [
        s.tagline,
        s.category,
        s.summary,
        s.problem,
        s.role,
        ...s.responsibilities,
        ...s.technologies.map(techName),
        ...s.capabilities.map(capName),
        ...s.architecture.nodes.flatMap((n) => [n.label, n.description]),
        ...s.decisions.flatMap((d) => [d.title, d.choice]),
      ]),
    ),
    ...p.technologies.map((t) =>
      doc("technology", t.id, t.name, `/graph?focus=${encodeURIComponent(nodeId("technology", t.id))}`, [
        t.category,
        ...p.systems.filter((s) => s.technologies.includes(t.id)).map((s) => s.name),
      ]),
    ),
    ...p.capabilities.map((c) =>
      doc("capability", c.id, c.name, `/graph?focus=${encodeURIComponent(nodeId("capability", c.id))}`, [
        c.description,
        ...c.technologies.map(techName),
      ]),
    ),
    ...p.experience.map((e) =>
      doc("experience", e.id, `${e.role} — ${e.organisation}`, "/trace", [
        e.summary,
        e.branch,
        ...e.commits.flatMap((c) => [c.message, c.body ?? ""]),
      ]),
    ),
    doc("identity", "identity", p.identity.name, "/#human", [
      p.identity.role,
      p.identity.tagline,
      p.identity.summary,
      p.identity.location ?? "",
      p.identity.human.about,
      ...p.identity.human.interests,
      ...p.identity.principles.map((x) => x.title),
    ]),
  ];

  cache.set(p, docs);
  return docs;
}

export function searchPortfolio(p: Portfolio, query: string, limit = 5): SearchResult[] {
  const q = tokenize(query);
  if (q.length === 0) return [];
  const phrase = query.trim().toLowerCase();

  return buildIndex(p)
    .map((d) => {
      let score = 0;
      if (d.title.toLowerCase() === phrase) score += 12;
      for (const token of q) {
        if (d.titleTokens.includes(token)) score += 6;
        else if (d.titleTokens.some((t) => t.startsWith(token) || token.startsWith(t))) score += 3;
        score += Math.min(3, d.bodyTokens.filter((t) => t === token).length);
      }
      return { kind: d.kind, id: d.id, title: d.title, href: d.href, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const indexSize = (p: Portfolio): number => buildIndex(p).length;
