import type { Portfolio } from "../schema";
import { searchPortfolio, tokenize } from "../search";
import { out, seg } from "./registry";
import type { OutputItem } from "./types";

export interface ExplainLeaf {
  kind: "component" | "decision" | "technology" | "impact";
  label: string;
  run: string;
}

export interface ExplainNode {
  slug: string;
  name: string;
  children: ExplainLeaf[];
}

/** Same word, or a shared stem of 5+ letters ("citations" ~ "citation", "verify" ~ "verifier"). */
export function similar(a: string, b: string): boolean {
  if (a === b) return true;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 5;
}

/** Systems related to a question, each with the parts of its content that match. Never invents anything. */
export function explain(p: Portfolio, question: string, limit = 3): ExplainNode[] {
  const tokens = tokenize(question);
  if (tokens.length === 0) return [];
  const hits = (text: string) => tokenize(text).some((t) => tokens.some((q) => similar(t, q)));
  const slugs = searchPortfolio(p, question, 10)
    .filter((r) => r.kind === "system")
    .map((r) => r.id)
    .slice(0, limit);

  return slugs.map((slug) => {
    const s = p.systems.find((x) => x.slug === slug)!;
    const leaves: ExplainLeaf[] = [
      ...s.architecture.nodes
        .filter((n) => hits(`${n.label} ${n.description}`))
        .map((n) => ({ kind: "component" as const, label: n.label, run: `open ${slug}` })),
      ...s.decisions
        .filter((d) => hits(`${d.title} ${d.choice}`))
        .map((d) => ({ kind: "decision" as const, label: d.title, run: `man ${slug}` })),
      ...s.technologies
        .map((id) => p.technologies.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t && hits(t.name)))
        .map((t) => ({ kind: "technology" as const, label: t.name, run: `graph ${t.id}` })),
      ...(s.impact ?? [])
        .filter((i) => hits(`${i.label} ${i.value}`))
        .map((i) => ({ kind: "impact" as const, label: `${i.value} ${i.label}`, run: `cat ~/systems/${slug}/impact.txt` })),
    ];
    return { slug, name: s.name, children: leaves.slice(0, 3) };
  });
}

export function explainLines(nodes: ExplainNode[]): OutputItem[] {
  if (nodes.length === 0) return [];
  return [
    out(seg("  related in this portfolio", "faint")),
    ...nodes.flatMap((n) => [
      out(seg("  "), seg(n.name, "accent", { run: `open ${n.slug}` })),
      ...n.children.map((c, i) =>
        out(seg(`  ${i === n.children.length - 1 ? "└── " : "├── "}`, "faint"), seg(`${c.kind}: `, "faint"), seg(c.label, "text", { run: c.run })),
      ),
    ]),
  ];
}
