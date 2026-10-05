# Kernel Shell v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page a full-screen Kernel shell over a virtual filesystem generated from portfolio content, with a pure, tested command engine (navigation, files, search, man/help, history, deep links) and the existing visual pages kept as `gui` mode.

**Architecture:** `core/shell/` is pure TypeScript: `buildFs` (content → filesystem), `parser` (lexing, `;`/`|`, quotes, history expansion, per-command flag parsing), `commands/*` (each a registered module with man metadata), `execute` (pipelines → `{ output, effects, state }`), `complete`, `welcome`, `deeplink`. `components/kernel/` renders the transcript, input line, side pane and performs effects (pane, navigation, download, simulation playback, AI ask). Routes split into `app/(shell)` (home) and `app/(gui)` (visual pages with header/footer).

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Tailwind 4, Vitest 5 (existing project on branch `feat/shell-v1`).

**Spec:** `docs/superpowers/specs/2026-10-05-kernel-shell-v1-design.md`

## Global Constraints

- Project root `/Users/Pruthvi.Parade@gruve.ai/Desktop/Experiments/kernel`, branch `feat/shell-v1`. Next 16: page `params`/`searchParams` are Promises; consult `node_modules/next/dist/docs/` for any Next API not shown here.
- `core/shell/**` imports nothing from React, `next/*`, or `components/**`; no timers, fetch or DOM. All functions deterministic given inputs (time passed in as `now`).
- **No fabricated data:** every number or fact printed comes from `content/` via the portfolio object.
- Commands declare flags; unknown flags → `<cmd>: unknown flag --x` + `usage: …`, exit 1.
- Every command has `summary`, `usage`, `description` (≥ 1 line), `examples` (≥ 1), `seeAlso` (≥ 1).
- History: max 200 entries, `localStorage` key `kernel:history` (try/catch). Boot flag: `sessionStorage` key `kernel:booted`.
- Deep links: `?cmd=` max 500 chars, max 5 `;`-separated pipelines.
- Output typing stagger ≤ 20 ms/line, ≤ 400 ms per command; none under reduced motion.
- Tones map to existing CSS tokens only; no new colours.
- Commit after each task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Paths that escape or confuse the filesystem** (`cd ../../..`, `cat ~/systems/atlas/`, `ls ////`, names with spaces in quotes) → stay at root / resolve sensibly, never throw. Test: Task 1 `normalise and resolve edge cases`.
2. **Hostile or odd grep patterns** (`grep "(" .`, `grep "" .`, `grep -i ".*" .`) → no crash, no infinite loop in highlighting. Test: Task 5 `grep survives odd patterns`.
3. **History expansion inside quotes / with no history** (`echo '!!'`, `!!` on fresh shell, `!0`, `!999`) → literal inside single quotes, clear `event not found` otherwise. Test: Task 2 `history expansion edge cases`.
4. **Deep link abuse** (`?cmd=` 10 KB, 20 `;` commands, `rm -rf`) → truncated with notice, capped at 5 pipelines, unknown commands are just "not found". Test: Task 7 `deep link limits`.
5. **Pipelines mixing effects** (`open atlas | head`, `run atlas | grep x`, `clear | cat`) → effects of non-final stages discarded; no pane flicker, no simulation. Test: Task 4 `effects of non-final stages are discarded`.

---

## File Map

| Path | Responsibility |
|---|---|
| `core/shell/types.ts` | Tone, Seg, Line, OutputItem, View, Effect, ShellState, Result |
| `core/shell/fs.ts` | `buildFs`, `isDir`, `normalise`, `resolve`, `pathOf`, `walk`, `displayPath`, `nodeText`, `joinPath` |
| `core/shell/style.ts` | `inline`, `styleLine` (markdown-ish → tones) |
| `core/shell/util.ts` | `levenshtein`, `nearest`, `globToRegExp`, `escapeRegExp`, `hhmm` |
| `core/shell/parser.ts` | `lex`, `parse`, `expandHistory`, `parseFlags`, types `Word`, `Stage`, `FlagSpec`, `Flags` |
| `core/shell/registry.ts` | `Command`, `Ctx`, `CommandResult`, helpers `seg`, `out`, `fromLine`, `fail`, `plainText`, `entrySeg` |
| `core/shell/commands/{nav,text,search,info,actions}.ts` | command implementations |
| `core/shell/commands/index.ts` | `COMMANDS`, `getCommand`, `COMMAND_NAMES` |
| `core/shell/execute.ts` | `initialState`, `execute` |
| `core/shell/complete.ts` | `complete` |
| `core/shell/welcome.ts` | `neofetchData`, `welcome`, `bootLines` |
| `core/shell/deeplink.ts` | `parseDeepLink`, `deepLinkFor` |
| `components/kernel/Transcript.tsx` | `TONE`, `SegView`, `PromptText`, `Transcript`, `Neofetch` |
| `components/kernel/ViewPane.tsx` | architecture / graph / reader pane |
| `components/kernel/Shell.tsx` | stateful shell: input, keys, effects, boot, deep link |
| `app/(shell)/page.tsx` | home |
| `app/(gui)/layout.tsx` | header + recruiter summary + footer for visual pages |
| `tests/shell/*.test.ts(x)` | unit tests |

---
### Task 1: Shell types, utilities, styling and virtual filesystem

**Files:**
- Create: `core/shell/types.ts`, `core/shell/util.ts`, `core/shell/style.ts`, `core/shell/fs.ts`
- Test: `tests/shell/fs.test.ts`

**Interfaces:**
- Consumes: `Portfolio` (`core/schema`), `portfolio` (`core/content`, tests only), `formatMonth`, `formatPeriod`, `systemNumber` (`core/format`).
- Produces: types in §3 of spec (`Tone`, `Seg`, `Line`, `OutputItem`, `View`, `Effect`, `HistoryEntry`, `ShellState`, `Result`); `FsNode`, `DirNode`, `isDir`, `buildFs(p): DirNode`, `normalise(cwd: string[], path: string): string[]`, `resolve(root, cwd, path): FsNode | undefined`, `pathOf(parts): string`, `joinPath(base, name): string`, `walk(node, parts): { node; parts }[]`, `displayPath(parts, cwd): string`, `nodeText(node): string[]`; `inline(text, base?)`, `styleLine(text): Line`; `levenshtein`, `nearest(word, list, max = 2)`, `escapeRegExp`, `globToRegExp(glob)`, `hhmm(epochMs)`.

- [ ] **Step 1: Write the failing test `tests/shell/fs.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { buildFs, displayPath, isDir, joinPath, normalise, pathOf, resolve, walk } from "@/core/shell/fs";
import { styleLine } from "@/core/shell/style";
import { globToRegExp, nearest } from "@/core/shell/util";

const fs = buildFs(portfolio);
const names = (path: string) => {
  const node = resolve(fs, [], path);
  return isDir(node) ? node.children.map((c) => c.name) : [];
};

describe("buildFs", () => {
  it("lays out the top level", () => {
    expect(names("~")).toEqual(["systems", "skills", "stack", "README.md", "about.md", "career.log", "contact.txt", "resume.pdf"]);
  });

  it("creates one system directory per system with core files", () => {
    expect(names("systems")).toEqual(portfolio.systems.map((s) => s.slug));
    for (const s of portfolio.systems) {
      const files = names(`systems/${s.slug}`);
      expect(files).toEqual(expect.arrayContaining(["README.md", "architecture", "decisions.md", "stack.txt"]));
      expect(resolve(fs, [], `systems/${s.slug}`)?.kind).toBe("system");
    }
  });

  it("only creates optional files when content exists", () => {
    expect(names("systems/atlas")).toEqual(expect.arrayContaining(["tradeoffs.md", "impact.txt", "links.txt"]));
    expect(names("systems/ledger")).not.toContain("tradeoffs.md");
    expect(names("systems/ledger")).not.toContain("links.txt");
  });

  it("is driven by content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems[0].impact = undefined;
    p.identity.links.resume = undefined;
    const alt = buildFs(p);
    const sys = resolve(alt, [], `systems/${p.systems[0].slug}`);
    expect(isDir(sys) && sys.children.some((c) => c.name === "impact.txt")).toBe(false);
    expect(resolve(alt, [], "resume.pdf")).toBeUndefined();
  });

  it("has skill, stack and graph entries", () => {
    expect(names("skills")).toEqual([...portfolio.capabilities.map((c) => `${c.id}.md`), "graph"]);
    expect(names("stack")).toEqual(portfolio.technologies.map((t) => `${t.id}.txt`));
    expect(resolve(fs, [], "skills/graph")?.kind).toBe("view");
  });

  it("is memoised", () => {
    expect(buildFs(portfolio)).toBe(fs);
  });
});

describe("normalise and resolve edge cases", () => {
  it("handles relative, absolute, dot and dot-dot", () => {
    expect(normalise(["systems", "atlas"], "../relay")).toEqual(["systems", "relay"]);
    expect(normalise(["systems"], "~/skills")).toEqual(["skills"]);
    expect(normalise(["systems"], "/stack")).toEqual(["stack"]);
    expect(normalise(["systems"], "./atlas/")).toEqual(["systems", "atlas"]);
    expect(normalise(["systems"], "../../..")).toEqual([]);
    expect(normalise([], "////")).toEqual([]);
    expect(normalise(["systems"], "~")).toEqual([]);
  });

  it("resolves files, dirs and misses", () => {
    expect(resolve(fs, [], "systems/atlas/README.md")?.kind).toBe("file");
    expect(resolve(fs, ["systems"], "atlas/")?.kind).toBe("system");
    expect(resolve(fs, [], "systems/atlas/README.md/more")).toBeUndefined();
    expect(resolve(fs, [], "nope")).toBeUndefined();
    expect(resolve(fs, [], "")).toBe(fs);
  });

  it("formats paths", () => {
    expect(pathOf([])).toBe("~");
    expect(pathOf(["systems", "atlas"])).toBe("~/systems/atlas");
    expect(joinPath(".", "a")).toBe("a");
    expect(joinPath("systems/", "atlas")).toBe("systems/atlas");
    expect(displayPath(["systems", "atlas", "README.md"], ["systems"])).toBe("atlas/README.md");
    expect(displayPath(["skills", "rag.md"], ["systems"])).toBe("~/skills/rag.md");
    expect(displayPath(["systems"], ["systems"])).toBe(".");
  });

  it("walks depth-first with absolute parts", () => {
    const entries = walk(resolve(fs, [], "systems/atlas")!, ["systems", "atlas"]);
    expect(entries[0].parts).toEqual(["systems", "atlas"]);
    expect(entries.map((e) => e.parts.join("/"))).toContain("systems/atlas/README.md");
  });
});

describe("styleLine", () => {
  it("tones markdown-ish lines", () => {
    expect(styleLine("# Atlas")).toEqual([{ text: "Atlas", tone: "heading" }]);
    expect(styleLine("## Role")[0].tone).toBe("accent");
    expect(styleLine("- item")[0]).toEqual({ text: "› ", tone: "accent" });
    expect(styleLine("● chosen")[0].tone).toBe("accent");
    expect(styleLine("○ rejected")[0].tone).toBe("faint");
    expect(styleLine("→ because")[0].tone).toBe("ok");
    expect(styleLine("a **b** c").map((s) => s.tone)).toEqual(["text", "accent", "text"]);
  });
});

describe("util", () => {
  it("nearest and glob", () => {
    expect(nearest("sl", ["ls", "cd"])).toBe("ls");
    expect(nearest("zzzz", ["ls"])).toBeUndefined();
    expect(globToRegExp("*.md").test("README.md")).toBe(true);
    expect(globToRegExp("*.md").test("stack.txt")).toBe(false);
    expect(globToRegExp("a?las").test("atlas")).toBe(true);
    expect(globToRegExp("(x)").test("(x)")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/fs.test.ts`
Expected: FAIL — cannot resolve `@/core/shell/fs`.

- [ ] **Step 3: Create `core/shell/types.ts`**

```ts
export type Tone =
  | "text"
  | "muted"
  | "faint"
  | "accent"
  | "error"
  | "ok"
  | "dir"
  | "view"
  | "link"
  | "warn"
  | "heading"
  | "match";

/** One styled run of text. `run` is a command executed on click; `href` is a link. */
export interface Seg {
  text: string;
  tone?: Tone;
  run?: string;
  href?: string;
}

export type Line = Seg[];
export type Block = { kind: "neofetch" };
export type OutputItem = { line: Line } | { block: Block };

export type View =
  | { type: "architecture"; slug: string }
  | { type: "graph"; focus: string[] }
  | { type: "reader"; path: string[] };

export type Effect =
  | { type: "openView"; view: View }
  | { type: "closeView" }
  | { type: "navigate"; href: string }
  | { type: "download"; href: string }
  | { type: "simulate"; slug: string }
  | { type: "ask"; question: string }
  | { type: "clear" }
  | { type: "recruiter"; on: boolean };

export interface HistoryEntry {
  command: string;
  at: number;
}

export interface ShellState {
  cwd: string[];
  prevCwd: string[];
  history: HistoryEntry[];
  sessionStart: number;
}

export interface Result {
  output: OutputItem[];
  effects: Effect[];
  state: ShellState;
  exitCode: 0 | 1;
}
```

- [ ] **Step 4: Create `core/shell/util.ts`**

```ts
export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function nearest(word: string, list: string[], max = 2): string | undefined {
  let best: { value: string; d: number } | undefined;
  for (const value of list) {
    const d = levenshtein(word.toLowerCase(), value.toLowerCase());
    if (d <= max && (!best || d < best.d)) best = { value, d };
  }
  return best?.value;
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function globToRegExp(glob: string): RegExp {
  const body = glob
    .split("")
    .map((ch) => (ch === "*" ? ".*" : ch === "?" ? "." : escapeRegExp(ch)))
    .join("");
  return new RegExp(`^${body}$`);
}

export function hhmm(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

- [ ] **Step 5: Create `core/shell/style.ts`**

```ts
import type { Line, Seg, Tone } from "./types";

export function inline(text: string, base: Tone = "text"): Seg[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  if (parts.length === 0) return [{ text: "", tone: base }];
  return parts.map((p) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? { text: p.slice(2, -2), tone: "accent" } : { text: p, tone: base }));
}

const PREFIXES: [string, Tone][] = [
  ["● ", "accent"],
  ["○ ", "faint"],
  ["→ ", "ok"],
  ["+ ", "ok"],
  ["− ", "warn"],
];

export function styleLine(text: string): Line {
  if (text.startsWith("# ")) return [{ text: text.slice(2), tone: "heading" }];
  if (text.startsWith("## ")) return [{ text: text.slice(3), tone: "accent" }];
  const bullet = /^(\s*)[-*] (.*)$/.exec(text);
  if (bullet) return [{ text: `${bullet[1]}› `, tone: "accent" }, ...inline(bullet[2])];
  const trimmed = text.trimStart();
  for (const [prefix, tone] of PREFIXES) {
    if (trimmed.startsWith(prefix)) return [{ text, tone }];
  }
  return inline(text);
}
```

- [ ] **Step 6: Create `core/shell/fs.ts`**

```ts
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
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/shell/fs.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add virtual filesystem, styling and shell types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Parser — lexing, pipelines, history expansion, flags

**Files:**
- Create: `core/shell/parser.ts`
- Test: `tests/shell/parser.test.ts`

**Interfaces:**
- Produces:
  - `interface Word { value: string; quoted: boolean }`
  - `type Token = { type: "word"; word: Word } | { type: "pipe" } | { type: "semi" }`
  - `lex(input: string): Token[]`
  - `interface Stage { name: string; argv: Word[] }`
  - `parse(input: string): { ok: true; pipelines: Stage[][] } | { ok: false; error: string }`
  - `expandHistory(input: string, history: string[]): { ok: true; line: string; expanded: boolean } | { ok: false; error: string }`
  - `interface FlagDef { short?: string; value?: boolean; singleDash?: boolean; placeholder?: string; describe: string }`, `type FlagSpec = Record<string, FlagDef>`, `type Flags = Record<string, string | true>`
  - `parseFlags(argv: Word[], spec?: FlagSpec): { ok: true; args: string[]; flags: Flags } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test `tests/shell/parser.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { expandHistory, lex, parse, parseFlags, type FlagSpec, type Word } from "@/core/shell/parser";

const w = (...values: string[]): Word[] => values.map((value) => ({ value, quoted: false }));
const words = (input: string) => lex(input).map((t) => (t.type === "word" ? t.word.value : t.type));

describe("lex", () => {
  it("splits words, quotes, escapes and operators", () => {
    expect(words(`grep -i "agent orchestration" . | head -n 3; ls`)).toEqual([
      "grep", "-i", "agent orchestration", ".", "pipe", "head", "-n", "3", "semi", "ls",
    ]);
    expect(words(`echo 'a | b' c\\ d ""`)).toEqual(["echo", "a | b", "c d", ""]);
    expect(words(`echo "unterminated`)).toEqual(["echo", "unterminated"]);
    expect(lex(`"-x"`)[0]).toEqual({ type: "word", word: { value: "-x", quoted: true } });
  });
});

describe("parse", () => {
  it("builds pipelines and stages", () => {
    const r = parse("ls systems | grep atlas; pwd");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pipelines.map((p) => p.map((s) => s.name))).toEqual([["ls", "grep"], ["pwd"]]);
    expect(r.pipelines[0][0].argv.map((a) => a.value)).toEqual(["systems"]);
  });

  it("skips empty commands and rejects broken pipes", () => {
    const r = parse("ls;; ;pwd;");
    expect(r.ok && r.pipelines.length).toBe(2);
    expect(parse("ls |").ok).toBe(false);
    expect(parse("| ls").ok).toBe(false);
    expect(parse("ls | | grep x").ok).toBe(false);
    expect(parse("   ").ok && (parse("   ") as { pipelines: unknown[] }).pipelines.length).toBe(0);
  });
});

describe("history expansion edge cases", () => {
  const history = ["ls", "cd systems", "cat README.md"];
  it("expands !! and !N", () => {
    expect(expandHistory("!!", history)).toEqual({ ok: true, line: "cat README.md", expanded: true });
    expect(expandHistory("sudo !!", history)).toEqual({ ok: true, line: "sudo cat README.md", expanded: true });
    expect(expandHistory("!2", history)).toEqual({ ok: true, line: "cd systems", expanded: true });
    expect(expandHistory("ls", history)).toEqual({ ok: true, line: "ls", expanded: false });
  });

  it("errors on missing events and keeps single-quoted text literal", () => {
    expect(expandHistory("!!", [])).toEqual({ ok: false, error: "!!: event not found" });
    expect(expandHistory("!0", history)).toEqual({ ok: false, error: "!0: event not found" });
    expect(expandHistory("!999", history)).toEqual({ ok: false, error: "!999: event not found" });
    expect(expandHistory("echo '!!'", history)).toEqual({ ok: true, line: "echo '!!'", expanded: false });
    expect(expandHistory("echo hi!", history)).toEqual({ ok: true, line: "echo hi!", expanded: false });
  });
});

describe("parseFlags", () => {
  const spec: FlagSpec = {
    ignoreCase: { short: "i", describe: "" },
    lineNumber: { short: "n", describe: "" },
    lines: { short: "N", value: true, describe: "" },
    name: { value: true, singleDash: true, describe: "" },
  };

  it("parses long, short, combined, valued and single-dash flags", () => {
    expect(parseFlags(w("--ignoreCase", "x"), spec)).toEqual({ ok: true, args: ["x"], flags: { ignoreCase: true } });
    expect(parseFlags(w("-in", "x"), spec)).toEqual({ ok: true, args: ["x"], flags: { ignoreCase: true, lineNumber: true } });
    expect(parseFlags(w("-N", "5"), spec)).toEqual({ ok: true, args: [], flags: { lines: "5" } });
    expect(parseFlags(w("-N5"), spec)).toEqual({ ok: true, args: [], flags: { lines: "5" } });
    expect(parseFlags(w("--lines=7"), spec)).toEqual({ ok: true, args: [], flags: { lines: "7" } });
    expect(parseFlags(w("-name", "*.md"), spec)).toEqual({ ok: true, args: [], flags: { name: "*.md" } });
    expect(parseFlags(w("--", "-i"), spec)).toEqual({ ok: true, args: ["-i"], flags: {} });
    expect(parseFlags([{ value: "-i", quoted: true }], spec)).toEqual({ ok: true, args: ["-i"], flags: {} });
    expect(parseFlags(w("-", "-5"), spec)).toEqual({ ok: true, args: ["-", "-5"], flags: {} });
  });

  it("rejects unknown flags and missing values", () => {
    expect(parseFlags(w("--bogus"), spec)).toEqual({ ok: false, error: "unknown flag --bogus" });
    expect(parseFlags(w("-z"), spec)).toEqual({ ok: false, error: "unknown flag -z" });
    expect(parseFlags(w("-N"), spec)).toEqual({ ok: false, error: "-N needs a value" });
    expect(parseFlags(w("--lines"), spec)).toEqual({ ok: false, error: "--lines needs a value" });
    expect(parseFlags(w("--ignoreCase=yes"), spec)).toEqual({ ok: false, error: "--ignoreCase takes no value" });
    expect(parseFlags(w("-x"))).toEqual({ ok: false, error: "unknown flag -x" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `core/shell/parser.ts`**

```ts
export interface Word {
  value: string;
  quoted: boolean;
}

export type Token = { type: "word"; word: Word } | { type: "pipe" } | { type: "semi" };

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let quoted = false;
  let started = false;
  let quote: '"' | "'" | null = null;

  const flush = () => {
    if (started) tokens.push({ type: "word", word: { value: current, quoted } });
    current = "";
    quoted = false;
    started = false;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < input.length) current += input[++i];
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      quoted = true;
      started = true;
    } else if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      started = true;
    } else if (/\s/.test(ch)) {
      flush();
    } else if (ch === "|" || ch === ";") {
      flush();
      tokens.push({ type: ch === "|" ? "pipe" : "semi" });
    } else {
      current += ch;
      started = true;
    }
  }
  flush();
  return tokens;
}

export interface Stage {
  name: string;
  argv: Word[];
}

export function parse(input: string): { ok: true; pipelines: Stage[][] } | { ok: false; error: string } {
  const lists: Token[][] = [[]];
  for (const t of lex(input)) {
    if (t.type === "semi") lists.push([]);
    else lists[lists.length - 1].push(t);
  }

  const pipelines: Stage[][] = [];
  for (const list of lists) {
    const stages: Word[][] = [[]];
    for (const t of list) {
      if (t.type === "pipe") stages.push([]);
      else if (t.type === "word") stages[stages.length - 1].push(t.word);
    }
    if (stages.length === 1 && stages[0].length === 0) continue;
    if (stages.some((s) => s.length === 0)) return { ok: false, error: "syntax error near unexpected token '|'" };
    pipelines.push(stages.map((ws) => ({ name: ws[0].value, argv: ws.slice(1) })));
  }
  return { ok: true, pipelines };
}

export function expandHistory(
  input: string,
  history: string[],
): { ok: true; line: string; expanded: boolean } | { ok: false; error: string } {
  let out = "";
  let inSingle = false;
  let expanded = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") inSingle = !inSingle;
    if (ch !== "!" || inSingle) {
      out += ch;
      continue;
    }
    if (input[i + 1] === "!") {
      const last = history[history.length - 1];
      if (last === undefined) return { ok: false, error: "!!: event not found" };
      out += last;
      expanded = true;
      i++;
      continue;
    }
    const digits = /^\d+/.exec(input.slice(i + 1));
    if (digits) {
      const n = Number(digits[0]);
      const entry = n >= 1 ? history[n - 1] : undefined;
      if (entry === undefined) return { ok: false, error: `!${digits[0]}: event not found` };
      out += entry;
      expanded = true;
      i += digits[0].length;
      continue;
    }
    out += ch;
  }
  return { ok: true, line: out, expanded };
}

export interface FlagDef {
  short?: string;
  value?: boolean;
  singleDash?: boolean;
  placeholder?: string;
  describe: string;
}
export type FlagSpec = Record<string, FlagDef>;
export type Flags = Record<string, string | true>;

export function parseFlags(
  argv: Word[],
  spec: FlagSpec = {},
): { ok: true; args: string[]; flags: Flags } | { ok: false; error: string } {
  const args: string[] = [];
  const flags: Flags = {};
  const entries = Object.entries(spec);

  for (let i = 0; i < argv.length; i++) {
    const { value: v, quoted } = argv[i];
    if (quoted || v === "-" || !v.startsWith("-") || /^-\d/.test(v)) {
      args.push(v);
      continue;
    }
    if (v === "--") {
      args.push(...argv.slice(i + 1).map((a) => a.value));
      break;
    }
    if (v.startsWith("--")) {
      const body = v.slice(2);
      const eq = body.indexOf("=");
      const name = eq >= 0 ? body.slice(0, eq) : body;
      const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined;
      const def = spec[name];
      if (!def) return { ok: false, error: `unknown flag --${name}` };
      if (def.value) {
        const val = inlineValue ?? argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `--${name} needs a value` };
        flags[name] = val;
      } else {
        if (inlineValue !== undefined) return { ok: false, error: `--${name} takes no value` };
        flags[name] = true;
      }
      continue;
    }
    const long = entries.find(([name, def]) => def.singleDash && `-${name}` === v);
    if (long) {
      const [name, def] = long;
      if (def.value) {
        const val = argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `-${name} needs a value` };
        flags[name] = val;
      } else flags[name] = true;
      continue;
    }
    const cluster = v.slice(1);
    for (let j = 0; j < cluster.length; j++) {
      const c = cluster[j];
      const entry = entries.find(([, def]) => def.short === c);
      if (!entry) return { ok: false, error: `unknown flag -${c}` };
      const [name, def] = entry;
      if (def.value) {
        const val = cluster.slice(j + 1) || argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `-${c} needs a value` };
        flags[name] = val;
        break;
      }
      flags[name] = true;
    }
  }
  return { ok: true, args, flags };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/shell/parser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/shell/parser.ts tests/shell/parser.test.ts
git commit -m "feat(shell): add parser with pipelines, history expansion and flags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Registry, executor and navigation commands (`ls`, `cd`, `pwd`, `tree`)

**Files:**
- Create: `core/shell/registry.ts`, `core/shell/commands/nav.ts`, `core/shell/commands/index.ts`, `core/shell/execute.ts`
- Test: `tests/shell/helpers.ts`, `tests/shell/nav.test.ts`

**Interfaces:**
- Consumes: Task 1 (`fs`, `style`, `util`, `types`), Task 2 (`parse`, `expandHistory`, `parseFlags`, `FlagSpec`, `Flags`).
- Produces:
  - `registry.ts`: `interface Ctx { p: Portfolio; fs: DirNode; state: ShellState; stdin: string[] | null; now: number; commands: Command[] }`, `interface CommandResult { output?: OutputItem[]; effects?: Effect[]; state?: Partial<ShellState>; exitCode?: 0 | 1 }`, `type Group = "navigation" | "files" | "search" | "info" | "actions"`, `interface Command { name; aliases?; group; summary; usage; description: string[]; flags?: FlagSpec; examples: string[]; seeAlso: string[]; run(args: string[], flags: Flags, ctx: Ctx): CommandResult }`, helpers `seg(text, tone?, extra?)`, `out(...parts)`, `fromLine(line)`, `blank()`, `fail(message, hint?)`, `plainText(items)`, `entrySeg(node, path)`.
  - `commands/index.ts`: `COMMANDS: Command[]`, `getCommand(name): Command | undefined`, `commandNames(): string[]`.
  - `execute.ts`: `HISTORY_LIMIT = 200`, `initialState(now: number, history?: HistoryEntry[]): ShellState`, `execute(input: string, state: ShellState, p: Portfolio, now?: number, opts?: { maxPipelines?: number }): Result`.
  - `tests/shell/helpers.ts`: `run(input, cwd?)` → `{ text: string; res: Result }`, `seq(...inputs)` → final `Result`.

- [ ] **Step 1: Create test helper `tests/shell/helpers.ts`**

```ts
import { portfolio } from "@/core/content";
import { execute, initialState } from "@/core/shell/execute";
import type { OutputItem, Result, ShellState } from "@/core/shell/types";

export const NOW = 1_760_000_000_000;

export function textOf(items: OutputItem[]): string {
  return items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : "[neofetch]")).join("\n");
}

export function run(input: string, cwd: string[] = [], state?: ShellState) {
  const res = execute(input, state ?? { ...initialState(NOW), cwd }, portfolio, NOW);
  return { res, text: textOf(res.output) };
}

export function seq(...inputs: string[]): Result {
  let state = initialState(NOW);
  let res: Result | undefined;
  for (const input of inputs) {
    res = execute(input, state, portfolio, NOW);
    state = res.state;
  }
  return res!;
}
```

- [ ] **Step 2: Write the failing test `tests/shell/nav.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { run, seq } from "./helpers";

describe("ls", () => {
  it("lists the root with clickable entries", () => {
    const { res, text } = run("ls");
    expect(text).toContain("systems/");
    expect(text).toContain("README.md");
    const segs = "line" in res.output[0] ? res.output[0].line : [];
    expect(segs.find((s) => s.text === "systems/")).toMatchObject({ tone: "dir", run: "cd systems" });
    expect(segs.find((s) => s.text === "README.md")).toMatchObject({ run: "cat README.md" });
    expect(segs.find((s) => s.text === "resume.pdf@")).toMatchObject({ tone: "link", href: portfolio.identity.links.resume });
  });

  it("lists a path, a system and a view", () => {
    expect(run("ls systems").text).toContain("atlas/");
    const atlas = run("ls systems/atlas");
    expect(atlas.text).toContain("architecture*");
    const segs = "line" in atlas.res.output[0] ? atlas.res.output[0].line : [];
    expect(segs.find((s) => s.text === "architecture*")).toMatchObject({ tone: "view", run: "open systems/atlas/architecture" });
  });

  it("supports -l and multiple paths", () => {
    expect(run("ls -l systems").text).toMatch(/s\s+\d+\s+atlas\//);
    const both = run("ls skills stack").text;
    expect(both).toContain("skills:");
    expect(both).toContain("stack:");
  });

  it("errors on missing paths and unknown flags", () => {
    const missing = run("ls nope");
    expect(missing.text).toBe("ls: cannot access 'nope': No such file or directory");
    expect(missing.res.exitCode).toBe(1);
    const bad = run("ls --bogus");
    expect(bad.text).toBe("ls: unknown flag --bogus\nusage: ls [-l] [path…]");
  });
});

describe("cd / pwd", () => {
  it("changes directory and prints it", () => {
    expect(seq("cd systems/atlas", "pwd").output).toEqual([{ line: [{ text: "~/systems/atlas", tone: "dir" }] }]);
    expect(seq("cd systems", "cd atlas", "cd ..", "pwd").state.cwd).toEqual(["systems"]);
    expect(seq("cd systems", "cd").state.cwd).toEqual([]);
  });

  it("supports cd - and errors", () => {
    const back = seq("cd systems", "cd ~/skills", "cd -");
    expect(back.state.cwd).toEqual(["systems"]);
    expect(run("cd nope").text).toBe("cd: no such file or directory: nope");
    expect(run("cd README.md").text).toBe("cd: not a directory: README.md");
    expect(run("cd a b").text).toBe("cd: too many arguments");
  });
});

describe("tree", () => {
  it("draws a depth-limited tree with a summary", () => {
    const { text } = run("tree -L 1");
    expect(text.split("\n")[0]).toBe("~");
    expect(text).toContain("├── systems/");
    expect(text).not.toContain("atlas/");
    expect(text).toMatch(/\d+ directories, \d+ files$/);
    expect(run("tree systems").text).toContain("│   ├── README.md");
    expect(run("tree -L 0").text).toBe("tree: -L needs a positive whole number");
  });
});

describe("executor", () => {
  it("records history and ignores blank input", () => {
    const res = seq("ls", "pwd", "pwd");
    expect(res.state.history.map((h) => h.command)).toEqual(["ls", "pwd"]);
    expect(run("   ").res.output).toEqual([]);
  });

  it("suggests the nearest command and offers plain English", () => {
    const { text, res } = run("sl");
    expect(text).toContain("kernel: command not found: sl");
    expect(text).toContain("did you mean ls");
    expect(res.exitCode).toBe(1);
  });

  it("routes plain-English input to ask", () => {
    expect(run("what has been built with agents").res.effects).toEqual([
      { type: "ask", question: "what has been built with agents" },
    ]);
    expect(run("hello?").res.effects).toEqual([{ type: "ask", question: "hello?" }]);
    expect(run("rm -rf /").res.effects).toEqual([]);
    expect(run("rm -rf /").text).toContain("command not found: rm");
  });

  it("runs ; lists in order and reports syntax errors", () => {
    expect(run("cd systems; pwd").text).toBe("~/systems");
    expect(run("ls |").text).toBe("kernel: syntax error near unexpected token '|'");
  });

  it("expands history and echoes the expansion", () => {
    const res = seq("pwd", "!!");
    expect(res.output[0]).toEqual({ line: [{ text: "pwd", tone: "faint" }] });
    expect(res.state.history.at(-1)?.command).toBe("pwd");
  });

  it("caps pipelines when asked", async () => {
    const { execute, initialState } = await import("@/core/shell/execute");
    const res = execute("pwd; pwd; pwd", initialState(0), portfolio, 0, { maxPipelines: 2 });
    expect(res.output.filter((o) => "line" in o && o.line[0]?.text === "~")).toHaveLength(2);
    expect(JSON.stringify(res.output)).toContain("skipped 1 more command");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/shell/nav.test.ts`
Expected: FAIL — cannot resolve `@/core/shell/execute`.

- [ ] **Step 4: Create `core/shell/registry.ts`**

```ts
import type { Portfolio } from "../schema";
import type { DirNode, FsNode } from "./fs";
import type { FlagSpec, Flags } from "./parser";
import type { Effect, Line, OutputItem, Seg, ShellState, Tone } from "./types";

export interface Ctx {
  p: Portfolio;
  fs: DirNode;
  state: ShellState;
  stdin: string[] | null;
  now: number;
  commands: Command[];
}

export interface CommandResult {
  output?: OutputItem[];
  effects?: Effect[];
  state?: Partial<ShellState>;
  exitCode?: 0 | 1;
}

export type Group = "navigation" | "files" | "search" | "info" | "actions";

export interface Command {
  name: string;
  aliases?: string[];
  group: Group;
  summary: string;
  usage: string;
  description: string[];
  flags?: FlagSpec;
  examples: string[];
  seeAlso: string[];
  run(args: string[], flags: Flags, ctx: Ctx): CommandResult;
}

export const seg = (text: string, tone?: Tone, extra: Partial<Seg> = {}): Seg => ({ text, ...(tone ? { tone } : {}), ...extra });
export const out = (...parts: (Seg | string)[]): OutputItem => ({ line: parts.map((p) => (typeof p === "string" ? seg(p) : p)) });
export const fromLine = (line: Line): OutputItem => ({ line });
export const blank = (): OutputItem => ({ line: [] });

export function fail(message: string, hint?: Seg[] | string): CommandResult {
  const extra = hint === undefined ? [] : [typeof hint === "string" ? out(seg(hint, "faint")) : fromLine(hint)];
  return { output: [out(seg(message, "error")), ...extra], exitCode: 1 };
}

export const plainText = (items: OutputItem[]): string[] =>
  items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : ""));

/** Clickable segment for a filesystem entry; `path` is what the user would type. */
export function entrySeg(node: FsNode, path: string): Seg {
  switch (node.kind) {
    case "dir":
    case "system":
      return seg(`${node.name}/`, "dir", { run: `cd ${path}` });
    case "view":
      return seg(`${node.name}*`, "view", { run: `open ${path}` });
    case "link":
      return seg(`${node.name}@`, "link", { href: node.href });
    case "file":
      return seg(node.name, "text", { run: `cat ${path}` });
  }
}
```

- [ ] **Step 5: Create `core/shell/commands/nav.ts`**

```ts
import { isDir, joinPath, normalise, pathOf, resolve, type DirNode, type FsNode } from "../fs";
import { blank, entrySeg, fail, out, seg, type Command } from "../registry";
import type { OutputItem } from "../types";

const KIND: Record<FsNode["kind"], string> = { dir: "d", system: "s", file: "-", view: "v", link: "l" };
const size = (n: FsNode) => (isDir(n) ? n.children.length : n.kind === "file" ? n.lines.length : 0);

const ls: Command = {
  name: "ls",
  group: "navigation",
  summary: "list directory contents",
  usage: "ls [-l] [path…]",
  description: [
    "Lists files and directories. Directories end in /, views (open in the side pane) end in *, links end in @.",
    "Everything listed is clickable.",
  ],
  flags: { long: { short: "l", describe: "long format: kind, size (entries or lines), name" } },
  examples: ["ls", "ls systems", "ls -l systems/atlas"],
  seeAlso: ["cd", "tree", "find"],
  run(args, flags, ctx) {
    const targets = args.length ? args : ["."];
    const output: OutputItem[] = [];
    let exitCode: 0 | 1 = 0;
    targets.forEach((t, idx) => {
      const node = resolve(ctx.fs, ctx.state.cwd, t);
      if (!node) {
        output.push(out(seg(`ls: cannot access '${t}': No such file or directory`, "error")));
        exitCode = 1;
        return;
      }
      if (targets.length > 1) {
        if (idx > 0) output.push(blank());
        output.push(out(seg(`${t}:`, "faint")));
      }
      if (!isDir(node)) {
        output.push(out(entrySeg(node, t)));
        return;
      }
      if (flags.long) {
        for (const c of node.children) {
          output.push(out(seg(`${KIND[c.kind]}  ${String(size(c)).padStart(4)}  `, "faint"), entrySeg(c, joinPath(t, c.name))));
        }
      } else {
        output.push({ line: node.children.flatMap((c, i) => [...(i ? [seg("   ")] : []), entrySeg(c, joinPath(t, c.name))]) });
      }
    });
    return { output, exitCode };
  },
};

const cd: Command = {
  name: "cd",
  group: "navigation",
  summary: "change the working directory",
  usage: "cd [path | -]",
  description: ["Moves into a directory. With no path, returns home (~). `cd -` returns to the previous directory."],
  examples: ["cd systems/atlas", "cd ..", "cd -"],
  seeAlso: ["ls", "pwd"],
  run(args, _flags, ctx) {
    if (args.length > 1) return fail("cd: too many arguments");
    const target = args[0] ?? "~";
    if (target === "-") {
      return { state: { cwd: ctx.state.prevCwd, prevCwd: ctx.state.cwd }, output: [out(seg(pathOf(ctx.state.prevCwd), "dir"))] };
    }
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`cd: no such file or directory: ${target}`);
    if (!isDir(node)) return fail(`cd: not a directory: ${target}`);
    return { state: { cwd: normalise(ctx.state.cwd, target), prevCwd: ctx.state.cwd } };
  },
};

const pwd: Command = {
  name: "pwd",
  group: "navigation",
  summary: "print the working directory",
  usage: "pwd",
  description: ["Prints where you are in the filesystem."],
  examples: ["pwd"],
  seeAlso: ["cd"],
  run(_args, _flags, ctx) {
    return { output: [out(seg(pathOf(ctx.state.cwd), "dir"))] };
  },
};

const tree: Command = {
  name: "tree",
  group: "navigation",
  summary: "show the filesystem as a tree",
  usage: "tree [-L n] [path]",
  description: ["Draws the directory structure. This is the whole portfolio's information architecture."],
  flags: { level: { short: "L", value: true, placeholder: "n", describe: "descend at most n levels" } },
  examples: ["tree", "tree -L 1", "tree systems/atlas"],
  seeAlso: ["ls", "find"],
  run(args, flags, ctx) {
    const level = flags.level === undefined ? Infinity : Number(flags.level);
    if (!(level === Infinity || (Number.isInteger(level) && level >= 1))) return fail("tree: -L needs a positive whole number");
    const target = args[0] ?? ".";
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`tree: ${target}: No such file or directory`);
    if (!isDir(node)) return { output: [out(entrySeg(node, target))] };

    const output: OutputItem[] = [out(seg(target === "." ? pathOf(ctx.state.cwd) : target, "dir"))];
    let dirs = 0;
    let files = 0;
    const draw = (d: DirNode, prefix: string, depth: number, base: string) => {
      d.children.forEach((c, i) => {
        const last = i === d.children.length - 1;
        const path = joinPath(base, c.name);
        output.push(out(seg(prefix + (last ? "└── " : "├── "), "faint"), entrySeg(c, path)));
        if (isDir(c)) {
          dirs++;
          if (depth < level) draw(c, prefix + (last ? "    " : "│   "), depth + 1, path);
        } else files++;
      });
    };
    draw(node, "", 1, target);
    output.push(blank(), out(seg(`${dirs} directories, ${files} files`, "faint")));
    return { output };
  },
};

export const navCommands = [ls, cd, pwd, tree];
```

- [ ] **Step 6: Create `core/shell/commands/index.ts`**

```ts
import type { Command } from "../registry";
import { navCommands } from "./nav";

export const COMMANDS: Command[] = [...navCommands];

export function getCommand(name: string): Command | undefined {
  const n = name.toLowerCase();
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export const commandNames = (): string[] => COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
```

- [ ] **Step 7: Create `core/shell/execute.ts`**

```ts
import type { Portfolio } from "../schema";
import { COMMANDS, commandNames, getCommand } from "./commands";
import { buildFs } from "./fs";
import { expandHistory, parse, parseFlags } from "./parser";
import { out, plainText, seg } from "./registry";
import type { Effect, HistoryEntry, OutputItem, Result, ShellState } from "./types";
import { nearest } from "./util";

export const HISTORY_LIMIT = 200;

export function initialState(now: number, history: HistoryEntry[] = []): ShellState {
  return { cwd: [], prevCwd: [], history: history.slice(-HISTORY_LIMIT), sessionStart: now };
}

export function execute(
  input: string,
  state: ShellState,
  p: Portfolio,
  now = Date.now(),
  opts: { maxPipelines?: number } = {},
): Result {
  const trimmed = input.trim();
  if (!trimmed) return { output: [], effects: [], state, exitCode: 0 };

  const expansion = expandHistory(trimmed, state.history.map((h) => h.command));
  if (!expansion.ok) return { output: [out(seg(`kernel: ${expansion.error}`, "error"))], effects: [], state, exitCode: 1 };
  const line = expansion.line;

  const last = state.history[state.history.length - 1]?.command;
  let st: ShellState = {
    ...state,
    history: last === line ? state.history : [...state.history, { command: line, at: now }].slice(-HISTORY_LIMIT),
  };
  const output: OutputItem[] = expansion.expanded ? [out(seg(line, "faint"))] : [];
  const effects: Effect[] = [];

  const parsed = parse(line);
  if (!parsed.ok) return { output: [...output, out(seg(`kernel: ${parsed.error}`, "error"))], effects, state: st, exitCode: 1 };

  let pipelines = parsed.pipelines;
  let skipped = 0;
  if (opts.maxPipelines && pipelines.length > opts.maxPipelines) {
    skipped = pipelines.length - opts.maxPipelines;
    pipelines = pipelines.slice(0, opts.maxPipelines);
  }

  // Plain English goes to the AI: an unknown first word followed by prose-like words, or anything ending in "?".
  const single = pipelines.length === 1 && pipelines[0].length === 1 ? pipelines[0][0] : undefined;
  const prose = (st: typeof single) =>
    Boolean(st) && /^[a-z']+$/i.test(st!.name) && st!.argv.length > 0 && st!.argv.every((a) => !a.value.startsWith("-"));
  if (single && !getCommand(single.name) && (prose(single) || /\?$/.test(line))) {
    return { output, effects: [{ type: "ask", question: line }], state: st, exitCode: 0 };
  }

  const fs = buildFs(p);
  let exitCode: 0 | 1 = 0;

  for (const pipeline of pipelines) {
    let stdin: string[] | null = null;
    for (let i = 0; i < pipeline.length; i++) {
      const stage = pipeline[i];
      const isLast = i === pipeline.length - 1;
      const cmd = getCommand(stage.name);
      if (!cmd) {
        const near = nearest(stage.name, commandNames());
        output.push(
          out(seg(`kernel: command not found: ${stage.name}`, "error")),
          out(
            ...(near ? [seg("did you mean ", "faint"), seg(near, "accent", { run: near }), seg(" · ", "faint")] : []),
            seg("or ask in plain English", "faint"),
          ),
        );
        exitCode = 1;
        break;
      }
      const flags = parseFlags(stage.argv, cmd.flags);
      if (!flags.ok) {
        output.push(out(seg(`${cmd.name}: ${flags.error}`, "error")), out(seg(`usage: ${cmd.usage}`, "faint")));
        exitCode = 1;
        break;
      }
      const res = cmd.run(flags.args, flags.flags, { p, fs, state: st, stdin, now, commands: COMMANDS });
      if (res.state) st = { ...st, ...res.state };
      exitCode = res.exitCode ?? 0;
      if (isLast) {
        output.push(...(res.output ?? []));
        effects.push(...(res.effects ?? []));
      } else if (exitCode !== 0) {
        output.push(...(res.output ?? []));
        break;
      } else {
        stdin = plainText(res.output ?? []);
      }
    }
  }

  if (skipped) output.push(out(seg(`kernel: skipped ${skipped} more command${skipped === 1 ? "" : "s"} (limit ${opts.maxPipelines})`, "faint")));
  return { output, effects, state: st, exitCode };
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS (fs, parser, nav).

- [ ] **Step 9: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add command registry, executor and navigation commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: File commands (`cat`, `less`, `head`, `tail`, `wc`, `echo`) and pipes

**Files:**
- Create: `core/shell/commands/text.ts`
- Modify: `core/shell/commands/index.ts`
- Test: `tests/shell/text.test.ts`

**Interfaces:**
- Consumes: registry helpers, `resolve`, `isDir`, `normalise`, `styleLine`.
- Produces: `textCommands: Command[]`; helpers exported for later tasks: `readFile(ctx, path, name): { lines: string[] } | { error: CommandResult }`, `readSource(args, ctx, name, usage)`.

- [ ] **Step 1: Write the failing test `tests/shell/text.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { buildFs, resolve } from "@/core/shell/fs";
import { run } from "./helpers";

const lines = (path: string) => {
  const n = resolve(buildFs(portfolio), [], path);
  return n?.kind === "file" ? n.lines : [];
};

describe("cat", () => {
  it("prints styled files", () => {
    const { res, text } = run("cat README.md");
    expect(text).toContain(portfolio.identity.name);
    expect(res.output[0]).toEqual({ line: [{ text: portfolio.identity.name, tone: "heading" }] });
  });

  it("concatenates multiple files and reports misses", () => {
    const { text, res } = run("cat contact.txt nope");
    expect(text).toContain(portfolio.identity.links.email);
    expect(text).toContain("cat: nope: No such file or directory");
    expect(res.exitCode).toBe(1);
  });

  it("explains directories, views and links", () => {
    expect(run("cat systems").text).toBe("cat: systems: Is a directory\ntry ls systems");
    expect(run("cat systems/atlas/architecture").res.effects).toEqual([
      { type: "openView", view: { type: "architecture", slug: "atlas" } },
    ]);
    const pdf = run("cat resume.pdf").res.output[0];
    expect("line" in pdf && pdf.line.some((s) => s.href === portfolio.identity.links.resume)).toBe(true);
    expect(run("cat").text).toBe("cat: missing file operand\nusage: cat <file…>");
  });
});

describe("less", () => {
  it("opens the reader pane", () => {
    expect(run("less README.md", ["systems", "atlas"]).res.effects).toEqual([
      { type: "openView", view: { type: "reader", path: ["systems", "atlas", "README.md"] } },
    ]);
    expect(run("less systems").text).toBe("less: systems: Is a directory\ntry ls systems");
    expect(run("less").text).toBe("less: missing file operand\nusage: less <file>");
  });
});

describe("head / tail / wc / echo", () => {
  it("slices files", () => {
    expect(run("head -n 2 README.md").res.output).toHaveLength(2);
    expect(run("head README.md").res.output).toHaveLength(Math.min(10, lines("README.md").length));
    expect(run("tail -n 1 contact.txt").text).toBe(lines("contact.txt").at(-1));
    expect(run("tail -n 0 contact.txt").res.output).toEqual([]);
    expect(run("head -n x README.md").text).toBe("head: -n needs a whole number");
    expect(run("head").text).toBe("head: missing file operand\nusage: head [-n N] [file]");
  });

  it("counts", () => {
    expect(run("wc -l README.md").text).toBe(`${lines("README.md").length} README.md`);
    expect(run("wc README.md").text).toMatch(/^\s*\d+\s+\d+\s+\d+ README\.md$/);
  });

  it("echoes", () => {
    expect(run(`echo hello   "big world"`).text).toBe("hello big world");
  });
});

describe("pipes", () => {
  it("feeds plain text between stages", () => {
    expect(run("cat README.md | head -n 1").text).toBe(portfolio.identity.name);
    expect(run("cat contact.txt | wc -l").text).toBe(String(lines("contact.txt").length));
    expect(run("echo a | cat").text).toBe("a");
  });

  it("effects of non-final stages are discarded", () => {
    const { res } = run("cat systems/atlas/architecture | head -n 1");
    expect(res.effects).toEqual([]);
    expect(res.output).toHaveLength(1);
  });

  it("stops the pipeline on a failing stage", () => {
    const { text, res } = run("cat nope | head");
    expect(text).toBe("cat: nope: No such file or directory");
    expect(res.exitCode).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/text.test.ts`
Expected: FAIL — `cat` not found (tests fail on output assertions).

- [ ] **Step 3: Create `core/shell/commands/text.ts`**

```ts
import { isDir, normalise, resolve } from "../fs";
import { fail, fromLine, out, seg, type Command, type CommandResult, type Ctx } from "../registry";
import { styleLine } from "../style";
import type { Effect, OutputItem } from "../types";

type Read = { lines: string[] } | { error: CommandResult };

export function readFile(ctx: Ctx, path: string, name: string): Read {
  const node = resolve(ctx.fs, ctx.state.cwd, path);
  if (!node) return { error: fail(`${name}: ${path}: No such file or directory`) };
  if (isDir(node)) return { error: fail(`${name}: ${path}: Is a directory`, [seg("try ", "faint"), seg(`ls ${path}`, "accent", { run: `ls ${path}` })]) };
  if (node.kind === "view") return { error: fail(`${name}: ${path}: is a view`, [seg("try ", "faint"), seg(`open ${path}`, "accent", { run: `open ${path}` })]) };
  if (node.kind === "link") return { error: fail(`${name}: ${path}: binary file`, [seg("try ", "faint"), seg(`open ${path}`, "accent", { run: `open ${path}` })]) };
  return { lines: node.lines };
}

export function readSource(args: string[], ctx: Ctx, name: string, usage: string): Read {
  if (args[0]) return readFile(ctx, args[0], name);
  if (ctx.stdin) return { lines: ctx.stdin };
  return { error: fail(`${name}: missing file operand`, `usage: ${usage}`) };
}

const styled = (lines: string[]): OutputItem[] => lines.map((l) => fromLine(styleLine(l)));

const cat: Command = {
  name: "cat",
  group: "files",
  summary: "print files",
  usage: "cat <file…>",
  description: ["Prints one or more files. Reads from a pipe when given no file. Views open in the side pane."],
  examples: ["cat README.md", "cat systems/atlas/decisions.md", "cat about.md contact.txt"],
  seeAlso: ["less", "head", "grep"],
  run(args, _flags, ctx) {
    if (args.length === 0) {
      if (ctx.stdin) return { output: styled(ctx.stdin) };
      return fail("cat: missing file operand", `usage: ${this.usage}`);
    }
    const output: OutputItem[] = [];
    const effects: Effect[] = [];
    let exitCode: 0 | 1 = 0;
    for (const path of args) {
      const node = resolve(ctx.fs, ctx.state.cwd, path);
      if (node?.kind === "view") {
        effects.push({ type: "openView", view: node.view });
        output.push(out(seg(`opened ${path} in the view pane →`, "faint")));
      } else if (node?.kind === "link") {
        output.push(out(seg(`${node.name}  `), seg("download ↗", "link", { href: node.href })));
      } else {
        const r = readFile(ctx, path, "cat");
        if ("error" in r) {
          output.push(...(r.error.output ?? []));
          exitCode = 1;
        } else output.push(...styled(r.lines));
      }
    }
    return { output, effects, exitCode };
  },
};

const less: Command = {
  name: "less",
  group: "files",
  summary: "read a file in the side pane",
  usage: "less <file>",
  description: ["Opens a file in a scrollable reader beside the shell. Press Esc or q to close it."],
  examples: ["less README.md", "less systems/atlas/decisions.md"],
  seeAlso: ["cat", "open"],
  run(args, _flags, ctx) {
    if (args.length !== 1) return fail("less: missing file operand", `usage: ${this.usage}`);
    const [path] = args;
    const node = resolve(ctx.fs, ctx.state.cwd, path);
    if (node?.kind === "view") return { effects: [{ type: "openView", view: node.view }] };
    const r = readFile(ctx, path, "less");
    if ("error" in r) return r.error;
    return {
      effects: [{ type: "openView", view: { type: "reader", path: normalise(ctx.state.cwd, path) } }],
      output: [out(seg(`${path} — reading in the side pane (Esc closes)`, "faint"))],
    };
  },
};

function slice(name: "head" | "tail"): Command {
  return {
    name,
    group: "files",
    summary: name === "head" ? "first lines of a file" : "last lines of a file",
    usage: `${name} [-n N] [file]`,
    description: [`Prints the ${name === "head" ? "first" : "last"} N lines (default 10) of a file or of piped input.`],
    flags: { lines: { short: "n", value: true, placeholder: "N", describe: "number of lines" } },
    examples: [`${name} -n 5 README.md`, `grep -i agent . | ${name} -n 3`],
    seeAlso: [name === "head" ? "tail" : "head", "cat", "wc"],
    run(args, flags, ctx) {
      const n = flags.lines === undefined ? 10 : Number(flags.lines);
      if (!Number.isInteger(n) || n < 0) return fail(`${name}: -n needs a whole number`);
      const r = readSource(args, ctx, name, `${name} [-n N] [file]`);
      if ("error" in r) return r.error;
      const picked = name === "head" ? r.lines.slice(0, n) : n === 0 ? [] : r.lines.slice(-n);
      return { output: styled(picked) };
    },
  };
}

const wc: Command = {
  name: "wc",
  group: "files",
  summary: "count lines, words and characters",
  usage: "wc [-l] [file]",
  description: ["Counts lines, words and characters of a file or piped input."],
  flags: { lines: { short: "l", describe: "only count lines" } },
  examples: ["wc README.md", "grep -l rag . | wc -l"],
  seeAlso: ["head", "grep"],
  run(args, flags, ctx) {
    const r = readSource(args, ctx, "wc", this.usage);
    if ("error" in r) return r.error;
    const l = r.lines.length;
    const words = r.lines.join(" ").split(/\s+/).filter(Boolean).length;
    const chars = r.lines.join("\n").length;
    const suffix = args[0] ? ` ${args[0]}` : "";
    const counts = flags.lines ? `${l}` : `${String(l).padStart(4)} ${String(words).padStart(5)} ${String(chars).padStart(6)}`;
    return { output: [out(counts + suffix)] };
  },
};

const echo: Command = {
  name: "echo",
  group: "files",
  summary: "print text",
  usage: "echo <text…>",
  description: ["Prints its arguments separated by single spaces."],
  examples: ["echo hello kernel"],
  seeAlso: ["cat"],
  run(args) {
    return { output: [out(args.join(" "))] };
  },
};

export const textCommands = [cat, less, slice("head"), slice("tail"), wc, echo];
```

- [ ] **Step 4: Register in `core/shell/commands/index.ts`** — replace the imports/`COMMANDS` lines with:

```ts
import type { Command } from "../registry";
import { navCommands } from "./nav";
import { textCommands } from "./text";

export const COMMANDS: Command[] = [...navCommands, ...textCommands];
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add file commands and pipes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Search commands (`grep`, `find`, `which`, `whereis`)

**Files:**
- Create: `core/shell/commands/search.ts`
- Modify: `core/shell/commands/index.ts`
- Test: `tests/shell/search.test.ts`

**Interfaces:**
- Consumes: `walk`, `displayPath`, `normalise`, `resolve`, `isDir`, `nodeText`, `pathOf`, `joinPath`; `globToRegExp`, `escapeRegExp`; registry helpers; `entrySeg`.
- Produces: `searchCommands: Command[]`; `highlight(text: string, re: RegExp): Seg[]` (exported for tests).

- [ ] **Step 1: Write the failing test `tests/shell/search.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { highlight } from "@/core/shell/commands/search";
import { run } from "./helpers";

describe("grep", () => {
  it("searches recursively with path:line:text and highlights", () => {
    const { res, text } = run("grep -n Hybrid systems");
    expect(text).toMatch(/^systems\/atlas\/decisions\.md:\d+:/m);
    const first = res.output[0];
    expect("line" in first && first.line.some((s) => s.tone === "match" && s.text === "Hybrid")).toBe(true);
    expect("line" in first && first.line[0]).toMatchObject({ tone: "link", run: expect.stringMatching(/^less /) });
  });

  it("supports -i, -l, -v and defaults to the cwd", () => {
    expect(run("grep -il hybrid").text).toContain("systems/atlas/README.md");
    expect(run("grep -il hybrid").text.split("\n").every((l) => !l.includes(":"))).toBe(true);
    expect(run("grep -i hybrid", ["systems"]).text).toMatch(/^atlas\//m);
    expect(run("grep -v e contact.txt").text).not.toContain("email");
  });

  it("filters stdin", () => {
    expect(run("cat contact.txt | grep email").text).toMatch(/^email/);
  });

  it("returns exit 1 with no matches and errors on missing paths", () => {
    const none = run("grep zzzzqqq .");
    expect(none.res.exitCode).toBe(1);
    expect(none.res.output).toEqual([]);
    expect(run("grep x nope").text).toBe("grep: nope: No such file or directory");
    expect(run("grep").text).toBe("grep: missing pattern\nusage: grep [-i] [-n] [-l] [-v] <pattern> [path…]");
  });

  it("grep survives odd patterns", () => {
    expect(() => run(`grep "(" .`)).not.toThrow();
    expect(run(`grep "(" README.md`).res.exitCode).toBe(1);
    expect(() => run(`grep "" README.md`)).not.toThrow();
    expect(() => run(`grep -i ".*" .`)).not.toThrow();
    expect(highlight("abc", /x*/g)).toEqual([{ text: "abc" }]);
  });
});

describe("find", () => {
  it("filters by name glob and type", () => {
    const md = run("find . -name *.md").text.split("\n");
    expect(md).toContain("systems/atlas/README.md");
    expect(md.every((l) => l.endsWith(".md"))).toBe(true);
    const sys = run("find systems -type system").text.split("\n");
    expect(sys).toEqual(["systems/atlas", "systems/relay", "systems/beacon", "systems/ledger"]);
    expect(run("find -type view").text.split("\n")).toContain("skills/graph");
  });

  it("validates input", () => {
    expect(run("find -type x").text).toBe("find: -type must be one of f, d, view, system, link");
    expect(run("find nope").text).toBe("find: nope: No such file or directory");
  });
});

describe("which / whereis", () => {
  it("locates commands and entities", () => {
    expect(run("which ls").text).toBe("ls: shell builtin");
    expect(run("which atlas").text).toBe("~/systems/atlas");
    expect(run("which rag").text).toBe("~/skills/rag.md");
    expect(run("which kafka").text).toBe("~/stack/kafka.txt");
    const miss = run("which nope");
    expect(miss.text).toBe("which: no nope in kernel");
    expect(miss.res.exitCode).toBe(1);
  });

  it("finds every file mentioning a term", () => {
    const { text } = run("whereis kafka");
    expect(text.split("\n")[0]).toBe("kafka:");
    expect(text).toContain("~/stack/kafka.txt");
    expect(text).toContain("~/systems/ledger/stack.txt");
    expect(run("whereis zzzzqqq").text).toBe('whereis: nothing mentions "zzzzqqq"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/search.test.ts`
Expected: FAIL — cannot import `@/core/shell/commands/search`.

- [ ] **Step 3: Create `core/shell/commands/search.ts`**

```ts
import { displayPath, isDir, joinPath, nodeText, normalise, pathOf, resolve, walk, type FsNode } from "../fs";
import { entrySeg, fail, out, seg, type Command } from "../registry";
import type { OutputItem, Seg } from "../types";
import { escapeRegExp, globToRegExp } from "../util";

function toRegExp(pattern: string, ignoreCase: boolean): RegExp {
  const flags = ignoreCase ? "gi" : "g";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return new RegExp(escapeRegExp(pattern), flags);
  }
}

export function highlight(text: string, re: RegExp): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))) {
    if (m[0] === "") continue;
    const at = m.index ?? 0;
    if (at > last) segs.push({ text: text.slice(last, at) });
    segs.push({ text: m[0], tone: "match" });
    last = at + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

const grep: Command = {
  name: "grep",
  group: "search",
  summary: "search file contents",
  usage: "grep [-i] [-n] [-l] [-v] <pattern> [path…]",
  description: [
    "Searches files for a pattern (a regular expression; invalid expressions are matched literally).",
    "Directories are searched recursively. With no path it searches piped input, or the current directory.",
  ],
  flags: {
    ignoreCase: { short: "i", describe: "ignore case" },
    lineNumber: { short: "n", describe: "show line numbers" },
    filesOnly: { short: "l", describe: "only list matching files" },
    invert: { short: "v", describe: "show non-matching lines" },
    recursive: { short: "r", describe: "accepted for familiarity; directories are always searched" },
  },
  examples: ["grep -i rag .", "grep -n Hybrid systems", "cat career.log | grep feat"],
  seeAlso: ["find", "whereis", "head"],
  run(args, flags, ctx) {
    const [pattern, ...paths] = args;
    if (pattern === undefined) return fail("grep: missing pattern", `usage: ${this.usage}`);
    const re = toRegExp(pattern, Boolean(flags.ignoreCase));
    const test = (line: string) => {
      re.lastIndex = 0;
      const hit = re.test(line);
      return flags.invert ? !hit : hit;
    };
    const render = (line: string): Seg[] => (flags.invert ? [{ text: line }] : highlight(line, re));
    const output: OutputItem[] = [];
    let matched = false;

    if (paths.length === 0 && ctx.stdin) {
      ctx.stdin.forEach((line, i) => {
        if (!test(line)) return;
        matched = true;
        output.push(out(...(flags.lineNumber ? [seg(String(i + 1), "ok"), seg(":", "faint")] : []), ...render(line)));
      });
      return { output, exitCode: matched ? 0 : 1 };
    }

    let exitCode: 0 | 1 = 0;
    for (const target of paths.length ? paths : ["."]) {
      const node = resolve(ctx.fs, ctx.state.cwd, target);
      if (!node) {
        output.push(out(seg(`grep: ${target}: No such file or directory`, "error")));
        exitCode = 1;
        continue;
      }
      for (const { node: f, parts } of walk(node, normalise(ctx.state.cwd, target))) {
        if (f.kind !== "file") continue;
        const hits = f.lines.map((line, i) => ({ line, i })).filter(({ line }) => test(line));
        if (hits.length === 0) continue;
        matched = true;
        const shown = displayPath(parts, ctx.state.cwd);
        const pathSeg = seg(shown, "link", { run: `less ${shown}` });
        if (flags.filesOnly) {
          output.push(out(pathSeg));
          continue;
        }
        for (const { line, i } of hits) {
          output.push(out(pathSeg, seg(":", "faint"), ...(flags.lineNumber ? [seg(String(i + 1), "ok"), seg(":", "faint")] : []), ...render(line)));
        }
      }
    }
    return { output, exitCode: matched && exitCode === 0 ? 0 : 1 };
  },
};

const TYPES: Record<string, (n: FsNode) => boolean> = {
  f: (n) => n.kind === "file",
  d: (n) => isDir(n),
  view: (n) => n.kind === "view",
  system: (n) => n.kind === "system",
  link: (n) => n.kind === "link",
};

const find: Command = {
  name: "find",
  group: "search",
  summary: "find files by name or kind",
  usage: "find [path] [-name glob] [-type f|d|view|system|link]",
  description: ["Walks the filesystem from a path (default .) and lists entries matching a name glob (* and ?) and/or a kind."],
  flags: {
    name: { value: true, singleDash: true, placeholder: "glob", describe: "match entry names, e.g. *.md" },
    type: { value: true, singleDash: true, placeholder: "kind", describe: "f, d, view, system or link" },
  },
  examples: ["find . -name *.md", "find systems -type system", "find -type view"],
  seeAlso: ["grep", "tree", "whereis"],
  run(args, flags, ctx) {
    const kind = flags.type as string | undefined;
    if (kind !== undefined && !TYPES[kind]) return fail("find: -type must be one of f, d, view, system, link");
    const target = args[0] ?? ".";
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`find: ${target}: No such file or directory`);
    const glob = typeof flags.name === "string" ? globToRegExp(flags.name) : null;
    const base = normalise(ctx.state.cwd, target);
    const output = walk(node, base)
      .filter(({ node: n }) => (!glob || glob.test(n.name)) && (!kind || TYPES[kind](n)))
      .map(({ node: n, parts }) => {
        const rel = parts.slice(base.length).join("/");
        const shown = rel ? joinPath(target, rel) : target;
        const click = entrySeg(n, shown);
        return out({ ...click, text: shown });
      });
    return { output, exitCode: output.length ? 0 : 1 };
  },
};

const which: Command = {
  name: "which",
  group: "search",
  summary: "locate a command, system, skill or technology",
  usage: "which <name…>",
  description: ["Shows whether a name is a builtin command, or where a system, capability or technology lives."],
  examples: ["which atlas", "which rag", "which grep"],
  seeAlso: ["whereis", "find"],
  run(args, _flags, ctx) {
    if (args.length === 0) return fail("which: missing name", `usage: ${this.usage}`);
    const output: OutputItem[] = [];
    let exitCode: 0 | 1 = 0;
    for (const name of args) {
      const n = name.toLowerCase();
      if (ctx.commands.some((c) => c.name === n || c.aliases?.includes(n))) output.push(out(`${n}: shell builtin`));
      else if (ctx.p.systems.some((s) => s.slug === n)) output.push(out(seg(`~/systems/${n}`, "dir", { run: `cd ~/systems/${n}` })));
      else if (ctx.p.capabilities.some((c) => c.id === n)) output.push(out(seg(`~/skills/${n}.md`, "text", { run: `cat ~/skills/${n}.md` })));
      else if (ctx.p.technologies.some((t) => t.id === n)) output.push(out(seg(`~/stack/${n}.txt`, "text", { run: `cat ~/stack/${n}.txt` })));
      else {
        output.push(out(seg(`which: no ${name} in kernel`, "error")));
        exitCode = 1;
      }
    }
    return { output, exitCode };
  },
};

const whereis: Command = {
  name: "whereis",
  group: "search",
  summary: "every file that mentions a term",
  usage: "whereis <term>",
  description: ["Lists every path whose name or content mentions the term (case-insensitive), with a count of matching lines."],
  examples: ["whereis kafka", "whereis agent"],
  seeAlso: ["grep", "which"],
  run(args, _flags, ctx) {
    const term = args.join(" ").toLowerCase();
    if (!term) return fail("whereis: missing term", `usage: ${this.usage}`);
    const hits = walk(ctx.fs, [])
      .slice(1)
      .map(({ node, parts }) => ({
        node,
        parts,
        count: nodeText(node).filter((l) => l.toLowerCase().includes(term)).length,
        named: node.name.toLowerCase().includes(term),
      }))
      .filter((h) => h.named || h.count > 0);
    if (hits.length === 0) return fail(`whereis: nothing mentions "${args.join(" ")}"`);
    return {
      output: [
        out(seg(`${args.join(" ")}:`, "accent")),
        ...hits.map((h) => {
          const path = pathOf(h.parts);
          const click = entrySeg(h.node, path);
          return out(seg("  "), { ...click, text: path }, ...(h.count ? [seg(`  (${h.count} line${h.count === 1 ? "" : "s"})`, "faint")] : []));
        }),
      ],
    };
  },
};

export const searchCommands = [grep, find, which, whereis];
```

- [ ] **Step 4: Register in `core/shell/commands/index.ts`** — add `import { searchCommands } from "./search";` and change the array to `[...navCommands, ...textCommands, ...searchCommands]`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add grep, find, which and whereis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Info commands (`man`, `help`, `history`, `whoami`, `id`, `resume`, `export`) and welcome screen

**Files:**
- Create: `core/shell/welcome.ts`, `core/shell/commands/info.ts`, `core/shell/deeplink.ts`
- Modify: `core/shell/commands/index.ts`
- Test: `tests/shell/info.test.ts`

**Interfaces:**
- Consumes: registry, fs, `buildGraph` (`core/graph`), `getCommits`-equivalent via `p.experience`, `hhmm`, `nearest`.
- Produces:
  - `welcome.ts`: `interface NeofetchRow { label: string; value: string; tone?: Tone; href?: string }`, `handleOf(p): string`, `neofetchData(p): { handle: string; rows: NeofetchRow[] }`, `welcome(p): OutputItem[]`, `bootLines(p): OutputItem[]`.
  - `deeplink.ts`: `DEEP_LINK_MAX = 500`, `parseDeepLink(search: string): { line: string | null; truncated: boolean }`, `deepLinkFor(command: string): string`.
  - `infoCommands: Command[]`.

- [ ] **Step 1: Write the failing test `tests/shell/info.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { COMMANDS } from "@/core/shell/commands";
import { deepLinkFor, parseDeepLink } from "@/core/shell/deeplink";
import { execute, initialState } from "@/core/shell/execute";
import { handleOf, neofetchData, welcome } from "@/core/shell/welcome";
import { NOW, run, seq, textOf } from "./helpers";

describe("man", () => {
  it("every command has a complete manual", () => {
    for (const c of COMMANDS) {
      const page = run(`man ${c.name}`).text;
      for (const section of ["NAME", "SYNOPSIS", "DESCRIPTION", "EXAMPLES", "SEE ALSO"]) expect(page, c.name).toContain(section);
      expect(page.includes("OPTIONS"), c.name).toBe(Boolean(c.flags && Object.keys(c.flags).length));
      expect(c.examples.length, c.name).toBeGreaterThan(0);
      expect(c.seeAlso.length, c.name).toBeGreaterThan(0);
    }
  });

  it("generates system and kernel pages", () => {
    const atlas = run("man atlas").text;
    expect(atlas).toContain("ATLAS(7)");
    expect(atlas).toContain(portfolio.systems[0].tagline);
    expect(atlas).toContain("run atlas");
    const kernel = run("man kernel").text;
    for (const c of COMMANDS) expect(kernel).toContain(c.name);
  });

  it("handles missing topics", () => {
    expect(run("man").text).toBe("What manual page do you want?\ntry man kernel");
    expect(run("man nope").text.split("\n")[0]).toBe("No manual entry for nope");
    expect(run("man gerp").text).toContain("grep");
  });
});

describe("help", () => {
  it("lists groups and topics", () => {
    const text = run("help").text;
    for (const g of ["NAVIGATION", "FILES", "SEARCH", "INFO"]) expect(text).toContain(g);
    expect(run("help shortcuts").text).toContain("Ctrl+R");
    expect(run("help links").text).toContain("/?cmd=");
    expect(run("help nope").text).toBe("help: no topic nope\ntopics: navigation, search, shortcuts, links");
  });
});

describe("history", () => {
  it("numbers entries and links them", () => {
    const res = seq("ls", "pwd", "history");
    expect(textOf(res.output)).toBe("   1  ls  ↗\n   2  pwd  ↗\n   3  history  ↗");
    const first = res.output[0];
    expect("line" in first && first.line.find((s) => s.href)?.href).toBe("/?cmd=ls");
    expect("line" in first && first.line.find((s) => s.run)?.run).toBe("ls");
  });

  it("filters to this session with timestamps", () => {
    const state = { ...initialState(NOW, [{ command: "old", at: NOW - 86_400_000 }]) };
    const res = execute("history --session", state, portfolio, NOW);
    const text = textOf(res.output);
    expect(text).not.toContain("old");
    expect(text).toMatch(/^\s+2 {2}\d\d:\d\d {2}history/);
  });
});

describe("whoami / id / resume / export", () => {
  it("whoami renders the neofetch block", () => {
    expect(run("whoami").res.output).toEqual([{ block: { kind: "neofetch" } }]);
  });

  it("neofetch data is derived from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = p.systems.slice(0, 2);
    const rows = Object.fromEntries(neofetchData(p).rows.map((r) => [r.label, r.value]));
    const prod = p.systems.filter((s) => s.status === "production").length;
    expect(rows.systems).toBe(`2 (${prod} in production)`);
    expect(rows.capabilities).toBe(String(p.capabilities.length));
    expect(neofetchData(portfolio).handle).toBe(handleOf(portfolio));
  });

  it("id lists capabilities as groups", () => {
    expect(run("id").text).toBe(`uid=${handleOf(portfolio)} groups=${portfolio.capabilities.map((c) => c.id).join(",")}`);
  });

  it("resume summarises from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems[0].impact = [{ label: "fewer pages", value: "+999%" }];
    const text = textOf(execute("resume", initialState(0), p, 0).output);
    expect(text).toContain(p.identity.name);
    expect(text).toContain("+999% fewer pages");
    for (const s of p.systems.filter((x) => x.featured).slice(0, 3)) expect(text).toContain(s.name);
    expect(text).toContain(p.identity.links.email);
  });

  it("export downloads the resume", () => {
    expect(run("export resume.pdf").res.effects).toEqual([{ type: "download", href: portfolio.identity.links.resume }]);
    expect(run("export cv.doc").text).toBe('export: unknown target "cv.doc"\nusage: export resume.pdf');
    const p: Portfolio = structuredClone(portfolio);
    p.identity.links.resume = undefined;
    expect(textOf(execute("export resume.pdf", initialState(0), p, 0).output)).toBe("export: no resume published");
  });
});

describe("welcome and deep links", () => {
  it("welcome shows neofetch, hints and system names", () => {
    const items = welcome(portfolio);
    expect(items[0]).toEqual({ block: { kind: "neofetch" } });
    const text = textOf(items);
    for (const s of portfolio.systems) expect(text).toContain(s.slug);
    expect(text).toContain("man kernel");
  });

  it("deep link limits", () => {
    expect(parseDeepLink("?cmd=man%20atlas")).toEqual({ line: "man atlas", truncated: false });
    expect(parseDeepLink("")).toEqual({ line: null, truncated: false });
    expect(parseDeepLink("?cmd=%20%20")).toEqual({ line: null, truncated: false });
    const long = parseDeepLink(`?cmd=${"a".repeat(10_000)}`);
    expect(long.truncated).toBe(true);
    expect(long.line).toHaveLength(500);
    expect(deepLinkFor("grep -i rag .")).toBe("/?cmd=grep%20-i%20rag%20.");
    const many = execute(Array(20).fill("pwd").join(";"), initialState(0), portfolio, 0, { maxPipelines: 5 });
    expect(many.output.filter((o) => "line" in o && o.line[0]?.text === "~")).toHaveLength(5);
    expect(textOf(execute("rm -rf /", initialState(0), portfolio, 0).output)).toContain("command not found: rm");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/info.test.ts`
Expected: FAIL — cannot resolve `@/core/shell/deeplink`.

- [ ] **Step 3: Create `core/shell/deeplink.ts`**

```ts
export const DEEP_LINK_MAX = 500;

export function parseDeepLink(search: string): { line: string | null; truncated: boolean } {
  const value = new URLSearchParams(search).get("cmd")?.trim();
  if (!value) return { line: null, truncated: false };
  return value.length > DEEP_LINK_MAX ? { line: value.slice(0, DEEP_LINK_MAX), truncated: true } : { line: value, truncated: false };
}

export const deepLinkFor = (command: string) => `/?cmd=${encodeURIComponent(command)}`;
```

- [ ] **Step 4: Create `core/shell/welcome.ts`**

```ts
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
```

- [ ] **Step 5: Create `core/shell/commands/info.ts`**

```ts
import { getRelatedSystemsFrom } from "./related";
import { deepLinkFor } from "../deeplink";
import { isDir, resolve } from "../fs";
import { blank, fail, fromLine, out, seg, type Command, type Ctx, type Group } from "../registry";
import type { OutputItem, Seg } from "../types";
import { hhmm, nearest } from "../util";
import { handleOf } from "../welcome";

const INDENT = "       ";
const h = (title: string) => out(seg(title, "heading"));
const body = (content: string | Seg[]) => (typeof content === "string" ? out(INDENT + content) : fromLine([seg(INDENT), ...content]));
const links = (names: string[], prefix: string) =>
  names.flatMap((n, i) => [...(i ? [seg(", ", "faint")] : []), seg(n, "link", { run: `${prefix}${n}` })]);

function commandPage(c: Command): OutputItem[] {
  const flags = Object.entries(c.flags ?? {});
  return [
    out(seg(`${c.name.toUpperCase()}(1)`, "accent"), seg("    Kernel Manual", "faint")),
    blank(),
    h("NAME"),
    body(`${c.name} — ${c.summary}`),
    blank(),
    h("SYNOPSIS"),
    body(c.usage),
    blank(),
    h("DESCRIPTION"),
    ...c.description.map((d) => body(d)),
    ...(flags.length
      ? [
          blank(),
          h("OPTIONS"),
          ...flags.map(([name, d]) =>
            body([
              seg(`${d.short ? `-${d.short}, ` : ""}${d.singleDash ? "-" : "--"}${name}${d.value ? ` <${d.placeholder ?? "value"}>` : ""}`, "accent"),
              seg(`   ${d.describe}`, "muted"),
            ]),
          ),
        ]
      : []),
    blank(),
    h("EXAMPLES"),
    ...c.examples.map((e) => body([seg(e, "accent", { run: e })])),
    blank(),
    h("SEE ALSO"),
    body(links(c.seeAlso, "man ")),
  ];
}

function systemPage(ctx: Ctx, slug: string): OutputItem[] {
  const s = ctx.p.systems.find((x) => x.slug === slug)!;
  const tech = (id: string) => ctx.p.technologies.find((t) => t.id === id)?.name ?? id;
  const dir = resolve(ctx.fs, [], `systems/${slug}`);
  const files = isDir(dir) ? dir.children.map((c) => c.name) : [];
  const related = getRelatedSystemsFrom(ctx.p, slug);
  const synopsis = [`cd ~/systems/${slug}`, ...(s.simulation ? [`run ${slug}`] : []), `open ${slug}`, `less ~/systems/${slug}/README.md`];
  return [
    out(seg(`${slug.toUpperCase()}(7)`, "accent"), seg("    Kernel Systems Manual", "faint")),
    blank(),
    h("NAME"),
    body(`${slug} — ${s.tagline}`),
    blank(),
    h("SYNOPSIS"),
    ...synopsis.map((cmd) => body([seg(cmd, "accent", { run: cmd })])),
    blank(),
    h("DESCRIPTION"),
    body(s.summary),
    body(s.problem),
    blank(),
    h("ROLE"),
    body(s.role),
    blank(),
    h("STACK"),
    body(s.technologies.map(tech).join(", ")),
    blank(),
    h("FILES"),
    ...files.map((f) => body([seg(`~/systems/${slug}/${f}`, "text", { run: f === "architecture" ? `open ${slug}` : `cat ~/systems/${slug}/${f}` })])),
    blank(),
    h("SEE ALSO"),
    body(related.length ? links(related, "man ") : [seg("man kernel", "link", { run: "man kernel" })]),
  ];
}

const GROUP_ORDER: Group[] = ["navigation", "files", "search", "info", "actions"];

function kernelPage(ctx: Ctx): OutputItem[] {
  return [
    out(seg("KERNEL(1)", "accent"), seg("    Kernel Manual", "faint")),
    blank(),
    h("NAME"),
    body("kernel — a portfolio operating system"),
    blank(),
    h("DESCRIPTION"),
    body("Every system, skill, technology and role is a file in this filesystem. Explore it like a shell —"),
    body("or type a question in plain English. Everything underlined is clickable."),
    blank(),
    h("COMMANDS"),
    ...GROUP_ORDER.flatMap((g) => {
      const cmds = ctx.commands.filter((c) => c.group === g);
      return cmds.length
        ? [body([seg(g.toUpperCase(), "faint")]), ...cmds.map((c) => body([seg(c.name.padEnd(10), "accent", { run: `man ${c.name}` }), seg(c.summary, "muted")]))]
        : [];
    }),
    blank(),
    h("FILES"),
    body("~/systems/<name>/   README.md · architecture · decisions.md · stack.txt …"),
    body("~/skills/           capabilities and the skill graph"),
    body("~/stack/            technologies"),
    body("~/career.log        experience · ~/about.md · ~/contact.txt"),
    blank(),
    h("SEE ALSO"),
    body(links(["help", ...ctx.p.systems.map((s) => s.slug)], "man ").map((x) => (x.run === "man help" ? { ...x, run: "help" } : x))),
  ];
}

const man: Command = {
  name: "man",
  group: "info",
  summary: "read the manual",
  usage: "man <command | system | kernel>",
  description: ["Shows the manual for a command, a system (generated from its content), or `man kernel` for the overview."],
  examples: ["man kernel", "man grep", "man atlas"],
  seeAlso: ["help", "kernel"],
  run(args, _flags, ctx) {
    const topic = args[0]?.toLowerCase();
    if (!topic) return fail("What manual page do you want?", [seg("try ", "faint"), seg("man kernel", "accent", { run: "man kernel" })]);
    if (topic === "kernel") return { output: kernelPage(ctx) };
    const cmd = ctx.commands.find((c) => c.name === topic || c.aliases?.includes(topic));
    if (cmd) return { output: commandPage(cmd) };
    if (ctx.p.systems.some((s) => s.slug === topic)) return { output: systemPage(ctx, topic) };
    const near = nearest(topic, [...ctx.commands.map((c) => c.name), ...ctx.p.systems.map((s) => s.slug), "kernel"]);
    return fail(`No manual entry for ${topic}`, near ? [seg("did you mean ", "faint"), seg(`man ${near}`, "accent", { run: `man ${near}` })] : "try man kernel");
  },
};

const TOPICS: Record<string, OutputItem[]> = {
  navigation: [
    h("NAVIGATION"),
    body([seg("ls [path]", "accent"), seg("      list a directory (click entries to open them)", "muted")]),
    body([seg("cd <path>", "accent"), seg("      move; cd .. up, cd - back, cd ~ home", "muted")]),
    body([seg("tree -L 2", "accent"), seg("      the whole structure", "muted")]),
    body([seg("pwd", "accent"), seg("            where am I", "muted")]),
  ],
  search: [
    h("SEARCH"),
    body([seg("grep -i rag .", "accent"), seg("           search every file", "muted")]),
    body([seg("find . -name *.md", "accent"), seg("       find by name or -type", "muted")]),
    body([seg("whereis kafka", "accent"), seg("           every file mentioning a term", "muted")]),
    body([seg("grep -i agent . | head -n 5", "accent"), seg(" pipes work", "muted")]),
  ],
  shortcuts: [
    h("SHORTCUTS"),
    body("Tab          complete · → or End accepts the grey suggestion"),
    body("↑ ↓          history · !! last command · !N command N"),
    body("Ctrl+R       search history"),
    body("Ctrl+A / E   start / end of line · Ctrl+U clear to start · Ctrl+W delete word"),
    body("Ctrl+C       cancel · Ctrl+L clear screen · Esc close the side pane"),
  ],
  links: [
    h("LINKS"),
    body("Any command can be shared as a link — it runs when the page opens:"),
    body([seg("/?cmd=man%20atlas", "accent")]),
    body([seg("/?cmd=run%20atlas", "accent")]),
    body("Separate several commands with ; (up to 5). In `history`, every ↗ is a link to that command."),
  ],
};

const help: Command = {
  name: "help",
  group: "info",
  summary: "list commands and help topics",
  usage: "help [navigation | search | shortcuts | links]",
  description: ["Lists every command by group, or explains a topic."],
  examples: ["help", "help shortcuts", "help links"],
  seeAlso: ["man"],
  run(args, _flags, ctx) {
    const topic = args[0]?.toLowerCase();
    if (topic) {
      const page = TOPICS[topic];
      return page ? { output: page } : fail(`help: no topic ${topic}`, `topics: ${Object.keys(TOPICS).join(", ")}`);
    }
    return {
      output: [
        out(seg("Type a command, click anything underlined, or just ask in plain English.", "muted")),
        ...GROUP_ORDER.flatMap((g) => {
          const cmds = ctx.commands.filter((c) => c.group === g);
          return cmds.length
            ? [blank(), out(seg(g.toUpperCase(), "faint")), ...cmds.map((c) => out(seg("  "), seg(c.name.padEnd(10), "accent", { run: `man ${c.name}` }), seg(c.summary, "muted")))]
            : [];
        }),
        blank(),
        out(seg("topics: ", "faint"), ...Object.keys(TOPICS).flatMap((t, i) => [...(i ? [seg(" · ", "faint")] : []), seg(`help ${t}`, "accent", { run: `help ${t}` })])),
      ],
    };
  },
};

const history: Command = {
  name: "history",
  group: "info",
  summary: "commands you have run",
  usage: "history [--session]",
  description: ["Lists previous commands (kept across visits). Click one to run it again; ↗ is a shareable link.", "Use !! or !N to repeat."],
  flags: { session: { describe: "only this visit, with times" } },
  examples: ["history", "history --session", "!!"],
  seeAlso: ["help"],
  run(_args, flags, ctx) {
    const entries = ctx.state.history.map((e, i) => ({ ...e, n: i + 1 }));
    const shown = flags.session ? entries.filter((e) => e.at >= ctx.state.sessionStart) : entries;
    return {
      output: shown.map((e) =>
        out(
          seg(`${String(e.n).padStart(4)}  `, "faint"),
          ...(flags.session ? [seg(`${hhmm(e.at)}  `, "faint")] : []),
          seg(e.command, "text", { run: e.command }),
          seg("  ↗", "faint", { href: deepLinkFor(e.command) }),
        ),
      ),
    };
  },
};

const whoami: Command = {
  name: "whoami",
  group: "info",
  summary: "who is behind this",
  usage: "whoami",
  description: ["Prints the system profile: role, systems, capabilities, stack and contact — all derived from content."],
  examples: ["whoami"],
  seeAlso: ["id", "resume"],
  run() {
    return { output: [{ block: { kind: "neofetch" } }] };
  },
};

const id: Command = {
  name: "id",
  group: "info",
  summary: "identity and capability groups",
  usage: "id",
  description: ["Prints the user handle and the capability groups they belong to."],
  examples: ["id"],
  seeAlso: ["whoami"],
  run(_args, _flags, ctx) {
    return { output: [out(seg(`uid=${handleOf(ctx.p)}`, "accent"), seg(" groups=", "faint"), seg(ctx.p.capabilities.map((c) => c.id).join(","), "text"))] };
  },
};

const resume: Command = {
  name: "resume",
  group: "info",
  summary: "recruiter summary",
  usage: "resume",
  description: ["A one-screen summary: role, availability, top systems with their headline impact, core stack and contact."],
  examples: ["resume", "export resume.pdf"],
  seeAlso: ["whoami", "export", "recruiter"],
  run(_args, _flags, ctx) {
    const { identity: me, systems, technologies } = ctx.p;
    const top = systems.filter((s) => s.featured).slice(0, 3);
    const stack = [...new Set(top.flatMap((s) => s.technologies))].slice(0, 10).map((t) => technologies.find((x) => x.id === t)?.name ?? t);
    return {
      output: [
        out(seg(me.name, "heading")),
        out(seg(me.role, "text"), ...(me.location ? [seg(` · ${me.location}`, "muted")] : [])),
        ...(me.availability ? [out(seg(me.availability, "ok"))] : []),
        blank(),
        out(seg("TOP SYSTEMS", "faint")),
        ...top.map((s) =>
          out(
            seg("  "),
            seg(s.name.padEnd(10), "accent", { run: `open ${s.slug}` }),
            seg(s.tagline, "text"),
            ...(s.impact?.[0] ? [seg(`  ${s.impact[0].value} ${s.impact[0].label}`, "ok")] : []),
          ),
        ),
        blank(),
        out(seg("CORE STACK  ", "faint"), seg(stack.join(" · "), "text")),
        out(seg("CONTACT     ", "faint"), seg(me.links.email, "link", { href: `mailto:${me.links.email}` })),
        ...(me.links.resume ? [blank(), out(seg("→ ", "faint"), seg("export resume.pdf", "accent", { run: "export resume.pdf" }))] : []),
      ],
    };
  },
};

const exportCmd: Command = {
  name: "export",
  group: "info",
  summary: "download the resume",
  usage: "export resume.pdf",
  description: ["Downloads the published resume PDF."],
  examples: ["export resume.pdf"],
  seeAlso: ["resume"],
  run(args, _flags, ctx) {
    if (args[0] !== "resume.pdf") return fail(`export: unknown target "${args[0] ?? ""}"`, `usage: ${this.usage}`);
    const href = ctx.p.identity.links.resume;
    if (!href) return fail("export: no resume published");
    return { effects: [{ type: "download", href }], output: [out(seg("downloading resume.pdf…", "faint"))] };
  },
};

export const infoCommands = [man, help, history, whoami, id, resume, exportCmd];
```

- [ ] **Step 6: Create `core/shell/commands/related.ts`** (shared by `man`; pure)

```ts
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
```

- [ ] **Step 7: Register in `core/shell/commands/index.ts`** — add `import { infoCommands } from "./info";` and change the array to `[...navCommands, ...textCommands, ...searchCommands, ...infoCommands]`.

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS. Note `man gerp` → "did you mean man grep".

- [ ] **Step 9: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add man, help, history, whoami, id, resume, export and welcome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Action commands (`open`, `run`, `graph`, `git`, `gui`, `recruiter`, `clear`, `sudo`, `exit`)

**Files:**
- Create: `core/shell/commands/actions.ts`
- Modify: `core/shell/commands/index.ts`
- Test: `tests/shell/actions.test.ts`

**Interfaces:**
- Consumes: registry, fs, `buildGraph`, `resolveFocus` (`core/graph`), `formatMonth` (`core/format`), `nearest`.
- Produces: `actionCommands: Command[]`; `GUI_PAGES = ["systems", "graph", "trace", "human", "connect"] as const`.

- [ ] **Step 1: Write the failing test `tests/shell/actions.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { run } from "./helpers";

describe("open", () => {
  it("opens systems, views, files, pages and the resume", () => {
    expect(run("open atlas").res.effects).toEqual([{ type: "openView", view: { type: "architecture", slug: "atlas" } }]);
    expect(run("open graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("open skills/graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("open README.md").res.effects).toEqual([{ type: "openView", view: { type: "reader", path: ["README.md"] } }]);
    expect(run("open trace").res.effects).toEqual([{ type: "navigate", href: "/trace" }]);
    expect(run("open contact").res.effects).toEqual([{ type: "navigate", href: "/connect" }]);
    expect(run("open resume").res.effects).toEqual([{ type: "download", href: portfolio.identity.links.resume }]);
  });

  it("explains failures", () => {
    expect(run("open").text).toBe("open: missing target\nusage: open <system | graph | resume | page | path>");
    expect(run("open skills").text).toBe("open: skills is a directory\ntry cd skills");
    expect(run("open nope").text).toBe('open: cannot find "nope"');
  });
});

describe("run", () => {
  it("simulates by slug or from the system directory", () => {
    expect(run("run atlas").res.effects).toEqual([{ type: "simulate", slug: "atlas" }]);
    expect(run("run", ["systems", "relay"]).res.effects).toEqual([{ type: "simulate", slug: "relay" }]);
    expect(run("run", ["systems", "relay", "x"]).res.effects).toEqual([{ type: "simulate", slug: "relay" }]);
  });

  it("explains missing or simulation-less systems", () => {
    expect(run("run").text).toMatch(/^run: which system\?/);
    expect(run("run ledger").text).toBe("run: Ledger has no simulation yet\ntry open ledger");
    expect(run("run atlsa").text).toBe('run: no system "atlsa"\ndid you mean run atlas');
  });
});

describe("graph / git / gui / recruiter / clear / easter eggs", () => {
  it("graph focuses resolved nodes", () => {
    expect(run("graph langgraph atlas nope").res.effects).toEqual([
      { type: "openView", view: { type: "graph", focus: ["tech:langgraph", "system:atlas"] } },
    ]);
    expect(run("graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("graph nope").text).toBe('graph: nothing matches "nope"');
  });

  it("git log lists commits newest first", () => {
    const lines = run("git log").text.split("\n");
    expect(lines[0]).toMatch(/^\* 7f3b2d1 \(feat\/ai-systems\) /);
    expect(lines).toHaveLength(portfolio.experience.reduce((n, e) => n + e.commits.length, 0));
    expect(run("git status").text).toBe("git: only `git log` is available for now\nusage: git log");
  });

  it("gui, recruiter, clear", () => {
    expect(run("gui").res.effects).toEqual([{ type: "navigate", href: "/systems" }]);
    expect(run("gui trace").res.effects).toEqual([{ type: "navigate", href: "/trace" }]);
    expect(run("gui nope").text).toBe("gui: no page nope\npages: systems, graph, trace, human, connect");
    expect(run("recruiter").res.effects).toEqual([{ type: "recruiter", on: true }, { type: "navigate", href: "/systems" }]);
    expect(run("clear").res.effects).toEqual([{ type: "clear" }]);
  });

  it("easter eggs use real contact data", () => {
    expect(run("sudo hire").text).toContain(portfolio.identity.links.email);
    expect(run("sudo rm").text).toBe("sudo: permission denied — only `sudo hire` is allowed");
    expect(run("exit").text).toContain("gui");
  });

  it("effects of non-final stages are discarded", () => {
    for (const cmd of ["open atlas | head", "run atlas | grep x", "clear | cat", "recruiter | wc -l"]) {
      expect(run(cmd).res.effects, cmd).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/actions.test.ts`
Expected: FAIL — `open` not found.

- [ ] **Step 3: Create `core/shell/commands/actions.ts`**

```ts
import { formatMonth } from "../../format";
import { buildGraph, resolveFocus } from "../../graph";
import { normalise, resolve } from "../fs";
import { fail, out, seg, type Command } from "../registry";
import { nearest } from "../util";

export const GUI_PAGES = ["systems", "graph", "trace", "human", "connect"] as const;
const PAGE_ALIASES: Record<string, string> = { contact: "connect", career: "trace", about: "human" };

const open: Command = {
  name: "open",
  group: "actions",
  summary: "open something in the side pane or the visual site",
  usage: "open <system | graph | resume | page | path>",
  description: [
    "Opens a system's architecture, the skill graph or a file in the side pane; a page (trace, human, contact) in the visual site; or downloads the resume.",
  ],
  examples: ["open atlas", "open graph", "open resume", "open trace"],
  seeAlso: ["less", "gui", "graph"],
  run(args, _flags, ctx) {
    const target = args[0];
    if (!target) return fail("open: missing target", `usage: ${this.usage}`);
    const t = target.toLowerCase().replace(/\/+$/, "");
    if (ctx.p.systems.some((s) => s.slug === t)) return { effects: [{ type: "openView", view: { type: "architecture", slug: t } }] };
    if (t === "graph") return { effects: [{ type: "openView", view: { type: "graph", focus: [] } }] };
    if (t === "resume" || t === "resume.pdf") {
      const href = ctx.p.identity.links.resume;
      return href ? { effects: [{ type: "download", href }] } : fail("open: no resume published");
    }
    const page = PAGE_ALIASES[t] ?? t;
    const isPage = (GUI_PAGES as readonly string[]).includes(page) && page !== "graph";
    const local = resolve(ctx.fs, ctx.state.cwd, target);
    // A page name wins unless the user is inside a directory where that name is a real entry.
    if (isPage && (!local || ctx.state.cwd.length === 0)) return { effects: [{ type: "navigate", href: `/${page}` }] };
    const node = local;
    if (!node) return fail(`open: cannot find "${target}"`);
    if (node.kind === "view") return { effects: [{ type: "openView", view: node.view }] };
    if (node.kind === "link") return { effects: [{ type: "download", href: node.href }] };
    if (node.kind === "file") return { effects: [{ type: "openView", view: { type: "reader", path: normalise(ctx.state.cwd, target) } }] };
    return fail(`open: ${target} is a directory`, [seg("try ", "faint"), seg(`cd ${target}`, "accent", { run: `cd ${target}` })]);
  },
};

const runCmd: Command = {
  name: "run",
  aliases: ["simulate"],
  group: "actions",
  summary: "stream a simulated request through a system",
  usage: "run [system]",
  description: [
    "Plays a system's documented request walkthrough step by step, lighting up each component in the architecture pane.",
    "Inside ~/systems/<name>, `run` uses that system. This is a simulation of documented behaviour, not live infrastructure.",
  ],
  examples: ["run atlas", "cd systems/relay; run"],
  seeAlso: ["open", "man"],
  run(args, _flags, ctx) {
    const cwd = ctx.state.cwd;
    const slug = (args[0] ?? (cwd[0] === "systems" ? cwd[1] : undefined))?.toLowerCase().replace(/\/+$/, "");
    const runnable = ctx.p.systems.filter((s) => s.simulation);
    if (!slug) {
      return fail("run: which system?", runnable.flatMap((s, i) => [...(i ? [seg("  ")] : []), seg(`run ${s.slug}`, "accent", { run: `run ${s.slug}` })]));
    }
    const system = ctx.p.systems.find((s) => s.slug === slug);
    if (!system) {
      const near = nearest(slug, ctx.p.systems.map((s) => s.slug));
      return fail(`run: no system "${slug}"`, near ? [seg("did you mean ", "faint"), seg(`run ${near}`, "accent", { run: `run ${near}` })] : "try ls ~/systems");
    }
    if (!system.simulation) return fail(`run: ${system.name} has no simulation yet`, [seg("try ", "faint"), seg(`open ${slug}`, "accent", { run: `open ${slug}` })]);
    return { effects: [{ type: "simulate", slug }] };
  },
};

const graph: Command = {
  name: "graph",
  group: "actions",
  summary: "show the skill graph, optionally focused",
  usage: "graph [node…]",
  description: ["Opens the engineering graph in the side pane, focused on systems, capabilities or technologies by id or name."],
  examples: ["graph", "graph langgraph", "graph atlas rag"],
  seeAlso: ["open", "which"],
  run(args, _flags, ctx) {
    const focus = resolveFocus(buildGraph(ctx.p), args.join(","));
    if (args.length && focus.length === 0) return fail(`graph: nothing matches "${args.join(" ")}"`);
    return { effects: [{ type: "openView", view: { type: "graph", focus } }] };
  },
};

const git: Command = {
  name: "git",
  group: "actions",
  summary: "career history as commits",
  usage: "git log",
  description: ["`git log` prints documented career milestones as commits, newest first. More git subcommands arrive in a later version."],
  examples: ["git log", "git log | grep feat"],
  seeAlso: ["cat", "grep"],
  run(args, _flags, ctx) {
    if (args[0] !== "log" || args.length > 1) return fail("git: only `git log` is available for now", `usage: ${this.usage}`);
    const commits = ctx.p.experience
      .flatMap((e) => e.commits.map((c) => ({ ...c, branch: e.branch, org: e.organisation })))
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      output: commits.map((c) =>
        out(seg("* ", "accent"), seg(c.hash, "warn"), seg(` (${c.branch}) `, "dir"), seg(c.message), seg(`  ${c.org}, ${formatMonth(c.date)}`, "faint")),
      ),
    };
  },
};

const gui: Command = {
  name: "gui",
  group: "actions",
  summary: "switch to the visual site",
  usage: "gui [systems | graph | trace | human | connect]",
  description: ["Opens a page of the visual (non-terminal) site. Type `>_ shell` there, or press ⌘K, to come back."],
  examples: ["gui", "gui trace"],
  seeAlso: ["open", "recruiter"],
  run(args) {
    const page = PAGE_ALIASES[args[0]?.toLowerCase() ?? ""] ?? args[0]?.toLowerCase() ?? "systems";
    if (!(GUI_PAGES as readonly string[]).includes(page)) return fail(`gui: no page ${args[0]}`, `pages: ${GUI_PAGES.join(", ")}`);
    return { effects: [{ type: "navigate", href: `/${page}` }] };
  },
};

const recruiter: Command = {
  name: "recruiter",
  group: "actions",
  summary: "one-screen summary in the visual site",
  usage: "recruiter",
  description: ["Turns on recruiter mode (a fast, motion-free summary) and opens the visual site."],
  examples: ["recruiter"],
  seeAlso: ["resume", "gui"],
  run() {
    return { effects: [{ type: "recruiter", on: true }, { type: "navigate", href: "/systems" }] };
  },
};

const clear: Command = {
  name: "clear",
  group: "actions",
  summary: "clear the screen",
  usage: "clear",
  description: ["Clears the transcript. Ctrl+L does the same."],
  examples: ["clear"],
  seeAlso: ["history"],
  run() {
    return { effects: [{ type: "clear" }] };
  },
};

const sudo: Command = {
  name: "sudo",
  group: "actions",
  summary: "elevated privileges (one use only)",
  usage: "sudo hire",
  description: ["There is exactly one privileged operation."],
  examples: ["sudo hire"],
  seeAlso: ["resume"],
  run(args, _flags, ctx) {
    if (args[0] !== "hire") return fail("sudo: permission denied — only `sudo hire` is allowed");
    const email = ctx.p.identity.links.email;
    return {
      output: [
        out(seg("[sudo] checking requirements…", "faint")),
        out(seg("  ✓ ", "ok"), seg(`${ctx.p.systems.length} systems documented`)),
        out(seg("  ✓ ", "ok"), seg(`${ctx.p.capabilities.length} capabilities with evidence`)),
        out(seg("candidate approved → ", "accent"), seg(email, "link", { href: `mailto:${email}` })),
      ],
    };
  },
};

const exit: Command = {
  name: "exit",
  aliases: ["logout"],
  group: "actions",
  summary: "leave the shell",
  usage: "exit",
  description: ["There is no exit — but there is a visual site."],
  examples: ["exit"],
  seeAlso: ["gui"],
  run() {
    return { output: [out(seg("logout? there's no escape — try ", "faint"), seg("gui", "accent", { run: "gui" }))] };
  },
};

export const actionCommands = [open, runCmd, graph, git, gui, recruiter, clear, sudo, exit];
```

- [ ] **Step 4: Register in `core/shell/commands/index.ts`** — final file:

```ts
import type { Command } from "../registry";
import { actionCommands } from "./actions";
import { infoCommands } from "./info";
import { navCommands } from "./nav";
import { searchCommands } from "./search";
import { textCommands } from "./text";

export const COMMANDS: Command[] = [...navCommands, ...textCommands, ...searchCommands, ...infoCommands, ...actionCommands];

export function getCommand(name: string): Command | undefined {
  const n = name.toLowerCase();
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export const commandNames = (): string[] => COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/shell && npx tsc --noEmit`
Expected: PASS; no type errors. `open skills` must still fail as a directory (it is not a GUI page).

- [ ] **Step 6: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): add open, run, graph, git log, gui, recruiter, clear and easter eggs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Tab completion and ghost suggestions

**Files:**
- Create: `core/shell/complete.ts`
- Test: `tests/shell/complete.test.ts`

**Interfaces:**
- Consumes: `buildFs`, `resolve`, `isDir`; `COMMANDS` (tests); `GUI_PAGES` (`commands/actions`); `Command`.
- Produces: `complete(input: string, cwd: string[], p: Portfolio, commands: Command[]): string[]` (full-line replacements), `ghost(input: string, candidates: string[]): string`, `commonPrefix(values: string[]): string`.

- [ ] **Step 1: Write the failing test `tests/shell/complete.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { COMMANDS } from "@/core/shell/commands";
import { commonPrefix, complete, ghost } from "@/core/shell/complete";

const c = (input: string, cwd: string[] = []) => complete(input, cwd, portfolio, COMMANDS);

describe("complete", () => {
  it("completes command names", () => {
    expect(c("gr")).toEqual(["grep ", "graph "]);
    expect(c("ls")).toEqual(["ls "]);
    expect(c("")).toEqual([]);
  });

  it("completes paths relative to the cwd, dirs only for cd", () => {
    expect(c("cd sy")).toEqual(["cd systems/"]);
    expect(c("cd systems/a")).toEqual(["cd systems/atlas/"]);
    expect(c("cat systems/atlas/d")).toEqual(["cat systems/atlas/decisions.md"]);
    expect(c("cd R")).toEqual([]);
    expect(c("cat R")).toEqual(["cat README.md"]);
    expect(c("cat ", ["systems", "atlas"])).toContain("cat README.md");
  });

  it("completes slugs, topics, pages and flags", () => {
    expect(c("run a")).toEqual(["run atlas"]);
    expect(c("run l")).toEqual([]);
    expect(c("man gr")).toEqual(["man grep", "man graph"]);
    expect(c("help sh")).toEqual(["help shortcuts"]);
    expect(c("gui t")).toEqual(["gui trace"]);
    expect(c("graph lang")).toEqual(["graph langgraph", "graph langchain"]);
    expect(c("grep --i")).toEqual(["grep --ignoreCase"]);
    expect(c("find . -na")).toEqual(["find . -name"]);
    expect(c("open at")).toEqual(["open atlas"]);
  });

  it("completes only the last stage of a pipeline", () => {
    expect(c("cat README.md | he")).toEqual(["cat README.md | head ", "cat README.md | help "]);
    expect(c("ls; cd sk")).toEqual(["ls; cd skills/"]);
  });
});

describe("ghost / commonPrefix", () => {
  it("returns the remainder of the first candidate", () => {
    expect(ghost("cd sy", ["cd systems/"])).toBe("stems/");
    expect(ghost("x", [])).toBe("");
    expect(commonPrefix(["graph langgraph", "graph langchain"])).toBe("graph lang");
    expect(commonPrefix([])).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/complete.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `core/shell/complete.ts`**

```ts
import type { Portfolio } from "../schema";
import { GUI_PAGES } from "./commands/actions";
import { buildFs, isDir, resolve } from "./fs";
import type { Command } from "./registry";

const PATH_COMMANDS = new Set(["ls", "cd", "cat", "less", "head", "tail", "wc", "tree", "find", "grep", "open"]);
const HELP_TOPICS = ["navigation", "search", "shortcuts", "links"];

function paths(p: Portfolio, cwd: string[], last: string, dirsOnly: boolean): string[] {
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const base = slash >= 0 ? last.slice(slash + 1) : last;
  const node = resolve(buildFs(p), cwd, dirPart || ".");
  if (!isDir(node)) return [];
  return node.children
    .filter((ch) => (!dirsOnly || isDir(ch)) && ch.name.startsWith(base))
    .map((ch) => `${dirPart}${ch.name}${isDir(ch) ? "/" : ""}`);
}

export function complete(input: string, cwd: string[], p: Portfolio, commands: Command[]): string[] {
  const cut = Math.max(input.lastIndexOf("|"), input.lastIndexOf(";")) + 1;
  const before = input.slice(0, cut);
  const stage = input.slice(cut);
  const lead = /^\s*/.exec(stage)![0];
  const words = stage.slice(lead.length).split(" ");
  const names = commands.flatMap((c) => [c.name, ...(c.aliases ?? [])]);

  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (!w) return [];
    return names.filter((n) => n.startsWith(w)).map((n) => `${before}${lead}${n} `);
  }

  const cmd = commands.find((c) => c.name === words[0].toLowerCase() || c.aliases?.includes(words[0].toLowerCase()));
  if (!cmd) return [];
  const last = words[words.length - 1];
  const head = `${before}${lead}${words.slice(0, -1).join(" ")} `;

  let options: string[] = [];
  if (last.startsWith("-")) {
    options = Object.entries(cmd.flags ?? {}).map(([name, d]) => (d.singleDash ? `-${name}` : `--${name}`));
  } else if (cmd.name === "run") {
    options = p.systems.filter((s) => s.simulation).map((s) => s.slug);
  } else if (cmd.name === "man") {
    options = [...commands.map((x) => x.name), ...p.systems.map((s) => s.slug), "kernel"];
  } else if (cmd.name === "help") {
    options = HELP_TOPICS;
  } else if (cmd.name === "graph") {
    options = [...p.systems.map((s) => s.slug), ...p.capabilities.map((x) => x.id), ...p.technologies.map((t) => t.id)];
  } else if (cmd.name === "which") {
    options = [...names, ...p.systems.map((s) => s.slug), ...p.capabilities.map((x) => x.id), ...p.technologies.map((t) => t.id)];
  } else if (cmd.name === "git") {
    options = ["log"];
  } else if (cmd.name === "gui") {
    options = [...GUI_PAGES];
  } else if (cmd.name === "export") {
    options = ["resume.pdf"];
  }
  if (cmd.name === "open") options = [...p.systems.map((s) => s.slug), "graph", "resume", "trace", "human", "contact"];
  if (PATH_COMMANDS.has(cmd.name) && !last.startsWith("-")) {
    options = [...options, ...paths(p, cwd, last, cmd.name === "cd")];
  }

  return [...new Set(options)].filter((o) => o.startsWith(last) && o !== last).map((o) => `${head}${o}`);
}

export function ghost(input: string, candidates: string[]): string {
  const first = candidates[0];
  return first && first.startsWith(input) ? first.slice(input.length) : "";
}

export function commonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const v of values) while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS. If `c("gr")` returns names in a different order, the order follows `COMMANDS` registration (search before actions): `grep` then `graph`.

- [ ] **Step 5: Commit**

```bash
git add core/shell/complete.ts tests/shell/complete.test.ts
git commit -m "feat(shell): add tab completion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Shell UI — transcript, view pane and interactive shell

**Files:**
- Create: `components/kernel/Transcript.tsx`, `components/kernel/ViewPane.tsx`, `components/kernel/Shell.tsx`
- Modify: `vitest.config.mts` (no change needed if it already includes `tests/**/*.test.tsx`; verify)
- Test: `tests/shell/ssr.test.tsx`

**Interfaces:**
- Consumes: everything in `core/shell/*`; `ArchitectureDiagram` (`components/architecture`), `createLineDecoder` (`components/query/stream`), `validateAction`, `UiAction` (`core/actions`), `getSystem`, `portfolio` (`core/content`), `neighbours`, `GraphEdge` (`core/graph`), `PositionedNode` (`core/graph-layout`), `kernel` (`lib/store`), `useMotionAllowed`, `QueryEvent` type.
- Produces:
  - `Transcript.tsx`: `TONE: Record<Tone, string>`, `type Row = { id: number; kind: "prompt"; cwd: string[]; text: string } | { id: number; kind: "item"; item: OutputItem }`, `SegView({ seg, onRun })`, `LineView({ line, onRun })`, `PromptText({ cwd })`, `Neofetch()`, `Transcript({ rows, onRun })`.
  - `ViewPane.tsx`: `ViewPane({ view, activeId, graph, onClose, onRun })`.
  - `Shell.tsx`: `Shell({ graph, initial }: { graph: { nodes: PositionedNode[]; edges: GraphEdge[] }; initial: OutputItem[] })`.

- [ ] **Step 1: Write the failing SSR test `tests/shell/ssr.test.tsx`**

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Transcript, type Row } from "@/components/kernel/Transcript";
import { portfolio } from "@/core/content";
import { handleOf, welcome } from "@/core/shell/welcome";

describe("shell transcript SSR", () => {
  it("server-renders the welcome screen with identity and systems", () => {
    const rows: Row[] = welcome(portfolio).map((item, i) => ({ id: i + 1, kind: "item", item }));
    const html = renderToString(<Transcript rows={rows} onRun={() => {}} />);
    expect(html).toContain(handleOf(portfolio));
    expect(html).toContain(portfolio.identity.role);
    for (const s of portfolio.systems) expect(html).toContain(`>${s.slug}<`);
    expect(html).toContain("<button");
  });

  it("renders prompt rows", () => {
    const html = renderToString(<Transcript rows={[{ id: 1, kind: "prompt", cwd: ["systems"], text: "ls" }]} onRun={() => {}} />);
    expect(html).toContain("~/systems");
    expect(html).toContain("ls");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/ssr.test.tsx`
Expected: FAIL — cannot resolve `@/components/kernel/Transcript`.

- [ ] **Step 3: Create `components/kernel/Transcript.tsx`**

```tsx
"use client";

import { portfolio } from "@/core/content";
import { pathOf } from "@/core/shell/fs";
import type { Line, OutputItem, Seg, Tone } from "@/core/shell/types";
import { neofetchData } from "@/core/shell/welcome";

export const TONE: Record<Tone, string> = {
  text: "text-text",
  muted: "text-muted",
  faint: "text-faint",
  accent: "text-accent",
  error: "text-[var(--k-model)]",
  ok: "text-[var(--k-store)]",
  dir: "text-[var(--k-client)]",
  view: "text-[var(--k-service)]",
  link: "text-[var(--k-queue)]",
  warn: "text-[var(--k-queue)]",
  heading: "font-semibold text-text",
  match: "bg-accent-soft text-accent",
};

export type Row = { id: number; kind: "prompt"; cwd: string[]; text: string } | { id: number; kind: "item"; item: OutputItem };

export function SegView({ seg, onRun }: { seg: Seg; onRun: (command: string) => void }) {
  const cls = TONE[seg.tone ?? "text"];
  if (seg.run) {
    const command = seg.run;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRun(command);
        }}
        className={`${cls} cursor-pointer underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid`}
      >
        {seg.text}
      </button>
    );
  }
  if (seg.href) {
    const external = /^https?:/.test(seg.href);
    return (
      <a
        href={seg.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`${cls} underline underline-offset-4`}
      >
        {seg.text}
      </a>
    );
  }
  return <span className={cls}>{seg.text}</span>;
}

export function LineView({ line, onRun }: { line: Line; onRun: (command: string) => void }) {
  return (
    <div className="min-h-[1.65em] whitespace-pre-wrap break-words">
      {line.map((s, i) => (
        <SegView key={i} seg={s} onRun={onRun} />
      ))}
    </div>
  );
}

export function PromptText({ cwd }: { cwd: string[] }) {
  return (
    <>
      <span className="text-accent">kernel</span> <span className={TONE.dir}>{pathOf(cwd)}</span>
      <span className="text-faint"> $ </span>
    </>
  );
}

const LOGO = [" _  __", "| |/ /", "| ' / ", "| . \\ ", "|_|\\_\\"].join("\n");
const SWATCHES = ["--k-client", "--k-service", "--k-agent", "--k-model", "--k-store", "--k-queue", "--k-external"];

export function Neofetch() {
  const { handle, rows } = neofetchData(portfolio);
  return (
    <div className="my-1 flex flex-col gap-3 sm:flex-row sm:gap-8">
      <pre aria-hidden="true" className="shrink-0 text-[15px] font-bold leading-[1.15] text-accent">
        {LOGO}
      </pre>
      <div>
        <p>
          <span className="text-accent">{handle}</span>
          <span className="text-faint">@</span>
          <span className="text-accent">kernel</span>
        </p>
        <p aria-hidden="true" className="text-faint">
          {"─".repeat(30)}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className={TONE.dir}>{r.label}</dt>
              <dd className={TONE[r.tone ?? "text"]}>
                {r.href ? (
                  <a href={r.href} className="underline underline-offset-4">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p aria-hidden="true" className="mt-2 flex">
          {SWATCHES.map((k) => (
            <span key={k} className="h-3.5 w-6" style={{ background: `var(${k})` }} />
          ))}
        </p>
      </div>
    </div>
  );
}

export function Transcript({ rows, onRun }: { rows: Row[]; onRun: (command: string) => void }) {
  return (
    <>
      {rows.map((row) =>
        row.kind === "prompt" ? (
          <div key={row.id} className="min-h-[1.65em] whitespace-pre-wrap break-words">
            <PromptText cwd={row.cwd} />
            {row.text}
          </div>
        ) : "block" in row.item ? (
          <Neofetch key={row.id} />
        ) : (
          <LineView key={row.id} line={row.item.line} onRun={onRun} />
        ),
      )}
    </>
  );
}
```

- [ ] **Step 4: Run SSR test**

Run: `npx vitest run tests/shell/ssr.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create `components/kernel/ViewPane.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { getSystem, portfolio } from "@/core/content";
import { neighbours, type GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { buildFs, pathOf, resolve } from "@/core/shell/fs";
import { styleLine } from "@/core/shell/style";
import type { View } from "@/core/shell/types";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import { LineView } from "./Transcript";

const COLOR = { system: "var(--g-system)", technology: "var(--g-technology)", capability: "var(--g-capability)" };

function title(view: View): string {
  if (view.type === "architecture") return `systems/${view.slug}/architecture`;
  if (view.type === "graph") return "skills/graph";
  return pathOf(view.path).replace(/^~\//, "");
}

export function ViewPane({
  view,
  activeId,
  graph,
  onClose,
  onRun,
}: {
  view: View;
  activeId: string | null;
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  onClose: () => void;
  onRun: (command: string) => void;
}) {
  const motion = useMotionAllowed();
  const [hover, setHover] = useState<string | null>(null);

  return (
    <section className="flex h-full min-h-0 flex-col border-border bg-surface/60 md:border-l" aria-label={`View: ${title(view)}`}>
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-faint">
        <span className="text-accent">{view.type === "reader" ? "less" : "view"}</span>
        <span className="truncate text-muted">{title(view)}</span>
        <button type="button" onClick={onClose} className="ml-auto hover:text-text" aria-label="Close view (Esc)">
          {view.type === "reader" ? "[q]" : "[esc]"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {view.type === "architecture" && <ArchitecturePane slug={view.slug} activeId={activeId} hover={hover} setHover={setHover} motion={motion} />}
        {view.type === "graph" && <GraphPane graph={graph} focus={view.focus} hover={hover} setHover={setHover} onRun={onRun} />}
        {view.type === "reader" && <ReaderPane path={view.path} onRun={onRun} />}
      </div>
    </section>
  );
}

function ArchitecturePane({
  slug,
  activeId,
  hover,
  setHover,
  motion,
}: {
  slug: string;
  activeId: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  motion: boolean;
}) {
  const system = getSystem(slug);
  if (!system) return null;
  const shown = system.architecture.nodes.find((n) => n.id === (hover ?? activeId));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-border bg-bg [&_svg]:min-w-0">
        <ArchitectureDiagram architecture={system.architecture} focusId={hover} activeId={activeId} motion={motion} onHover={setHover} onSelect={setHover} />
      </div>
      <div className="min-h-16 rounded border border-border p-3 text-[12px] leading-5" aria-live="polite">
        {shown ? (
          <>
            <p>
              <span className="text-accent">{shown.label}</span> <span className="text-faint">({shown.kind})</span>
            </p>
            <p className="text-muted">{shown.description}</p>
          </>
        ) : (
          <p className="text-faint">hover or focus a component · `run {slug}` streams a request through it</p>
        )}
      </div>
    </div>
  );
}

function GraphPane({
  graph,
  focus,
  hover,
  setHover,
  onRun,
}: {
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  focus: string[];
  hover: string | null;
  setHover: (id: string | null) => void;
  onRun: (command: string) => void;
}) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const active = hover ? [hover] : focus;
  const lit = new Set(active);
  active.forEach((id) => neighbours(graph, id).forEach((n) => lit.add(n)));
  const has = active.length > 0;

  return (
    <svg viewBox="0 0 1000 640" className="h-auto w-full" role="group" aria-label="Engineering graph">
      {graph.edges.map((e) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const on = has && (active.includes(e.source) || active.includes(e.target));
        return <line key={`${e.source}-${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--accent)" : "var(--border-strong)"} strokeOpacity={has && !on ? 0.12 : 0.6} />;
      })}
      {graph.nodes.map((n) => {
        const size = n.type === "system" ? 9 : n.type === "capability" ? 7 : 5;
        const command = n.type === "system" ? `open ${n.ref}` : `graph ${n.ref}`;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            opacity={has && !lit.has(n.id) ? 0.2 : 1}
            className="cursor-pointer outline-none"
            tabIndex={0}
            role="button"
            aria-label={`${n.type} ${n.label}`}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
            onClick={() => onRun(command)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRun(command);
              }
            }}
          >
            <circle r={size + 8} fill="transparent" />
            {n.type === "system" && <rect x={-size} y={-size} width={size * 2} height={size * 2} rx="3" fill={COLOR.system} />}
            {n.type === "capability" && <rect x={-size} y={-size} width={size * 2} height={size * 2} transform="rotate(45)" fill={COLOR.capability} />}
            {n.type === "technology" && <circle r={size} fill={COLOR.technology} />}
            {(n.type === "system" || lit.has(n.id)) && (
              <text y={size + 16} textAnchor="middle" className="fill-[var(--text-muted)] font-mono text-[12px]">
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ReaderPane({ path, onRun }: { path: string[]; onRun: (command: string) => void }) {
  const node = resolve(buildFs(portfolio), [], path.join("/"));
  if (node?.kind !== "file") return <p className="text-faint">nothing to read here</p>;
  return (
    <article className="text-[13px] leading-[1.7]">
      {node.lines.map((l, i) => (
        <LineView key={i} line={styleLine(l)} onRun={onRun} />
      ))}
    </article>
  );
}
```

- [ ] **Step 6: Create `components/kernel/Shell.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLineDecoder } from "@/components/query/stream";
import { validateAction, type UiAction } from "@/core/actions";
import { getSystem, portfolio } from "@/core/content";
import type { GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { COMMANDS } from "@/core/shell/commands";
import { commonPrefix, complete, ghost as ghostOf } from "@/core/shell/complete";
import { parseDeepLink } from "@/core/shell/deeplink";
import { execute, HISTORY_LIMIT, initialState } from "@/core/shell/execute";
import { pathOf } from "@/core/shell/fs";
import { out, seg } from "@/core/shell/registry";
import { styleLine } from "@/core/shell/style";
import type { Effect, HistoryEntry, OutputItem, ShellState, View } from "@/core/shell/types";
import { bootLines } from "@/core/shell/welcome";
import { kernel } from "@/lib/store";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import type { QueryEvent } from "@/server/query-handler";
import { PromptText, Transcript, type Row } from "./Transcript";
import { ViewPane } from "./ViewPane";

const HISTORY_KEY = "kernel:history";
const BOOT_KEY = "kernel:booted";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is HistoryEntry => typeof e?.command === "string" && typeof e?.at === "number")
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  } catch {
    /* storage unavailable — history stays in memory */
  }
}

type Pane = { view: View; activeId: string | null } | null;
type Search = { query: string; skip: number };

export function Shell({ graph, initial }: { graph: { nodes: PositionedNode[]; edges: GraphEdge[] }; initial: OutputItem[] }) {
  const router = useRouter();
  const motion = useMotionAllowed();
  const motionRef = useRef(motion);
  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

  const idRef = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((item, i) => ({ id: i + 1, kind: "item", item })));
  const stateRef = useRef<ShellState>(initialState(0));
  const [cwd, setCwd] = useState<string[]>([]);
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [histCursor, setHistCursor] = useState<number | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pane, setPane] = useState<Pane>(null);
  const [ai, setAi] = useState<"ready" | "online" | "offline">("ready");
  const [clock, setClock] = useState("");
  const cancel = useRef<{ cancelled: boolean; abort?: AbortController }>({ cancelled: false });
  const aiHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const add = useCallback((items: OutputItem[]) => {
    const created: Row[] = items.map((item) => ({ id: ++idRef.current, kind: "item", item }));
    setRows((r) => [...r, ...created]);
    return created.map((c) => c.id);
  }, []);

  const replace = useCallback((id: number, item: OutputItem) => {
    setRows((r) => r.map((row) => (row.id === id ? { id, kind: "item", item } : row)));
  }, []);

  const typeOut = useCallback(
    async (items: OutputItem[]) => {
      if (!motionRef.current || items.length < 3) {
        add(items);
        return;
      }
      const delay = Math.min(20, 400 / items.length);
      for (const item of items) {
        if (cancel.current.cancelled) return;
        add([item]);
        await sleep(delay);
      }
    },
    [add],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [rows, busy, search]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const setCaretAt = (pos: number) => {
    setCaret(pos);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  // ---------- effects ----------

  const playSimulation = useCallback(
    async (slug: string) => {
      const system = getSystem(slug);
      if (!system?.simulation) return;
      const W = 12;
      setPane({ view: { type: "architecture", slug }, activeId: null });
      add([out(seg("▶ ", "accent"), seg(system.name, "heading"), seg(`  "${system.simulation.prompt}"`, "muted"))]);
      const t0 = performance.now();
      for (const step of system.simulation.steps) {
        if (cancel.current.cancelled) break;
        setPane({ view: { type: "architecture", slug }, activeId: step.nodeId });
        const label = seg(`  [${step.title}]`.padEnd(15), "accent");
        const [rowId] = add([out(label, seg("─".repeat(W), "faint"), seg(`  ${step.detail}`, "muted"))]);
        const frames = motionRef.current ? W : 1;
        for (let f = 1; f <= frames; f++) {
          if (cancel.current.cancelled) break;
          if (motionRef.current) await sleep((step.durationMs * 0.7) / frames);
          const filled = Math.round((f / frames) * W);
          replace(rowId, out(label, seg("━".repeat(filled), "accent"), seg("─".repeat(W - filled), "faint"), seg(`  ${step.detail}`, f === frames ? "text" : "muted")));
        }
      }
      setPane({ view: { type: "architecture", slug }, activeId: null });
      if (cancel.current.cancelled) add([out(seg("^C interrupted", "error"))]);
      else add([out(seg(`  ✓ completed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, "ok"), seg("  (simulated walkthrough)", "faint"))]);
    },
    [add, replace],
  );

  const applyAction = useCallback(
    (raw: UiAction) => {
      const a = validateAction(raw, portfolio);
      if (!a) return;
      if (a.type === "openSystem") setPane({ view: { type: "architecture", slug: a.slug }, activeId: null });
      else if (a.type === "highlightGraph") setPane({ view: { type: "graph", focus: a.ids }, activeId: null });
      else if (a.type === "filterSystems") setPane({ view: { type: "graph", focus: [a.tech ? `tech:${a.tech}` : `cap:${a.capability}`] }, activeId: null });
      else if (a.type === "navigate") {
        const system = /^\/systems\/([a-z0-9-]+)$/.exec(a.path);
        if (system) setPane({ view: { type: "architecture", slug: system[1] }, activeId: null });
        else {
          const page = a.path.replace(/^\//, "") || "systems";
          add([out(seg("  → ", "faint"), seg(`gui ${page}`, "accent", { run: `gui ${page}` }), seg(" to open it visually", "faint"))]);
        }
      } else add([out(seg("  → ", "faint"), seg("recruiter", "accent", { run: "recruiter" }), seg(" for the one-screen summary", "faint"))]);
    },
    [add],
  );

  const ask = useCallback(
    async (question: string) => {
      const abort = new AbortController();
      cancel.current.abort = abort;
      const [rowId] = add([out(seg("▸ ", "accent"), seg("thinking…", "faint"))]);
      let text = "";
      let sources: string[] = [];
      const render = () =>
        replace(rowId, { line: [seg("▸ ", "accent"), ...text.split("\n").flatMap((l, i) => [...(i ? [seg("\n")] : []), ...styleLine(l)])] });
      aiHistory.current = [...aiHistory.current, { role: "user" as const, content: question.slice(0, 500) }].slice(-10);
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: aiHistory.current }),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          replace(rowId, out(seg("▸ ", "error"), seg(data.error ?? "query failed — try again", "error")));
          aiHistory.current.pop();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const lines = createLineDecoder((e: QueryEvent) => {
          if (e.type === "meta") {
            setAi(e.mode === "ai" ? "online" : "offline");
            sources = e.sources.slice(0, 4).map((s) => s.title);
          } else if (e.type === "text") {
            text += e.text;
            render();
          } else if (e.type === "action" || e.type === "suggestion") applyAction(e.action);
          else if (e.type === "error") add([out(seg(e.message, "error"))]);
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lines.push(decoder.decode(value, { stream: true }));
        }
        lines.flush();
        if (text) aiHistory.current = [...aiHistory.current, { role: "assistant" as const, content: text.slice(0, 1500) }];
        else aiHistory.current.pop();
        if (sources.length) add([out(seg(`  sources: ${sources.join(" · ")}`, "faint"))]);
      } catch {
        replace(rowId, out(seg("▸ ", "error"), seg(cancel.current.cancelled ? "^C" : "network error — try again", "error")));
        aiHistory.current.pop();
      }
    },
    [add, applyAction, replace],
  );

  const perform = useCallback(
    async (e: Effect) => {
      switch (e.type) {
        case "openView":
          setPane({ view: e.view, activeId: null });
          return;
        case "closeView":
          setPane(null);
          return;
        case "navigate":
          router.push(e.href);
          return;
        case "download": {
          const a = document.createElement("a");
          a.href = e.href;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        case "simulate":
          return playSimulation(e.slug);
        case "ask":
          return ask(e.question);
        case "clear":
          setRows([]);
          return;
        case "recruiter":
          kernel.setRecruiter(e.on);
          return;
      }
    },
    [ask, playSimulation, router],
  );

  const run = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      cancel.current = { cancelled: false };
      setRows((r) => [...r, { id: ++idRef.current, kind: "prompt", cwd: stateRef.current.cwd, text: raw }]);
      setInput("");
      setCaret(0);
      setHistCursor(null);
      setSearch(null);
      try {
        const res = execute(raw, stateRef.current, portfolio, Date.now(), { maxPipelines: 5 });
        stateRef.current = res.state;
        setCwd(res.state.cwd);
        setHistoryList(res.state.history.map((h) => h.command));
        saveHistory(res.state.history);
        await typeOut(res.output);
        for (const effect of res.effects) {
          if (cancel.current.cancelled) break;
          await perform(effect);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    },
    [perform, typeOut],
  );

  // ---------- boot + deep link ----------

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    stateRef.current = initialState(Date.now(), loadHistory());
    const restored = stateRef.current.history.map((h) => h.command);
    const link = parseDeepLink(window.location.search);
    let firstVisit = false;
    try {
      firstVisit = !window.sessionStorage.getItem(BOOT_KEY);
      window.sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void (async () => {
      setHistoryList(restored);
      if (firstVisit && !reduced && !link.line) {
        busyRef.current = true;
        setBusy(true);
        let skipped = false;
        const skip = () => {
          skipped = true;
        };
        window.addEventListener("keydown", skip, { once: true });
        const boot = bootLines(portfolio);
        for (let i = 0; i < boot.length; i++) {
          const row: Row = { id: ++idRef.current, kind: "item", item: boot[i] };
          setRows((r) => [...r.slice(0, i), row, ...r.slice(i)]);
          if (!skipped) await sleep(160);
        }
        window.removeEventListener("keydown", skip);
        busyRef.current = false;
        setBusy(false);
      }
      if (link.line) {
        if (link.truncated) add([out(seg("deep link truncated to 500 characters", "faint"))]);
        await run(link.line);
      }
      inputRef.current?.focus({ preventScroll: true });
    })();
  }, [add, run]);

  // ---------- input ----------

  const candidates = useMemo(() => (search || !input ? [] : complete(input, cwd, portfolio, COMMANDS)), [input, cwd, search]);
  const suggestion = caret === input.length ? ghostOf(input, candidates) : "";
  const searchMatch = useMemo(() => {
    if (!search || !search.query) return null;
    const hits = [...historyList].reverse().filter((c) => c.includes(search.query));
    return hits.length ? hits[Math.min(search.skip, hits.length - 1)] : null;
  }, [search, historyList]);

  const completeNow = () => {
    if (candidates.length === 1) {
      setInput(candidates[0]);
      setCaretAt(candidates[0].length);
    } else if (candidates.length > 1) {
      const prefix = commonPrefix(candidates);
      if (prefix.length > input.length) {
        setInput(prefix);
        setCaretAt(prefix.length);
      } else {
        setRows((r) => [
          ...r,
          { id: ++idRef.current, kind: "prompt", cwd, text: input },
          { id: ++idRef.current, kind: "item", item: out(...candidates.map((c) => seg(`${c.trimEnd().split(" ").pop()}   `, "muted"))) },
        ]);
      }
    }
  };

  const historyPrev = () => {
    if (historyList.length === 0) return;
    const i = histCursor === null ? historyList.length - 1 : Math.max(0, histCursor - 1);
    setHistCursor(i);
    setInput(historyList[i]);
    setCaretAt(historyList[i].length);
  };

  const historyNext = () => {
    if (histCursor === null) return;
    const i = histCursor + 1;
    const next = i >= historyList.length ? "" : historyList[i];
    setHistCursor(i >= historyList.length ? null : i);
    setInput(next);
    setCaretAt(next.length);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    const lower = k.toLowerCase();
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;

    if ((e.metaKey || e.ctrlKey) && lower === "k") {
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      return;
    }
    if (ctrl && lower === "c") {
      e.preventDefault();
      if (busyRef.current) {
        cancel.current.cancelled = true;
        cancel.current.abort?.abort();
      } else {
        setRows((r) => [...r, { id: ++idRef.current, kind: "prompt", cwd, text: `${search ? "" : input}^C` }]);
        setInput("");
        setCaret(0);
        setSearch(null);
      }
      return;
    }
    if (busyRef.current) {
      e.preventDefault();
      return;
    }
    if (k === "Escape") {
      e.nativeEvent.stopImmediatePropagation();
      if (search) setSearch(null);
      else setPane(null);
      return;
    }
    if (search) {
      if (ctrl && lower === "r") {
        e.preventDefault();
        setSearch({ ...search, skip: search.skip + 1 });
      } else if (ctrl && lower === "g") {
        e.preventDefault();
        setSearch(null);
      } else if (k === "Enter") {
        e.preventDefault();
        const match = searchMatch;
        setSearch(null);
        if (match) void run(match);
      } else if (k === "ArrowRight" || k === "ArrowLeft" || k === "Tab") {
        e.preventDefault();
        const match = searchMatch ?? "";
        setSearch(null);
        setInput(match);
        setCaretAt(match.length);
      }
      return;
    }
    if (ctrl) {
      if (lower === "r") return void (e.preventDefault(), setSearch({ query: "", skip: 0 }));
      if (lower === "l") return void (e.preventDefault(), setRows([]));
      if (lower === "a") return void (e.preventDefault(), setCaretAt(0));
      if (lower === "e") return void (e.preventDefault(), setCaretAt(input.length));
      if (lower === "u") {
        e.preventDefault();
        setInput(input.slice(caret));
        setCaretAt(0);
        return;
      }
      if (lower === "w") {
        e.preventDefault();
        const before = input.slice(0, caret).replace(/\S+\s*$/, "");
        setInput(before + input.slice(caret));
        setCaretAt(before.length);
        return;
      }
    }
    if (k === "q" && !input && pane?.view.type === "reader") {
      e.preventDefault();
      setPane(null);
    } else if (k === "Enter") {
      e.preventDefault();
      void run(input);
    } else if (k === "Tab") {
      e.preventDefault();
      completeNow();
    } else if ((k === "ArrowRight" || k === "End") && suggestion) {
      e.preventDefault();
      setInput(input + suggestion);
      setCaretAt((input + suggestion).length);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      historyPrev();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      historyNext();
    }
  };

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? input.length);
  const runFromClick = (command: string) => void run(command);
  const paneNode = pane && (
    <ViewPane view={pane.view} activeId={pane.activeId} graph={graph} onClose={() => setPane(null)} onRun={runFromClick} />
  );
  const keys: { label: string; action: () => void }[] = [
    { label: "Tab", action: completeNow },
    { label: "↑", action: historyPrev },
    { label: "cd ..", action: () => runFromClick("cd ..") },
    { label: "ls", action: () => runFromClick("ls") },
    { label: "help", action: () => runFromClick("help") },
    { label: "clear", action: () => setRows([]) },
  ];

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg font-mono text-[13px] leading-[1.65] text-text">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] text-faint">
        <span className="size-2.5 rounded-full bg-[var(--k-model)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-queue)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-store)]" aria-hidden="true" />
        <span className="ml-3 truncate">kernel — {pathOf(cwd)}</span>
        <button type="button" onClick={() => router.push("/systems")} className="ml-auto hover:text-text">
          gui ↗
        </button>
        <button type="button" onClick={kernel.toggleTheme} className="hover:text-text" aria-label="Toggle theme">
          ◐
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6"
          onMouseUp={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
          }}
        >
          <div role="log" aria-live="polite" aria-label="Kernel shell output">
            <Transcript rows={rows} onRun={runFromClick} />
          </div>
          <label className="relative block whitespace-pre-wrap break-all">
            <span className={busy ? "invisible" : undefined}>
              {search ? (
                <>
                  <span className="text-faint">(reverse-i-search)`</span>
                  <span>{search.query}</span>
                  <span className="text-faint">&apos;: </span>
                  <span>{searchMatch ?? ""}</span>
                  <span className="cursor-blink bg-accent"> </span>
                </>
              ) : (
                <>
                  <PromptText cwd={cwd} />
                  <span>{input.slice(0, caret)}</span>
                  <span className="cursor-blink bg-accent text-accent-contrast">{input[caret] ?? " "}</span>
                  <span>{input.slice(caret + 1)}</span>
                  {suggestion && <span className="text-faint">{suggestion}</span>}
                </>
              )}
            </span>
            <input
              ref={inputRef}
              value={search ? search.query : input}
              onChange={(e) => {
                if (search) {
                  setSearch({ query: e.target.value, skip: 0 });
                  return;
                }
                setInput(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
                setHistCursor(null);
              }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              readOnly={busy}
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="go"
              aria-label="Kernel shell input"
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
          </label>
        </div>
        {paneNode && <div className="hidden w-[46%] min-w-[420px] md:block">{paneNode}</div>}
      </div>
      {paneNode && <div className="h-[42%] shrink-0 border-t border-border md:hidden">{paneNode}</div>}

      <div className="hidden shrink-0 gap-1.5 overflow-x-auto border-t border-border px-2 py-1.5 [@media(pointer:coarse)]:flex" aria-label="Shell keys">
        {keys.map((key) => (
          <button
            key={key.label}
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              key.action();
              inputRef.current?.focus({ preventScroll: true });
            }}
            className="shrink-0 rounded border border-border px-2.5 py-1 text-[12px] text-muted"
          >
            {key.label}
          </button>
        ))}
      </div>

      <div className="flex h-6 shrink-0 items-center gap-3 bg-surface-2 px-3 text-[11px]">
        <span className="bg-accent px-1.5 text-accent-contrast">kernel</span>
        <span className="text-text">0:shell{pane ? "" : "*"}</span>
        {pane && <span className="text-text">1:{pane.view.type === "reader" ? "less" : "view"}*</span>}
        <span className="ml-auto hidden text-muted sm:inline">{pathOf(cwd)}</span>
        <span className={ai === "offline" ? "text-[var(--k-queue)]" : "text-[var(--k-store)]"}>ai:{ai}</span>
        <span className="text-muted">{clock}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, all tests pass. If lint reports `react-hooks/set-state-in-effect` for the clock `tick()` call, move the first `tick()` into `requestAnimationFrame(tick)`. If it reports `react-hooks/refs` for any ref read during render, move that read into an effect or state.

- [ ] **Step 8: Commit**

```bash
git add components/kernel tests/shell/ssr.test.tsx
git commit -m "feat(shell): add shell UI — transcript, view pane, interactive input

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Routes — shell home, GUI layout, retire the old terminal

**Files:**
- Move: `app/systems`, `app/graph`, `app/trace`, `app/human`, `app/connect` → `app/(gui)/…` (URLs unchanged)
- Delete: `app/page.tsx`, `core/command.ts`, `tests/command.test.ts`, `components/command/Terminal.tsx`, `components/shell/BootSequence.tsx`, `components/home/HeroGraph.tsx`
- Create: `app/(gui)/layout.tsx`, `app/(shell)/page.tsx`
- Modify: `app/layout.tsx`, `app/not-found.tsx`, `app/globals.css`, `components/shell/Overlays.tsx`, `components/shell/Header.tsx`, `components/shell/Footer.tsx`, `lib/store.ts`

**Interfaces:**
- Consumes: `Shell` (Task 9), `welcome` (Task 6), `layoutGraph`, `buildGraph`, `portfolio`.
- Produces: `/` = shell (static HTML includes the welcome transcript); GUI routes unchanged; `kernel` store without `commandOpen` / `openCommand` / `closeCommand`.

- [ ] **Step 1: Move GUI routes and delete retired files**

```bash
mkdir -p "app/(gui)" "app/(shell)"
for r in systems graph trace human connect; do git mv "app/$r" "app/(gui)/$r"; done
git rm -q app/page.tsx core/command.ts tests/command.test.ts components/command/Terminal.tsx components/shell/BootSequence.tsx components/home/HeroGraph.tsx
```

- [ ] **Step 2: Create `app/(gui)/layout.tsx`**

```tsx
import { RecruiterSummary } from "@/components/recruiter/RecruiterSummary";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";

export default function GuiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <RecruiterSummary />
        {children}
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Create `app/(shell)/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Shell } from "@/components/kernel/Shell";
import { portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";
import { welcome } from "@/core/shell/welcome";

export const metadata: Metadata = { title: { absolute: "Kernel" } };

export default function ShellPage() {
  const graph = layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 });
  return (
    <main id="main">
      <h1 className="sr-only">
        {portfolio.identity.name} — {portfolio.identity.role}
      </h1>
      <Shell graph={graph} initial={welcome(portfolio)} />
    </main>
  );
}
```

- [ ] **Step 4: Replace `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Overlays } from "@/components/shell/Overlays";
import { getIdentity } from "@/core/content";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const identity = getIdentity();

export const metadata: Metadata = {
  title: { default: "Kernel", template: "%s · Kernel" },
  description: `${identity.role}. ${identity.tagline}`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
  ],
};

// Runs before paint: restores theme and recruiter mode.
const themeScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("kernel:theme");if(t)d.dataset.theme=t;if(s.getItem("kernel:recruiter")==="on")d.dataset.recruiter="on";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only rounded bg-accent px-3 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <Overlays />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Replace `components/shell/Overlays.tsx`**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryPanel } from "@/components/query/QueryPanel";
import { kernel } from "@/lib/store";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function Overlays() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (pathname !== "/") router.push("/");
        return;
      }
      if (e.key === "Escape") {
        kernel.closeQuery();
        return;
      }
      if (e.key === "/" && pathname !== "/" && !isTyping(e.target)) {
        e.preventDefault();
        kernel.openQuery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return <QueryPanel />;
}
```

- [ ] **Step 6: Update `lib/store.ts`** — remove `commandOpen` from `KernelState` and `initial`, delete `openCommand` and `closeCommand`, and change `openQuery` to:

```ts
  openQuery(seed?: string) {
    hydrate();
    set({ queryOpen: true, querySeed: seed ?? null, queryNonce: state.queryNonce + 1 });
  },
```

- [ ] **Step 7: Update `components/shell/Header.tsx`** — replace the ⌘K `<button …onClick={kernel.openCommand}…>…</button>` with:

```tsx
          <Link
            href="/"
            aria-label="Open the Kernel shell (⌘K)"
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-muted transition hover:bg-surface-2 hover:text-text sm:inline-flex"
          >
            &gt;_ shell <Kbd>⌘K</Kbd>
          </Link>
```

and in the mobile menu replace `<button type="button" onClick={kernel.openCommand} className="font-mono text-xs text-muted">Command</button>` with:

```tsx
            <Link href="/" className="font-mono text-xs text-muted">
              Shell
            </Link>
```

- [ ] **Step 8: Update `components/shell/Footer.tsx`** — change `<Kbd>⌘K</Kbd> command` to `<Kbd>⌘K</Kbd> shell`.

- [ ] **Step 9: Update `app/not-found.tsx`** — wrap in the page gutter and point at the shell. Replace the opening `<section className="py-28 font-mono">` with `<section className="mx-auto max-w-6xl px-4 py-28 font-mono sm:px-6">`, and replace the sentence `Press <span className="text-text">⌘K</span> and type{" "}<span className="text-text">systems</span>, or head back.` with `Press <span className="text-text">⌘K</span> for the shell, or head back.`

- [ ] **Step 10: Remove the boot-overlay CSS from `app/globals.css`** — delete the block from the comment `/* Boot sequence: shown only when the inline head script sets data-boot="pending" */` through the closing `}` of `@keyframes boot-out`.

- [ ] **Step 11: Verify**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
lsof -ti tcp:3100 | xargs kill 2>/dev/null; (npm run start -- -p 3100 > /tmp/kernel-start.log 2>&1 &); sleep 5
for p in / "/?cmd=ls%20systems" /systems /systems/atlas /graph /trace /human /connect /resume.pdf /missing; do printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "localhost:3100$p")"; done
curl -s localhost:3100/ | grep -o "your-name" | head -1
curl -s localhost:3100/systems | grep -o "&gt;_ shell" | head -1
lsof -ti tcp:3100 | xargs kill
```

Expected: no errors; build lists `○ /` (static) and the GUI routes; all routes `200` except `/missing` → `404`; home HTML contains the handle `your-name`; GUI header contains `>_ shell`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(shell): make the shell the home page; keep visual pages as gui mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Docs and full verification

**Files:**
- Modify: `README.md` (add a "Shell" section after the intro paragraph), `AGENTS.md` (append shell rules)

**Interfaces:** none.

- [ ] **Step 1: Add to `README.md`** directly after the first paragraph:

````markdown
## The shell

The home page is **Kernel**, a shell over a virtual filesystem generated from `content/`:

```
~/systems/<name>/   README.md · architecture · decisions.md · tradeoffs.md · impact.txt · stack.txt · links.txt
~/skills/           <capability>.md · graph
~/stack/            <technology>.txt
~/README.md · about.md · career.log · contact.txt · resume.pdf
```

Try `ls`, `cd systems/atlas`, `cat decisions.md`, `run atlas`, `grep -i rag . | head -n 5`, `find . -name *.md`, `man kernel`, `history`, or ask anything in plain English. Everything underlined is clickable; the visual site is one `gui` away.

**Share a demo:** any command can be a link — `https://<your-site>/?cmd=run%20atlas` or `/?cmd=man%20atlas` (up to 5 commands separated by `;`).

Shortcuts: Tab completes (→ accepts the grey suggestion), ↑/↓ history, Ctrl+R search, Ctrl+A/E/U/W editing, Ctrl+C cancel, Ctrl+L clear, Esc closes the side pane.
````

- [ ] **Step 2: Append to `AGENTS.md`**

```markdown
- Shell spec: `docs/superpowers/specs/2026-10-05-kernel-shell-v1-design.md`; plan: `docs/superpowers/plans/2026-10-05-kernel-shell-v1.md`.
- `core/shell/` is pure: commands return `{ output, effects, state }`; only `components/kernel/Shell.tsx` performs effects.
- Every new command needs summary, usage, description, examples, seeAlso and tests in `tests/shell/`.
```

- [ ] **Step 3: Full automated verification**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: all green; `npm test` includes every `tests/shell/*` file.

- [ ] **Step 4: Browser verification** (Playwright or Chrome automation; production server on :3100)

At 1440×900 and 390×844, dark and light:
1. `/` first load in a fresh session: boot lines appear above neofetch, then prompt focused.
2. Type `cd sy`, press Tab → `cd systems/`; type `a`, see ghost `tlas/`, press → then Enter; `pwd` prints `~/systems/atlas`.
3. `run` streams steps with filling bars; pane lights active node; Ctrl+C mid-run prints `^C interrupted`.
4. `grep -i hybrid . | head -n 3` prints 3 highlighted lines; clicking a path opens the reader pane; `q` closes it.
5. `man grep`, `help shortcuts`, `history` (click ↗ loads `/?cmd=…` and runs it).
6. Ctrl+R, type `gre`, Enter re-runs the grep.
7. `/?cmd=man%20atlas` opens with the man page and no boot.
8. Plain English (`what has been built with agents?`) streams an answer (offline mode without key) and opens the graph pane.
9. `gui` → `/systems` with header showing `>_ shell`; ⌘K returns to `/`.
10. Mobile: key row visible on touch emulation; no horizontal page scroll (`document.documentElement.scrollWidth === 390`).
11. Reduced motion emulated: no boot, no typing stagger, simulation completes instantly.
12. No console errors or hydration warnings on any of the above.

Record what was verified and anything that could not be verified.

- [ ] **Step 5: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: document the Kernel shell and deep links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
