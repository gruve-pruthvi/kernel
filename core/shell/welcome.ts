import { buildGraph } from "../graph";
import type { Portfolio } from "../schema";
import { blank, out, seg } from "./registry";
import type { OutputItem, Tone } from "./types";

export interface NeofetchRow {
  label: string;
  value: string;
  tone?: Tone;
  href?: string;
}

export const handleOf = (p: Portfolio) =>
  p.identity.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "engineer";

export function neofetchData(p: Portfolio): { handle: string; rows: NeofetchRow[] } {
  const id = p.identity;
  const prod = p.systems.filter((s) => s.status === "production").length;
  const usage = (techId: string) => p.systems.filter((s) => s.technologies.includes(techId)).length;
  const stack = [...p.technologies]
    .sort((a, b) => usage(b.id) - usage(a.id))
    .slice(0, 6)
    .map((t) => t.name);
  const rows: NeofetchRow[] = [
    { label: "role", value: id.role },
    ...(id.location ? [{ label: "location", value: id.location }] : []),
    { label: "systems", value: `${p.systems.length} (${prod} in production)` },
    { label: "capabilities", value: String(p.capabilities.length) },
    { label: "stack", value: stack.join(", ") },
    ...(id.availability ? [{ label: "status", value: id.availability, tone: "ok" as const }] : []),
    { label: "contact", value: id.links.email, tone: "link" as const, href: `mailto:${id.links.email}` },
  ];
  return { handle: handleOf(p), rows };
}

export function welcome(p: Portfolio): OutputItem[] {
  const runnable = p.systems.find((s) => s.simulation) ?? p.systems[0];
  const hints = [
    "ls",
    ...(runnable ? [`cd systems/${runnable.slug}`, `run ${runnable.slug}`] : []),
    ...(p.capabilities[0] ? [`grep -i ${p.capabilities[0].id} .`] : []),
    "man kernel",
    "help",
  ];
  return [
    { block: { kind: "neofetch" } },
    blank(),
    out(seg("try  ", "faint"), ...hints.flatMap((h, i) => [...(i ? [seg("  ·  ", "faint")] : []), seg(h, "accent", { run: h })])),
    out(seg("     or just ask: ", "faint"), seg('"what has been built with agents?"', "text", { run: "what has been built with agents?" })),
    out(
      seg("     systems: ", "faint"),
      ...p.systems.flatMap((s, i) => [...(i ? [seg("  ")] : []), seg(s.slug, "dir", { run: `cd ~/systems/${s.slug}` })]),
    ),
    blank(),
  ];
}

export function bootLines(p: Portfolio): OutputItem[] {
  const g = buildGraph(p);
  const commits = p.experience.reduce((n, e) => n + e.commits.length, 0);
  const ok = (text: string) => out(seg("[ ok ] ", "ok"), seg(text, "muted"));
  return [
    out(seg("KERNEL 1.0 (tty1)", "accent")),
    ok(`mounted ~/systems — ${p.systems.length} systems`),
    ok(`indexed skills — ${p.capabilities.length} capabilities, ${p.technologies.length} technologies`),
    ok(`linked graph — ${g.nodes.length} nodes, ${g.edges.length} edges`),
    ok(`loaded career.log — ${commits} commits`),
    blank(),
  ];
}
