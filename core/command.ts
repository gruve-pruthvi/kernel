import type { UiAction } from "./actions";
import { formatMonth, systemNumber } from "./format";
import { buildGraph, resolveNodeId } from "./graph";
import { TECH_CATEGORIES, type Portfolio, type TechCategory } from "./schema";

export type OutputKind = "text" | "muted" | "accent" | "error" | "link";
export interface OutputLine {
  kind: OutputKind;
  text: string;
  href?: string;
}
export interface ParsedCommand {
  name: string;
  args: string[];
  flags: Record<string, string | true>;
}
export interface CommandResult {
  lines: OutputLine[];
  actions: UiAction[];
  clear?: boolean;
  ask?: string;
}

export const COMMANDS = [
  { name: "help", usage: "help", description: "List available commands" },
  { name: "whoami", usage: "whoami", description: "Who is behind Kernel" },
  { name: "systems", usage: "systems [--tech <id>] [--cap <id>]", description: "List systems, optionally filtered" },
  { name: "inspect", usage: "inspect <system> [--open]", description: "Show a system's architecture" },
  { name: "graph", usage: "graph [<node>]", description: "Open the engineering graph" },
  { name: "trace", usage: "trace", description: "Recent career commits" },
  { name: "stack", usage: "stack [--<category>]", description: "Technologies by category" },
  { name: "ask", usage: 'ask "<question>"', description: "Ask Kernel's AI" },
  { name: "recruiter", usage: "recruiter [on|off]", description: "Toggle recruiter mode" },
  { name: "resume", usage: "resume", description: "Download the resume" },
  { name: "contact", usage: "contact", description: "How to get in touch" },
  { name: "clear", usage: "clear", description: "Clear the screen" },
];

const VALUE_FLAGS = new Set(["tech", "cap"]);

// Flags each command accepts; commands not listed (ask, sudo, rm) take free-form input.
const ALLOWED_FLAGS: Record<string, readonly string[]> = {
  help: [],
  whoami: [],
  systems: ["tech", "cap"],
  inspect: ["open"],
  graph: [],
  trace: [],
  stack: TECH_CATEGORIES,
  recruiter: [],
  resume: [],
  contact: [],
  clear: [],
};

const line = (text: string, kind: OutputKind = "text", href?: string): OutputLine => ({ kind, text, ...(href ? { href } : {}) });
const error = (text: string, hint?: string): CommandResult => ({
  lines: [line(text, "error"), ...(hint ? [line(hint, "muted")] : [])],
  actions: [],
});

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  let hasToken = false;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
    } else if (/\s/.test(ch)) {
      if (hasToken || current) tokens.push(current);
      current = "";
      hasToken = false;
    } else {
      current += ch;
      hasToken = true;
    }
  }
  if (hasToken || current) tokens.push(current);
  return tokens;
}

export function parseCommand(input: string): ParsedCommand | null {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return null;
  const [first, ...rest] = tokens;
  const args: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--") && token.length > 2) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq).toLowerCase()] = body.slice(eq + 1) || true;
      } else if (VALUE_FLAGS.has(body.toLowerCase()) && rest[i + 1] && !rest[i + 1].startsWith("--")) {
        flags[body.toLowerCase()] = rest[++i];
      } else {
        flags[body.toLowerCase()] = true;
      }
    } else {
      args.push(token);
    }
  }
  return { name: first.toLowerCase(), args, flags };
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function nearest(value: string, candidates: string[]): string | undefined {
  let best: { c: string; d: number } | undefined;
  for (const c of candidates) {
    const d = levenshtein(value, c);
    if (d <= 2 && (!best || d < best.d)) best = { c, d };
  }
  return best?.c;
}

export function suggest(name: string): string | undefined {
  return nearest(name.toLowerCase(), COMMANDS.map((c) => c.name));
}

function flagValue(flags: ParsedCommand["flags"], key: string): string | undefined | null {
  if (!(key in flags)) return undefined;
  const v = flags[key];
  return v === true ? null : v.toLowerCase();
}

function runSystems(cmd: ParsedCommand, p: Portfolio): CommandResult {
  const tech = flagValue(cmd.flags, "tech");
  const cap = flagValue(cmd.flags, "cap");
  if (tech === null) return error("systems: --tech needs a value", "usage: systems --tech <id>");
  if (cap === null) return error("systems: --cap needs a value", "usage: systems --cap <id>");
  if (tech && !p.technologies.some((t) => t.id === tech)) {
    return error(`systems: unknown technology "${tech}"`, "try: stack");
  }
  if (cap && !p.capabilities.some((c) => c.id === cap)) {
    return error(`systems: unknown capability "${cap}"`, `capabilities: ${p.capabilities.map((c) => c.id).join(", ")}`);
  }
  const list = p.systems.filter(
    (s) => (!tech || s.technologies.includes(tech)) && (!cap || s.capabilities.includes(cap)),
  );
  if (list.length === 0) return { lines: [line("No systems match.", "muted")], actions: [] };
  return {
    lines: [
      ...list.map((s) => line(`${systemNumber(s.number)}  ${s.name.padEnd(10)} ${s.tagline}`, "text", `/systems/${s.slug}`)),
      line("inspect <system> for details", "muted"),
    ],
    actions: [],
  };
}

function runInspect(cmd: ParsedCommand, p: Portfolio): CommandResult {
  const slug = cmd.args[0]?.toLowerCase();
  if (!slug) return error("inspect: missing system", "usage: inspect <system>");
  const s = p.systems.find((x) => x.slug === slug);
  if (!s) {
    const near = nearest(slug, p.systems.map((x) => x.slug));
    return error(`inspect: no system "${slug}"`, near ? `did you mean: ${near}?` : "try: systems");
  }
  const label = (id: string) => s.architecture.nodes.find((n) => n.id === id)?.label ?? id;
  const techNames = s.technologies.map((t) => p.technologies.find((x) => x.id === t)?.name ?? t);
  return {
    lines: [
      line(`SYSTEM / ${systemNumber(s.number)}  ${s.name.toUpperCase()}`, "accent"),
      line(s.tagline),
      line(`role   ${s.role}`, "muted"),
      line(`stack  ${techNames.join(", ")}`, "muted"),
      line(""),
      line("ARCHITECTURE", "accent"),
      ...s.architecture.edges.map((e) =>
        line(`  ${label(e.from)} ──▶ ${label(e.to)}${e.label ? `  (${e.label})` : ""}`),
      ),
      line(""),
      cmd.flags.open ? line(`Opening ${s.name}…`, "muted") : line(`inspect ${s.slug} --open to view the full case study`, "muted"),
    ],
    actions: cmd.flags.open ? [{ type: "openSystem", slug: s.slug }] : [],
  };
}

function runGraph(cmd: ParsedCommand, p: Portfolio): CommandResult {
  const target = cmd.args[0];
  if (!target) return { lines: [line("Opening graph…", "muted")], actions: [{ type: "navigate", path: "/graph" }] };
  const g = buildGraph(p);
  const id = resolveNodeId(g, target);
  if (!id) return error(`graph: no node "${target}"`, "try: stack, or systems");
  const label = g.nodes.find((n) => n.id === id)?.label ?? id;
  return { lines: [line(`Focusing ${label}…`, "muted")], actions: [{ type: "highlightGraph", ids: [id] }] };
}

function runTrace(p: Portfolio): CommandResult {
  const commits = p.experience
    .flatMap((e) => e.commits.map((c) => ({ ...c, org: e.organisation })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  return {
    lines: [
      ...commits.map((c) => line(`${c.hash}  ${c.message}  · ${c.org}, ${formatMonth(c.date)}`)),
      line("Opening trace…", "muted"),
    ],
    actions: [{ type: "navigate", path: "/trace" }],
  };
}

function runStack(cmd: ParsedCommand, p: Portfolio): CommandResult {
  const wanted = TECH_CATEGORIES.filter((c) => cmd.flags[c]);
  const categories: readonly TechCategory[] = wanted.length > 0 ? wanted : TECH_CATEGORIES;
  const lines = categories.flatMap((cat) => {
    const names = p.technologies.filter((t) => t.category === cat).map((t) => t.name);
    return names.length ? [line(`${cat.toUpperCase().padEnd(10)} ${names.join(", ")}`)] : [];
  });
  return { lines: lines.length ? lines : [line("No technologies in that category.", "muted")], actions: [] };
}

function runContact(p: Portfolio): CommandResult {
  const { links } = p.identity;
  return {
    lines: [
      line(`email     ${links.email}`, "link", `mailto:${links.email}`),
      ...(links.github ? [line(`github    ${links.github}`, "link", links.github)] : []),
      ...(links.linkedin ? [line(`linkedin  ${links.linkedin}`, "link", links.linkedin)] : []),
    ],
    actions: [{ type: "navigate", path: "/connect" }],
  };
}

export function runCommand(input: string, p: Portfolio, ctx: { recruiter: boolean }): CommandResult {
  const cmd = parseCommand(input);
  if (!cmd) return { lines: [], actions: [] };

  const allowed = ALLOWED_FLAGS[cmd.name];
  const unknownFlag = allowed && Object.keys(cmd.flags).find((f) => !allowed.includes(f));
  if (unknownFlag) {
    const usage = COMMANDS.find((c) => c.name === cmd.name)?.usage ?? cmd.name;
    return error(`${cmd.name}: unknown flag --${unknownFlag}`, `usage: ${usage}`);
  }

  switch (cmd.name) {
    case "help":
      return {
        lines: [...COMMANDS.map((c) => line(`${c.usage.padEnd(36)} ${c.description}`)), line("Tab completes · ↑↓ history · Esc closes", "muted")],
        actions: [],
      };
    case "whoami": {
      const id = p.identity;
      return {
        lines: [line(id.name, "accent"), line(id.role), line(id.tagline, "muted"), ...(id.location ? [line(id.location, "muted")] : [])],
        actions: [],
      };
    }
    case "systems":
      return runSystems(cmd, p);
    case "inspect":
      return runInspect(cmd, p);
    case "graph":
      return runGraph(cmd, p);
    case "trace":
      return runTrace(p);
    case "stack":
      return runStack(cmd, p);
    case "ask": {
      const question = cmd.args.join(" ").trim();
      if (!question) return error("ask: missing question", 'usage: ask "<question>"');
      return { lines: [line("Opening Query…", "muted")], actions: [], ask: question };
    }
    case "recruiter": {
      const arg = cmd.args[0]?.toLowerCase();
      if (arg && arg !== "on" && arg !== "off") return error(`recruiter: expected on or off, got "${arg}"`, "usage: recruiter [on|off]");
      const on = arg === "on" ? true : arg === "off" ? false : !ctx.recruiter;
      return { lines: [line(`Recruiter mode ${on ? "on" : "off"}.`, "muted")], actions: [{ type: "toggleRecruiter", on }] };
    }
    case "resume": {
      const resume = p.identity.links.resume;
      return resume
        ? { lines: [line(`resume  ${resume}`, "link", resume)], actions: [] }
        : { lines: [line("No resume published yet.", "muted")], actions: [] };
    }
    case "contact":
      return runContact(p);
    case "clear":
      return { lines: [], actions: [], clear: true };
    case "sudo":
      if (cmd.args[0]?.toLowerCase() === "hire") {
        return {
          lines: [
            line("Checking requirements…", "muted"),
            line("✓ Systems thinking"),
            line("✓ Ships to production"),
            line("✓ Writes the docs"),
            line("✓ Coffee dependency resolved"),
            line("Candidate approved. Opening contact…", "accent"),
          ],
          actions: [{ type: "navigate", path: "/connect" }],
        };
      }
      return error("sudo: only `sudo hire` is permitted here");
    case "rm":
      return cmd.args.some((a) => a.startsWith("-") && a.includes("r"))
        ? error("Permission denied. Nice try.")
        : error("rm: this filesystem is read-only");
    default: {
      const near = suggest(cmd.name);
      return error(`command not found: ${cmd.name}`, near ? `did you mean: ${near}?` : "type help for commands");
    }
  }
}

export function complete(input: string, p: Portfolio): string[] {
  const tokens = input.split(/\s+/);
  if (tokens.length <= 1) {
    const prefix = (tokens[0] ?? "").toLowerCase();
    return COMMANDS.filter((c) => c.name.startsWith(prefix)).map((c) => `${c.name} `);
  }
  const name = tokens[0].toLowerCase();
  const last = tokens[tokens.length - 1].toLowerCase();
  const head = tokens.slice(0, -1).join(" ");
  let candidates: string[] = [];
  if (name === "inspect") candidates = p.systems.map((s) => s.slug);
  else if (name === "graph") candidates = [...p.technologies.map((t) => t.id), ...p.capabilities.map((c) => c.id), ...p.systems.map((s) => s.slug)];
  else if (name === "recruiter") candidates = ["on", "off"];
  else if (name === "systems") candidates = ["--tech", "--cap"];
  else if (name === "stack") candidates = TECH_CATEGORIES.map((c) => `--${c}`);
  return candidates.filter((c) => c.startsWith(last)).map((c) => `${head} ${c}`);
}
