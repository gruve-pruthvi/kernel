import { formatMonth, formatPeriod, systemNumber } from "../format";
import type { Portfolio } from "../schema";
import type { View } from "./types";

export type FsNode =
  | { kind: "dir"; name: string; children: FsNode[] }
  | { kind: "system"; name: string; children: FsNode[] }
  | { kind: "file"; name: string; lines: string[] }
  | { kind: "view"; name: string; view: View }
  | { kind: "link"; name: string; href: string };

export type DirNode = Extract<FsNode, { children: FsNode[] }>;

export const isDir = (n: FsNode | undefined): n is DirNode => n?.kind === "dir" || n?.kind === "system";

const dir = (name: string, children: FsNode[]): DirNode => ({ kind: "dir", name, children });
const file = (name: string, lines: string[]): FsNode => ({ kind: "file", name, lines });

const cache = new WeakMap<Portfolio, DirNode>();

export function buildFs(p: Portfolio): DirNode {
  const cached = cache.get(p);
  if (cached) return cached;

  const tech = (id: string) => p.technologies.find((t) => t.id === id)?.name ?? id;
  const cap = (id: string) => p.capabilities.find((c) => c.id === id)?.name ?? id;
  const id = p.identity;

  const systems: FsNode[] = p.systems.map((s) => {
    const children: FsNode[] = [
      file("README.md", [
        `# ${s.name}`,
        `SYSTEM / ${systemNumber(s.number)} · ${s.status}${s.period ? ` · ${s.period}` : ""} · ${s.category}`,
        "",
        s.tagline,
        "",
        s.summary,
        "",
        "## Problem",
        s.problem,
        ...(s.context ? ["", s.context] : []),
        "",
        "## Role",
        s.role,
        ...s.responsibilities.map((r) => `- ${r}`),
        "",
        `→ run ${s.slug} · open architecture · cat decisions.md`,
      ]),
      { kind: "view", name: "architecture", view: { type: "architecture", slug: s.slug } },
      file(
        "decisions.md",
        s.decisions.length > 0
          ? [
              `# Decisions — ${s.name}`,
              "",
              ...s.decisions.flatMap((d) => [
                `## ${d.title} [${d.status}]`,
                d.context,
                ...d.options.map((o) => (o === d.choice ? `● ${o}` : `○ ${o}`)),
                `→ ${d.rationale}`,
                "",
              ]),
            ]
          : [`# Decisions — ${s.name}`, "", "No decisions recorded yet."],
      ),
    ];
    if (s.challenges?.length || s.tradeOffs?.length) {
      children.push(
        file("tradeoffs.md", [
          `# Trade-offs — ${s.name}`,
          ...(s.challenges?.length ? ["", "## Challenges", ...s.challenges.map((c) => `- ${c}`)] : []),
          ...(s.tradeOffs?.length ? ["", "## Trade-offs", ...s.tradeOffs.flatMap((t) => [`+ ${t.gained}`, `− ${t.cost}`])] : []),
        ]),
      );
    }
    if (s.impact?.length) {
      children.push(
        file("impact.txt", [`# Impact — ${s.name}`, "", ...s.impact.map((i) => `${i.value.padEnd(10)} ${i.label}${i.note ? `  (${i.note})` : ""}`)]),
      );
    }
    children.push(
      file("stack.txt", [
        `# Stack — ${s.name}`,
        "",
        "## Technologies",
        ...s.technologies.map((t) => `- ${tech(t)}`),
        "",
        "## Capabilities",
        ...s.capabilities.map((c) => `- ${cap(c)}`),
      ]),
    );
    const links = Object.entries(s.links ?? {}).filter(([, v]) => Boolean(v));
    if (links.length) children.push(file("links.txt", links.map(([k, v]) => `${k.padEnd(8)} ${v}`)));
    return { kind: "system", name: s.slug, children };
  });

  const usedIn = (pred: (s: Portfolio["systems"][number]) => boolean) => {
    const names = p.systems.filter(pred).map((s) => `- ${s.name}`);
    return names.length ? names : ["- (none yet)"];
  };

  const skills = dir("skills", [
    ...p.capabilities.map((c) =>
      file(`${c.id}.md`, [
        `# ${c.name}`,
        c.description,
        "",
        "## Technologies",
        ...c.technologies.map((t) => `- ${tech(t)}`),
        "",
        "## Used in",
        ...usedIn((s) => s.capabilities.includes(c.id)),
      ]),
    ),
    { kind: "view", name: "graph", view: { type: "graph", focus: [] } },
  ]);

  const stack = dir(
    "stack",
    p.technologies.map((t) => {
      const caps = p.capabilities.filter((c) => c.technologies.includes(t.id)).map((c) => `- ${c.name}`);
      return file(`${t.id}.txt`, [
        `# ${t.name}`,
        `category: ${t.category}`,
        "",
        "## Used in",
        ...usedIn((s) => s.technologies.includes(t.id)),
        "",
        "## Capabilities",
        ...(caps.length ? caps : ["- (none yet)"]),
      ]);
    }),
  );

  const first = p.systems.find((s) => s.simulation) ?? p.systems[0];
  const root = dir("~", [
    dir("systems", systems),
    skills,
    stack,
    file("README.md", [
      `# ${id.name}`,
      id.role,
      id.tagline,
      "",
      id.summary,
      "",
      "## Explore",
      "- ls systems — the work, as directories",
      ...(first ? [`- run ${first.slug} — stream a request through a system`] : []),
      "- grep -i <term> . — search everything",
      "- man kernel — the manual",
      "- or just ask a question in plain English",
    ]),
    file("about.md", [
      "# Human",
      id.human.about,
      "",
      "## How I think",
      ...id.principles.map((x) => `- ${x.title} — ${x.body}`),
      "",
      "## Off the clock",
      `- ${id.human.interests.join(", ")}`,
    ]),
    file(
      "career.log",
      p.experience.flatMap((e) => [
        `## ${e.role} — ${e.organisation}`,
        `${formatPeriod(e.start, e.end)} · branch ${e.branch}`,
        e.summary,
        ...e.commits.map((c) => `  ${c.hash}  ${c.message}  (${formatMonth(c.date)})`),
        "",
      ]),
    ),
    file("contact.txt", [
      `email     ${id.links.email}`,
      ...(id.links.github ? [`github    ${id.links.github}`] : []),
      ...(id.links.linkedin ? [`linkedin  ${id.links.linkedin}`] : []),
      ...(id.availability ? ["", id.availability] : []),
    ]),
    ...(id.links.resume ? [{ kind: "link" as const, name: "resume.pdf", href: id.links.resume }] : []),
  ]);

  cache.set(p, root);
  return root;
}

export function normalise(cwd: string[], path: string): string[] {
  const absolute = path === "~" || path.startsWith("~/") || path.startsWith("/");
  const parts = absolute ? [] : [...cwd];
  const rest = absolute ? path.replace(/^~\/?/, "").replace(/^\/+/, "") : path;
  for (const segment of rest.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts;
}

export function resolve(root: DirNode, cwd: string[], path: string): FsNode | undefined {
  let node: FsNode | undefined = root;
  for (const segment of normalise(cwd, path)) {
    if (!isDir(node)) return undefined;
    node = node.children.find((c) => c.name === segment);
    if (!node) return undefined;
  }
  return node;
}

export const pathOf = (parts: string[]) => (parts.length ? `~/${parts.join("/")}` : "~");

export const joinPath = (base: string, name: string) => (!base || base === "." ? name : `${base.replace(/\/+$/, "")}/${name}`);

export function walk(node: FsNode, parts: string[]): { node: FsNode; parts: string[] }[] {
  const self = { node, parts };
  if (!isDir(node)) return [self];
  return [self, ...node.children.flatMap((c) => walk(c, [...parts, c.name]))];
}

export function displayPath(parts: string[], cwd: string[]): string {
  const under = cwd.every((c, i) => parts[i] === c);
  if (under && parts.length === cwd.length) return ".";
  if (under) return parts.slice(cwd.length).join("/");
  return pathOf(parts);
}

export const nodeText = (node: FsNode): string[] => (node.kind === "file" ? node.lines : []);
