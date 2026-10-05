import type { Portfolio } from "./schema";

export type GraphNodeType = "system" | "technology" | "capability";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  ref: string;
  label: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PREFIX: Record<GraphNodeType, string> = { system: "system", technology: "tech", capability: "cap" };

export function nodeId(type: GraphNodeType, ref: string): string {
  return `${PREFIX[type]}:${ref}`;
}

const cache = new WeakMap<Portfolio, Graph>();

export function buildGraph(p: Portfolio): Graph {
  const cached = cache.get(p);
  if (cached) return cached;

  const nodes: GraphNode[] = [
    ...p.systems.map((s) => ({ id: nodeId("system", s.slug), type: "system" as const, ref: s.slug, label: s.name })),
    ...p.capabilities.map((c) => ({ id: nodeId("capability", c.id), type: "capability" as const, ref: c.id, label: c.name })),
    ...p.technologies.map((t) => ({ id: nodeId("technology", t.id), type: "technology" as const, ref: t.id, label: t.name })),
  ];

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  const add = (source: string, target: string) => {
    const key = `${source}>${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source, target });
  };

  for (const s of p.systems) {
    for (const t of s.technologies) add(nodeId("system", s.slug), nodeId("technology", t));
    for (const c of s.capabilities) add(nodeId("system", s.slug), nodeId("capability", c));
  }
  for (const c of p.capabilities) {
    for (const t of c.technologies) add(nodeId("capability", c.id), nodeId("technology", t));
  }

  const graph = { nodes, edges };
  cache.set(p, graph);
  return graph;
}

export function neighbours(g: Graph, id: string): Set<string> {
  const out = new Set<string>();
  for (const e of g.edges) {
    if (e.source === id) out.add(e.target);
    if (e.target === id) out.add(e.source);
  }
  return out;
}

export function resolveNodeId(g: Graph, raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;
  const exact = g.nodes.find((n) => n.id === value);
  if (exact) return exact.id;
  for (const type of ["system", "technology", "capability"] as const) {
    const byRef = g.nodes.find((n) => n.type === type && n.ref === value);
    if (byRef) return byRef.id;
  }
  return g.nodes.find((n) => n.label.toLowerCase() === value)?.id;
}

export function resolveFocus(g: Graph, raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((part) => resolveNodeId(g, part))
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

export function nodeHref(node: GraphNode): string {
  return node.type === "system" ? `/systems/${node.ref}` : `/graph?focus=${encodeURIComponent(node.id)}`;
}
