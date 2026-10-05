# Kernel Wrap-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every deferred review finding, add share cards/SEO/analytics hook, ship v2 introspection commands and v3 AI handoff (structured `ask`, typewriter streaming, view transitions), and prepare deployment without publishing.

**Architecture:** Pure logic stays in `core/` (shell commands, explain tree, deep links, analytics sanitiser) and small pure UI policy helpers in `components/kernel/policy.ts`, all unit-tested. `components/kernel/Shell.tsx` is rewritten once (Task 8) to integrate every UI change. Share images use Next's `opengraph-image` file convention with `next/og`. View transitions use React's `<ViewTransition>` (bundled with Next 16) inside `startTransition`.

**Tech Stack:** Next.js 16.3 App Router, React 19 (`ViewTransition`), TypeScript, Tailwind 4, motion 14 (`MotionConfig`), AI SDK 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-05-kernel-wrapup-design.md`

## Global Constraints

- Root `/Users/Pruthvi.Parade@gruve.ai/Desktop/Experiments/kernel`, branch `feat/wrapup` (off `main`). Read `node_modules/next/dist/docs/` before using a Next API not shown here.
- `core/**` imports nothing from React, `next/*` or `components/**`; deterministic given inputs.
- **No fabricated data:** every value printed comes from `content/` or real runtime state (`ShellState`, `RuntimeEnv`, `/api/status`). Placeholder content ships **without** `benchmarks`.
- Every new command: `summary`, `usage`, `description`, `examples` (≥1), `seeAlso` (≥1); `tests/shell/info.test.ts` "every command has a complete manual" must keep passing.
- Every animation (incl. view transitions, typewriter) is disabled under `prefers-reduced-motion` and Recruiter Mode.
- Analytics records only the command name (`commandName`), never arguments or questions; off unless `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.
- Nothing is pushed or published. No `git remote` is added.
- Commit after each task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- When `next build` reports stale `.next/**/validator.ts` type errors after route changes, `rm -rf .next` and rebuild (known cache issue, not a code error).

## Plan-level rulings (deviations from the spec, decided while planning)

- **D3 mechanism:** use React's `<ViewTransition>` + `startTransition` (what `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` prescribes for the App Router) instead of calling `document.startViewTransition` directly. Same browser API underneath, same fallback (no animation), integrates with route navigations.
- **D3 graph-node morph:** inner SVG elements cannot carry `view-transition-name`, so a graph node cannot morph into the architecture diagram. Instead the pane crossfades (`kernel-pane`) and the system title + diagram frame morph between the shell pane and the case study (`system-title-<slug>`, `system-arch-<slug>`) on `open <system> --full`.
- **A1.3 typo distance:** `levenshtein` becomes optimal-string-alignment distance (a transposition costs 1) so `grpe` suggests `grep`, not `tree`.

## Review Focus

1. **Commands run against an empty or minimal portfolio** (no experience, no impact, no simulation, one system) → `git log`, `git branch`, `diff`, `status`, `top`, `benchmark`, `explain` print sensible empty states, never throw. Test: Task 4 `introspection commands tolerate a minimal portfolio` and Task 6 `explain tolerates a minimal portfolio`.
2. **`git show` with ambiguous or very short hash prefixes** (`git show a`, `git show 0`, two commits sharing a 4-char prefix) → clear "too short"/"ambiguous" errors. Test: Task 4 `git show rejects short and ambiguous prefixes`.
3. **Typewriter with bursty network** (one 5 000-char chunk, then nothing) → finishes within ~1 s of arrival; never stalls at zero rate. Test: Task 7 `drain rate catches up with large buffers`.
4. **Deep link with quoted semicolons** (`?cmd=echo "a;b"; pwd`) → two commands (`echo "a;b"`, `pwd`), not three. Test: Task 2 `deep links split on unquoted semicolons only`.
5. **Rate limiter under key churn** (10 001 distinct IPs) → only the oldest key is evicted; an actively limited client stays limited. Test: Task 3 `evicts the oldest key instead of clearing`.

---
### Task 1: Shell engine fixes (A1.1–A1.4) and content integrity (A3.9)

**Files:**
- Modify: `core/shell/parser.ts` (`expandHistory`), `core/shell/execute.ts` (`isQuestion`, pipeline state), `core/shell/commands/nav.ts` (`cd`), `core/content.ts` (`checkIntegrity`), `core/shell/util.ts` (`levenshtein` → optimal string alignment)
- Test: `tests/shell/engine-fixes.test.ts`

**Interfaces:**
- Consumes: existing `expandHistory`, `execute`, `isQuestion`, `checkIntegrity`, test helpers `run`/`seq` (`tests/shell/helpers.ts`).
- Produces: unchanged signatures; behaviour per spec A1.1–A1.4, A3.9.

- [ ] **Step 1: Write the failing test `tests/shell/engine-fixes.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { checkIntegrity, portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { expandHistory } from "@/core/shell/parser";
import { nearest } from "@/core/shell/util";
import { run, seq } from "./helpers";

describe("typo distance counts a transposition as one edit", () => {
  it("prefers grep over tree for grpe", () => {
    expect(nearest("grpe", ["tree", "grep"])).toBe("grep");
  });
});

describe("A1.1 history expansion tracks both quote kinds", () => {
  it("keeps single-quoted !! literal even after an apostrophe inside double quotes", () => {
    expect(expandHistory(`echo "it's" '!!'`, ["ls"])).toEqual({ ok: true, line: `echo "it's" '!!'`, expanded: false });
  });
  it("expands !! after a double-quoted apostrophe", () => {
    expect(expandHistory(`echo "don't" !!`, ["ls"])).toEqual({ ok: true, line: `echo "don't" ls`, expanded: true });
  });
});

describe("A1.2 only the final pipeline stage changes shell state", () => {
  it("ignores cd in a non-final stage", () => {
    expect(run("cd systems | cat").res.state.cwd).toEqual([]);
  });
  it("applies cd in the final stage", () => {
    expect(run("echo x | cd systems").res.state.cwd).toEqual(["systems"]);
  });
});

describe("A1.3 typos with path-like arguments suggest instead of asking", () => {
  it("suggests cat for cta README.md", () => {
    const { res, text } = run("cta README.md");
    expect(res.effects).toEqual([]);
    expect(text).toContain("did you mean cat");
  });
  it("suggests grep for grpe rag .", () => {
    expect(run("grpe rag .").text).toContain("did you mean grep");
  });
  it("still asks real questions that mention files", () => {
    expect(run("what's in README.md").res.effects).toEqual([{ type: "ask", question: "what's in README.md" }]);
  });
});

describe("A1.4 cd with an empty argument is a no-op", () => {
  it("does not overwrite the previous directory", () => {
    expect(seq("cd systems", 'cd ""', "cd -").state.cwd).toEqual([]);
  });
});

describe("A3.9 integrity catches duplicate experience ids and commit hashes", () => {
  it("reports duplicate experience ids", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.experience[1].id = p.experience[0].id;
    expect(checkIntegrity(p)).toContain(`experience: duplicate id "${p.experience[0].id}"`);
  });
  it("reports duplicate commit hashes within an experience", () => {
    const p: Portfolio = structuredClone(portfolio);
    const e = p.experience[0];
    e.commits[1].hash = e.commits[0].hash;
    expect(checkIntegrity(p)).toContain(`experience.${e.id}.commits: duplicate hash "${e.commits[0].hash}"`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/engine-fixes.test.ts`
Expected: FAIL — 8 failures (typo distance ×1, A1.1 ×1 the single-quote case, A1.2 non-final, A1.3 ×2, A1.4, A3.9 ×2); "still asks real questions" and "applies cd in the final stage" may already pass.

- [ ] **Step 3: Fix `expandHistory` in `core/shell/parser.ts`** — replace

```ts
  let inSingle = false;
  let expanded = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") inSingle = !inSingle;
```

with

```ts
  let inSingle = false;
  let inDouble = false;
  let expanded = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
```

- [ ] **Step 4: Fix pipeline state and typo routing in `core/shell/execute.ts`**

Replace `if (res.state) st = { ...st, ...res.state };` with:

```ts
      // Bash runs pipeline stages in subshells: only the final stage may change shell state.
      if (res.state && isLast) st = { ...st, ...res.state };
```

Replace the body of `isQuestion` with:

```ts
export function isQuestion(line: string): boolean {
  if (/[|;]/.test(line)) return false;
  const words = line.trim().split(/\s+/);
  const first = words[0];
  const prose = words.every((w) => PROSE_WORD.test(w)) && !words.slice(1).some((w) => w.startsWith("-"));
  const asked = /\?$/.test(line);
  if (getCommand(first)) return asked && words.length >= 3 && prose;
  const pathLike = words.slice(1).some((w) => w === "." || w.includes("/") || w.includes("*") || w.startsWith("-") || /\.[a-z0-9]+$/i.test(w));
  if (!asked && pathLike && !QUESTION_WORDS.has(first.toLowerCase()) && nearest(first, commandNames())) return false;
  if (asked) return true;
  return words.length >= 2 && prose && /^[\p{L}][\p{L}'’]*$/u.test(first);
}
```

and add above `isQuestion`:

```ts
const QUESTION_WORDS = new Set([
  "what", "what's", "whats", "who", "who's", "whos", "why", "how", "where", "when", "which",
  "is", "are", "can", "could", "does", "do", "did", "tell", "show", "explain", "give", "list", "has", "have", "any",
]);
```

- [ ] **Step 4b: Make `levenshtein` in `core/shell/util.ts` count transpositions** — replace the inner loop body

```ts
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
```

with

```ts
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
```

- [ ] **Step 5: Fix `cd ""` in `core/shell/commands/nav.ts`** — in `cd.run`, directly after the `too many arguments` check, add:

```ts
    if (args[0] === "") return {};
```

- [ ] **Step 6: Add duplicate checks in `core/content.ts`** — in `checkIntegrity`, replace the line `for (const e of p.experience) {` (the commit-systems loop) with:

```ts
  for (const d of duplicates(p.experience.map((e) => e.id))) errors.push(`experience: duplicate id "${d}"`);
  for (const e of p.experience) {
    for (const d of duplicates(e.commits.map((c) => c.hash))) errors.push(`experience.${e.id}.commits: duplicate hash "${d}"`);
```

(the existing loop body continues unchanged inside the same `for`).

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/shell tests/content.test.ts`
Expected: PASS (all, including existing routing tests).

- [ ] **Step 8: Commit**

```bash
git add core tests
git commit -m "fix(shell): quote-aware history expansion, subshell pipeline state, typo routing, cd \"\", duplicate integrity checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Deep links — per-command limits (A1.5)

**Files:**
- Modify: `core/shell/deeplink.ts`, `tests/shell/info.test.ts` (replace the old `deep link limits` test)
- Test: `tests/shell/deeplink.test.ts`

**Interfaces:**
- Produces: `DEEP_LINK_MAX_COMMANDS = 5`, `DEEP_LINK_MAX_CHARS = 200`, `interface DeepLink { commands: string[]; notices: string[] }`, `parseDeepLink(search: string): DeepLink`, `splitCommands(raw: string): string[]`, `deepLinkFor(command: string): string` (unchanged). Consumed by Task 8 (`Shell.tsx`) — the Shell runs each command separately and prints each notice.

- [ ] **Step 1: Write the failing test `tests/shell/deeplink.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { deepLinkFor, parseDeepLink, splitCommands } from "@/core/shell/deeplink";

describe("parseDeepLink", () => {
  it("returns one command", () => {
    expect(parseDeepLink("?cmd=man%20atlas")).toEqual({ commands: ["man atlas"], notices: [] });
  });
  it("returns nothing for missing or blank cmd", () => {
    expect(parseDeepLink("")).toEqual({ commands: [], notices: [] });
    expect(parseDeepLink("?cmd=%20%20")).toEqual({ commands: [], notices: [] });
  });
  it("truncates each command to 200 characters with a notice", () => {
    const res = parseDeepLink(`?cmd=${"a".repeat(10_000)}`);
    expect(res.commands).toEqual(["a".repeat(200)]);
    expect(res.notices).toEqual(["deep link: commands longer than 200 characters were truncated"]);
  });
  it("caps at 5 commands with a notice", () => {
    const res = parseDeepLink(`?cmd=${encodeURIComponent(Array(20).fill("pwd").join(";"))}`);
    expect(res.commands).toHaveLength(5);
    expect(res.notices).toEqual(["deep link: skipped 15 more commands (limit 5)"]);
  });
  it("deep links split on unquoted semicolons only", () => {
    expect(splitCommands(`echo "a;b"; pwd`)).toEqual([`echo "a;b"`, " pwd"]);
    expect(parseDeepLink(`?cmd=${encodeURIComponent(`echo 'x;y';pwd;;`)}`).commands).toEqual([`echo 'x;y'`, "pwd"]);
  });
  it("builds links", () => {
    expect(deepLinkFor("grep -i rag .")).toBe("/?cmd=grep%20-i%20rag%20.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/deeplink.test.ts`
Expected: FAIL — `splitCommands` is not exported / shape mismatch.

- [ ] **Step 3: Replace `core/shell/deeplink.ts`**

```ts
export const DEEP_LINK_MAX_COMMANDS = 5;
export const DEEP_LINK_MAX_CHARS = 200;
const RAW_MAX = 4_000;

export interface DeepLink {
  commands: string[];
  notices: string[];
}

/** Splits on `;` outside single/double quotes. */
export function splitCommands(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of raw) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ";") {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts;
}

export function parseDeepLink(search: string): DeepLink {
  const raw = (new URLSearchParams(search).get("cmd") ?? "").slice(0, RAW_MAX);
  const all = splitCommands(raw).map((c) => c.trim()).filter(Boolean);
  const notices: string[] = [];
  let truncated = false;
  const commands = all.slice(0, DEEP_LINK_MAX_COMMANDS).map((c) => {
    if (c.length <= DEEP_LINK_MAX_CHARS) return c;
    truncated = true;
    return c.slice(0, DEEP_LINK_MAX_CHARS);
  });
  if (truncated) notices.push(`deep link: commands longer than ${DEEP_LINK_MAX_CHARS} characters were truncated`);
  const skipped = all.length - commands.length;
  if (skipped > 0) notices.push(`deep link: skipped ${skipped} more command${skipped === 1 ? "" : "s"} (limit ${DEEP_LINK_MAX_COMMANDS})`);
  return { commands, notices };
}

export const deepLinkFor = (command: string) => `/?cmd=${encodeURIComponent(command)}`;
```

- [ ] **Step 4: Replace the old test in `tests/shell/info.test.ts`** — delete the whole `it("deep link limits", () => { … });` block (it asserts the old `{ line, truncated }` shape) and add in its place:

```ts
  it("unknown deep-linked commands are just not found", () => {
    expect(textOf(execute("rm -rf /", initialState(0), portfolio, 0).output)).toContain("command not found: rm");
  });
```

Then remove `parseDeepLink` (and `deepLinkFor` if now unused) from that file's import of `@/core/shell/deeplink`; delete the import line entirely if nothing remains.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS. (`Shell.tsx` still references `link.line`; `tsc` is fixed in Task 8 — do not run `tsc` as a gate for this task.)

- [ ] **Step 6: Commit**

```bash
git add core/shell/deeplink.ts tests/shell
git commit -m "fix(shell): deep links split into ≤5 commands of ≤200 chars, quote-aware

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Query API hardening (A3.1–A3.4)

**Files:**
- Modify: `core/ratelimit.ts`, `server/query-handler.ts`, `components/query/QueryPanel.tsx` (assistant history slice)
- Test: `tests/ratelimit.test.ts`, `tests/query-handler.test.ts` (append)

**Interfaces:**
- Produces: `createRateLimiter(opts: { perMinute; perDay; now?; maxKeys?: number })` (default `maxKeys` 10 000; evicts oldest). `clientKey(req: Request): string` exported from `server/query-handler.ts`. `MAX_ASSISTANT_CHARS = 1500`, `MAX_ASSISTANT_TURNS = 6` exported.

- [ ] **Step 1: Append failing tests**

To `tests/ratelimit.test.ts` (inside the existing `describe`):

```ts
  it("evicts the oldest key instead of clearing", () => {
    const rl = createRateLimiter({ perMinute: 1, perDay: 10, now: () => 0, maxKeys: 2 });
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("b").ok).toBe(true);
    expect(rl.check("b").ok).toBe(false);
    expect(rl.check("c").ok).toBe(true); // evicts "a" (oldest), not everyone
    expect(rl.check("b").ok).toBe(false); // b is still limited
    expect(rl.check("a").ok).toBe(true); // a was forgotten
  });
```

To `tests/query-handler.test.ts` (new `describe` at the end of the file):

```ts
import { clientKey } from "@/server/query-handler";

describe("hardening", () => {
  it("prefers x-real-ip, then the last x-forwarded-for hop", () => {
    const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(clientKey(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("9.9.9.9");
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientKey(req({}))).toBe("anonymous");
  });

  it("rejects long or excessive assistant history", async () => {
    const deps = { portfolio, limiter: limiter(), getModel: () => null };
    const long = { messages: [{ role: "assistant", content: "x".repeat(1501) }, { role: "user", content: "hi" }] };
    expect((await handleQuery(request(long), deps)).status).toBe(400);
    const many = {
      messages: [...Array.from({ length: 7 }, () => ({ role: "assistant", content: "a" })), { role: "user", content: "hi" }],
    };
    expect((await handleQuery(request(many), deps)).status).toBe(400);
  });

  it("tool input cannot override the action type", async () => {
    const model = modelWith([
      { type: "tool-call", toolCallId: "c1", toolName: "openSystem", input: JSON.stringify({ slug: "atlas", type: "navigate", path: "/trace" }) },
      finish,
    ]);
    const ev = await events(await handleQuery(request(ask("open atlas")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev).toContainEqual({ type: "action", action: { type: "openSystem", slug: "atlas" } });
  });

  it("sends local suggestions when the provider fails after partial text", async () => {
    const model = modelWith([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Relay is " },
      { type: "error", error: new Error("boom") },
    ]);
    const ev = await events(await handleQuery(request(ask("Tell me about Relay")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev.some((e) => e.type === "error")).toBe(true);
    expect(ev).toContainEqual({ type: "suggestion", action: { type: "openSystem", slug: "relay" } });
    expect(ev.at(-1)).toEqual({ type: "done" });
  });
});
```

(Move the new `import { clientKey } …` line up into the file's import block — merge it with the existing `@/server/query-handler` import.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ratelimit.test.ts tests/query-handler.test.ts`
Expected: FAIL — eviction test (b becomes allowed after clear), `clientKey` not exported, history accepted (200), override test passes or fails depending on SDK stripping (it must pass after Step 4 either way), suggestion missing.

- [ ] **Step 3: Update `core/ratelimit.ts`** — change the options type and eviction:

```ts
export function createRateLimiter(opts: { perMinute: number; perDay: number; now?: () => number; maxKeys?: number }) {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? MAX_KEYS;
```

and replace `if (!hits.has(key) && hits.size >= MAX_KEYS) hits.clear();` with:

```ts
      if (!hits.has(key) && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
```

- [ ] **Step 4: Update `server/query-handler.ts`**

Add exports below `MAX_USER_CHARS`:

```ts
export const MAX_ASSISTANT_CHARS = 1500;
export const MAX_ASSISTANT_TURNS = 6;
```

Add two refinements to `queryRequestSchema` (after the user-length refine):

```ts
  .refine(
    (b) => b.messages.every((m) => m.role !== "assistant" || m.content.length <= MAX_ASSISTANT_CHARS),
    `assistant messages are limited to ${MAX_ASSISTANT_CHARS} characters`,
  )
  .refine((b) => b.messages.filter((m) => m.role === "assistant").length <= MAX_ASSISTANT_TURNS, "too many assistant turns")
```

Replace `function clientKey` with:

```ts
export function clientKey(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = req.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] ?? "anonymous";
}
```

Replace `validateAction({ type: part.toolName, ...(part.input as object) }, portfolio)` with `validateAction({ ...(part.input as object), type: part.toolName }, portfolio)`.

Replace the catch-branch line `if (emitted) send({ type: "error", message: "The answer was interrupted. Try again in a moment." });` with:

```ts
        if (emitted) {
          send({ type: "error", message: "The answer was interrupted. Try again in a moment." });
          for (const action of localAnswer(portfolio, question).suggestions) send({ type: "suggestion", action });
        }
```

- [ ] **Step 5: Keep the client within the new limits** — in `components/query/QueryPanel.tsx` change `content: m.content.slice(0, 4000)` to `content: m.content.slice(0, 1500)`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/ratelimit.test.ts tests/query-handler.test.ts && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add core/ratelimit.ts server/query-handler.ts components/query/QueryPanel.tsx tests
git commit -m "fix(api): trusted client key, LRU eviction, assistant-history caps, tool type pinning, fallback suggestions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: v2 — `git log/show/branch`, `diff`, `benchmark`, `benchmarks` content field

**Files:**
- Modify: `core/schema.ts` (System `benchmarks`), `core/shell/commands/actions.ts` (remove `git`), `core/shell/commands/index.ts` (register), `tests/shell/actions.test.ts` (replace the old git test)
- Create: `core/shell/commands/introspect.ts`
- Test: `tests/shell/introspect.test.ts`

**Interfaces:**
- Consumes: registry helpers (`seg`, `out`, `blank`, `fail`, `Command`), `formatMonth`, `formatPeriod`, `nearest`, `execute`/`initialState`.
- Produces: `introspectCommands: Command[]` (`git`, `diff`, `benchmark`); `System["benchmarks"]?: { metric; value; unit?; context?; measuredAt?; source? }[]`; test helper `runWith(p: Portfolio, input: string)` in `tests/shell/helpers.ts`.

- [ ] **Step 1: Add `runWith` to `tests/shell/helpers.ts`**

```ts
import type { Portfolio } from "@/core/schema";

export function runWith(p: Portfolio, input: string) {
  const res = execute(input, initialState(NOW), p, NOW);
  return { res, text: textOf(res.output) };
}
```

(merge the `Portfolio` import with the file's existing imports.)

- [ ] **Step 2: Write the failing test `tests/shell/introspect.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { systemSchema, type Portfolio } from "@/core/schema";
import { run, runWith } from "./helpers";

const clone = (): Portfolio => structuredClone(portfolio);
const commitCount = portfolio.experience.reduce((n, e) => n + e.commits.length, 0);

describe("git log", () => {
  it("prints multi-line entries newest first", () => {
    const lines = run("git log").text.split("\n");
    expect(lines[0]).toBe("commit 7f3b2d1 (feat/ai-systems)");
    expect(lines[1]).toMatch(/^Org: {4}.+ @ Example Labs$/);
    expect(lines[2]).toBe("Date:   Sep 2025");
    expect(lines.filter((l) => l.startsWith("commit "))).toHaveLength(commitCount);
  });

  it("supports --oneline and a system filter", () => {
    const oneline = run("git log --oneline").text.split("\n");
    expect(oneline[0]).toMatch(/^\* 7f3b2d1 \(feat\/ai-systems\) /);
    expect(oneline).toHaveLength(commitCount);
    const atlas = run("git log atlas --oneline").text.split("\n");
    const expected = portfolio.experience.flatMap((e) => e.commits).filter((c) => c.systems?.includes("atlas")).length;
    expect(atlas).toHaveLength(expected);
    expect(run("git log atlsa").text).toBe('git log: no system "atlsa"\ndid you mean git log atlas');
  });
});

describe("git show / branch", () => {
  it("shows one commit with its systems", () => {
    const text = run("git show 7f3b").text;
    expect(text).toContain("commit 7f3b2d1");
    expect(text).toContain("feat: introduce multi-agent orchestration with Relay");
    expect(text).toContain("Systems:");
    expect(text).toContain("Relay");
  });

  it("git show rejects short and ambiguous prefixes", () => {
    expect(run("git show a").text).toBe("git show: hash prefix too short (use at least 4 characters)");
    expect(run("git show ffff").text).toBe("git show: unknown revision ffff");
    const p = clone();
    p.experience[0].commits[0].hash = "abcd111";
    p.experience[0].commits[1].hash = "abcd222";
    expect(runWith(p, "git show abcd").text).toBe("git show: abcd is ambiguous (abcd111, abcd222)");
    expect(run("git show").text).toBe("git show: missing revision\nusage: git log [system] [--oneline] · git show <hash> · git branch");
  });

  it("lists branches with the current role starred", () => {
    const lines = run("git branch").text.split("\n");
    expect(lines[0]).toMatch(/^\* feat\/ai-systems {2}/);
    expect(lines).toHaveLength(portfolio.experience.length);
    expect(run("git status").text).toBe("git: 'status' is not available here\nusage: git log [system] [--oneline] · git show <hash> · git branch");
  });
});

describe("diff", () => {
  it("compares two systems", () => {
    const text = run("diff atlas relay").text;
    expect(text.split("\n")[0]).toMatch(/Atlas\s+Relay/);
    expect(text).toMatch(/= .*LangGraph.*shared/);
    expect(text).toMatch(/- .*Weaviate.*only atlas/);
    expect(text).toMatch(/\+ .*MCP.*only relay/);
  });

  it("validates arguments", () => {
    expect(run("diff atlas").text).toBe("diff: need two systems\nusage: diff <system> <system>");
    expect(run("diff atlas atlas").text).toBe("diff: compare two different systems");
    expect(run("diff atlas ghost").text).toBe('diff: no system "ghost"');
  });
});

describe("benchmark", () => {
  it("refuses to invent numbers", () => {
    const { text, res } = run("benchmark atlas");
    expect(text).toBe("benchmark: Atlas has no published measurements\nadd them to content/systems/atlas.ts → benchmarks");
    expect(res.exitCode).toBe(1);
  });

  it("prints published measurements", () => {
    const p = clone();
    p.systems[0].benchmarks = [{ metric: "p95 latency", value: "820", unit: "ms", context: "1k req load test", measuredAt: "2025-04" }];
    const text = runWith(p, "benchmark atlas").text;
    expect(text).toContain("p95 latency");
    expect(text).toContain("820 ms");
    expect(text).toContain("1k req load test · Apr 2025");
  });

  it("validates the content field", () => {
    const base = structuredClone(portfolio.systems[0]);
    expect(systemSchema.safeParse({ ...base, benchmarks: [{ metric: "x", value: "1", measuredAt: "April" }] }).success).toBe(false);
    expect(systemSchema.safeParse({ ...base, benchmarks: [{ metric: "x", value: "1" }] }).success).toBe(true);
  });
});

describe("introspection commands tolerate a minimal portfolio", () => {
  it("prints empty states instead of throwing", () => {
    const p = clone();
    p.experience = [];
    p.systems = [p.systems[p.systems.length - 1]];
    expect(runWith(p, "git log").text).toBe("no commits yet");
    expect(runWith(p, "git branch").text).toBe("no branches yet");
    expect(runWith(p, `diff ${p.systems[0].slug} atlas`).text).toBe('diff: no system "atlas"');
    expect(runWith(p, `benchmark ${p.systems[0].slug}`).res.exitCode).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/shell/introspect.test.ts`
Expected: FAIL — `runWith` missing until Step 1 is saved; then git/diff/benchmark assertions fail.

- [ ] **Step 4: Add `benchmarks` to `systemSchema` in `core/schema.ts`** — directly after `simulation: simulationSchema.optional(),` add:

```ts
  benchmarks: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().optional(),
        context: z.string().optional(),
        measuredAt: yearMonth.optional(),
        source: z.string().optional(),
      }),
    )
    .optional(),
```

(`yearMonth` is already defined at the top of the file and used by `commitSchema`; if it is declared below `systemSchema`, move its declaration above.)

- [ ] **Step 5: Create `core/shell/commands/introspect.ts`**

```ts
import { formatMonth, formatPeriod } from "../../format";
import type { Portfolio } from "../../schema";
import { blank, fail, out, seg, type Command } from "../registry";
import type { OutputItem } from "../types";
import { nearest } from "../util";

const GIT_USAGE = "git log [system] [--oneline] · git show <hash> · git branch";

type Entry = Portfolio["experience"][number]["commits"][number] & { branch: string; org: string; role: string };

function entries(p: Portfolio): Entry[] {
  return p.experience
    .flatMap((e) => e.commits.map((c) => ({ ...c, branch: e.branch, org: e.organisation, role: e.role })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function logEntry(c: Entry): OutputItem[] {
  return [
    out(seg("commit ", "warn"), seg(c.hash, "warn", { run: `git show ${c.hash}` }), seg(` (${c.branch})`, "dir")),
    out(seg("Org:    ", "faint"), seg(`${c.role} @ ${c.org}`)),
    out(seg("Date:   ", "faint"), seg(formatMonth(c.date))),
    blank(),
    out(`    ${c.message}`),
    ...(c.body ? [out(seg(`    ${c.body}`, "muted"))] : []),
    blank(),
  ];
}

const git: Command = {
  name: "git",
  group: "actions",
  summary: "career history as commits",
  usage: GIT_USAGE,
  description: [
    "Documented career milestones as git history. `git log` lists them (filter by system), `git show` prints one, `git branch` lists roles.",
    "Only documented milestones appear — nothing is generated.",
  ],
  flags: { oneline: { describe: "one line per commit" } },
  examples: ["git log", "git log atlas --oneline", "git show 7f3b", "git branch"],
  seeAlso: ["diff", "cat"],
  run(args, flags, ctx) {
    const [sub, target] = args;
    const all = entries(ctx.p);
    if (sub === "log") {
      if (target && !ctx.p.systems.some((s) => s.slug === target)) {
        const near = nearest(target, ctx.p.systems.map((s) => s.slug));
        return fail(`git log: no system "${target}"`, near ? [seg("did you mean ", "faint"), seg(`git log ${near}`, "accent", { run: `git log ${near}` })] : undefined);
      }
      const list = target ? all.filter((c) => c.systems?.includes(target)) : all;
      if (list.length === 0) return { output: [out(seg("no commits yet", "faint"))] };
      if (flags.oneline) {
        return {
          output: list.map((c) =>
            out(seg("* ", "accent"), seg(c.hash, "warn", { run: `git show ${c.hash}` }), seg(` (${c.branch}) `, "dir"), seg(c.message), seg(`  ${c.org}, ${formatMonth(c.date)}`, "faint")),
          ),
        };
      }
      const output = list.flatMap(logEntry);
      output.pop();
      return { output };
    }
    if (sub === "show") {
      if (!target) return fail("git show: missing revision", `usage: ${GIT_USAGE}`);
      const prefix = target.toLowerCase();
      if (prefix.length < 4) return fail("git show: hash prefix too short (use at least 4 characters)");
      const matches = all.filter((c) => c.hash.startsWith(prefix));
      if (matches.length === 0) return fail(`git show: unknown revision ${target}`);
      if (matches.length > 1) return fail(`git show: ${target} is ambiguous (${matches.map((m) => m.hash).join(", ")})`);
      const c = matches[0];
      const systems = (c.systems ?? []).map((slug) => ctx.p.systems.find((s) => s.slug === slug)).filter((s) => s !== undefined);
      const tech = (id: string) => ctx.p.technologies.find((t) => t.id === id)?.name ?? id;
      const output = logEntry(c);
      if (systems.length) {
        output.push(out(seg("Systems:", "faint")));
        for (const s of systems) {
          output.push(out(seg("  "), seg(s.name, "accent", { run: `open ${s.slug}` }), seg(`  ${s.technologies.map(tech).join(", ")}`, "muted")));
        }
      } else output.pop();
      return { output };
    }
    if (sub === "branch") {
      if (ctx.p.experience.length === 0) return { output: [out(seg("no branches yet", "faint"))] };
      return {
        output: [...ctx.p.experience]
          .sort((a, b) => b.start.localeCompare(a.start))
          .map((e) =>
            out(
              seg(e.end ? "  " : "* ", "accent"),
              seg(e.branch, e.end ? "dir" : "ok"),
              seg(`  ${formatPeriod(e.start, e.end)} · ${e.role} @ ${e.organisation}`, "faint"),
            ),
          ),
      };
    }
    return fail(`git: '${sub ?? ""}' is not available here`, `usage: ${GIT_USAGE}`);
  },
};

const diff: Command = {
  name: "diff",
  group: "search",
  summary: "compare two systems side by side",
  usage: "diff <system> <system>",
  description: ["Compares status, period, size and stack of two systems: = shared, - only in the first, + only in the second."],
  examples: ["diff atlas relay", "diff beacon ledger"],
  seeAlso: ["man", "graph", "git"],
  run(args, _flags, ctx) {
    if (args.length !== 2) return fail("diff: need two systems", `usage: ${this.usage}`);
    const [aSlug, bSlug] = args.map((x) => x.toLowerCase());
    if (aSlug === bSlug) return fail("diff: compare two different systems");
    const a = ctx.p.systems.find((s) => s.slug === aSlug);
    const b = ctx.p.systems.find((s) => s.slug === bSlug);
    if (!a) return fail(`diff: no system "${aSlug}"`);
    if (!b) return fail(`diff: no system "${bSlug}"`);
    const name = (kind: "technologies" | "capabilities", id: string) =>
      (kind === "technologies" ? ctx.p.technologies : ctx.p.capabilities).find((x) => x.id === id)?.name ?? id;
    const row = (label: string, va: string, vb: string) =>
      out(seg(label.padEnd(14), "faint"), seg(va.padEnd(22), va === vb ? "text" : "warn"), seg(vb, va === vb ? "text" : "warn"));
    const sets = (kind: "technologies" | "capabilities") => {
      const shared = a[kind].filter((x) => b[kind].includes(x)).map((x) => name(kind, x));
      const onlyA = a[kind].filter((x) => !b[kind].includes(x)).map((x) => name(kind, x));
      const onlyB = b[kind].filter((x) => !a[kind].includes(x)).map((x) => name(kind, x));
      return [
        out(seg(kind, "faint")),
        out(seg("  = ", "faint"), seg(shared.join(", ") || "—"), seg("   shared", "faint")),
        out(seg("  - ", "error"), seg(onlyA.join(", ") || "—"), seg(`   only ${a.slug}`, "faint")),
        out(seg("  + ", "ok"), seg(onlyB.join(", ") || "—"), seg(`   only ${b.slug}`, "faint")),
      ];
    };
    return {
      output: [
        out(seg("".padEnd(14)), seg(a.name.padEnd(22), "accent", { run: `open ${a.slug}` }), seg(b.name, "accent", { run: `open ${b.slug}` })),
        row("status", a.status, b.status),
        row("period", a.period ?? "—", b.period ?? "—"),
        row("category", a.category, b.category),
        row("components", String(a.architecture.nodes.length), String(b.architecture.nodes.length)),
        row("decisions", String(a.decisions.length), String(b.decisions.length)),
        row("simulation", a.simulation ? "yes" : "no", b.simulation ? "yes" : "no"),
        blank(),
        ...sets("technologies"),
        blank(),
        ...sets("capabilities"),
      ],
    };
  },
};

const benchmark: Command = {
  name: "benchmark",
  group: "info",
  summary: "published measurements for a system",
  usage: "benchmark <system>",
  description: ["Prints the measurements recorded in the system's content (`benchmarks`). Kernel never estimates or invents numbers."],
  examples: ["benchmark atlas"],
  seeAlso: ["man", "diff"],
  run(args, _flags, ctx) {
    const slug = args[0]?.toLowerCase();
    if (!slug) return fail("benchmark: missing system", `usage: ${this.usage}`);
    const s = ctx.p.systems.find((x) => x.slug === slug);
    if (!s) return fail(`benchmark: no system "${slug}"`);
    if (!s.benchmarks?.length) return fail(`benchmark: ${s.name} has no published measurements`, `add them to content/systems/${s.slug}.ts → benchmarks`);
    return {
      output: [
        out(seg("METRIC".padEnd(28), "faint"), seg("VALUE".padEnd(16), "faint"), seg("CONTEXT", "faint")),
        ...s.benchmarks.map((m) =>
          out(
            seg(m.metric.padEnd(28)),
            seg(`${m.value}${m.unit ? ` ${m.unit}` : ""}`.padEnd(16), "accent"),
            seg([m.context, m.measuredAt && formatMonth(m.measuredAt), m.source].filter(Boolean).join(" · "), "muted"),
          ),
        ),
      ],
    };
  },
};

export const introspectCommands = [git, diff, benchmark];
```

- [ ] **Step 6: Remove the old `git` from `core/shell/commands/actions.ts`** — delete the whole `const git: Command = { … };` block, remove `git` from the `actionCommands` array, and delete the now-unused `formatMonth` import if lint flags it.

- [ ] **Step 7: Register in `core/shell/commands/index.ts`** — add `import { introspectCommands } from "./introspect";` and append `...introspectCommands` to the end of the `COMMANDS` array.

- [ ] **Step 8: Replace the old git test in `tests/shell/actions.test.ts`** — delete the `it("git log lists commits newest first", () => { … });` block (now covered by `introspect.test.ts`).

- [ ] **Step 9: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS (the man-completeness test now covers `git`, `diff`, `benchmark`).

- [ ] **Step 10: Commit**

```bash
git add core tests
git commit -m "feat(shell): v2 git log/show/branch, diff, benchmark and benchmarks content field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: v2 — runtime state, `status`/`ps`/`top`/`env`, `graph --depth`, `/api/status`

**Files:**
- Modify: `core/shell/types.ts` (`RuntimeEnv`, `DEFAULT_ENV`, `ShellState.stats`), `core/shell/registry.ts` (`Ctx.env`), `core/shell/execute.ts` (`initialState`, `opts.env`, stats), `core/search.ts` (`indexSize`), `core/shell/commands/actions.ts` (`graph --depth`), `core/shell/commands/index.ts`
- Create: `core/shell/commands/runtime.ts`, `server/status.ts`, `app/api/status/route.ts`
- Test: `tests/shell/runtime.test.ts`, `tests/status.test.ts`

**Interfaces:**
- Produces:
  - `interface RuntimeEnv { theme: "dark" | "light"; motion: "full" | "reduced"; recruiter: boolean; ai: "online" | "offline" | "unknown"; pane: string | null }`, `DEFAULT_ENV: RuntimeEnv`
  - `ShellState.stats: { commands: number; simulations: number }`; `initialState(now, history?)` sets `{ commands: 0, simulations: 0 }`
  - `execute(input, state, p, now?, opts?: { maxPipelines?: number; env?: RuntimeEnv })`
  - `Ctx.env: RuntimeEnv`
  - `indexSize(p: Portfolio): number`
  - `runtimeCommands: Command[]` (`status`, `ps`, `top`, `env`), `formatDuration(ms: number): string`
  - `statusResponse(env: { GEMINI_API_KEY?: string }): Response` → JSON `{ ai: boolean }`, `cache-control: no-store`
- Consumed by Task 8: Shell passes `env` and increments `stats.simulations`.

- [ ] **Step 1: Write the failing tests**

`tests/shell/runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { COMMANDS } from "@/core/shell/commands";
import { execute, initialState } from "@/core/shell/execute";
import { formatDuration } from "@/core/shell/commands/runtime";
import { DEFAULT_ENV, type RuntimeEnv } from "@/core/shell/types";
import { NOW, seq, textOf } from "./helpers";

const withEnv = (input: string, env: Partial<RuntimeEnv> = {}, p: Portfolio = portfolio, now = NOW + 125_000) =>
  textOf(execute(input, initialState(NOW), p, now, { env: { ...DEFAULT_ENV, ...env } }).output);

describe("stats", () => {
  it("counts non-empty commands", () => {
    expect(seq("ls", "pwd", "   ").state.stats.commands).toBe(2);
  });
});

describe("status", () => {
  it("reports real subsystem state", () => {
    const text = withEnv("status", { ai: "online" });
    expect(text).toContain("KERNEL STATUS");
    expect(text).toMatch(new RegExp(`portfolio\\s+READY\\s+${portfolio.systems.length} systems`));
    expect(text).toMatch(/query\s+ONLINE\s+gemini configured/);
    expect(text).toMatch(/session\s+READY\s+up 2m 5s · 1 commands/);
    expect(withEnv("status")).toMatch(/query\s+UNKNOWN/);
    expect(withEnv("status", { ai: "offline" })).toMatch(/query\s+OFFLINE\s+no key — local search answers/);
  });

  it("is derived from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = p.systems.slice(0, 1);
    expect(withEnv("status", {}, p)).toMatch(/portfolio\s+READY\s+1 systems/);
  });
});

describe("ps / top / env", () => {
  it("ps lists kernel modules with real counts", () => {
    const lines = withEnv("ps", { pane: "graph" }).split("\n");
    expect(lines[0]).toMatch(/PID\s+NAME\s+STATE\s+DETAIL/);
    expect(lines).toHaveLength(7);
    expect(lines[1]).toMatch(new RegExp(`1\\s+shell\\s+running\\s+${COMMANDS.length} commands`));
    expect(lines[6]).toMatch(/6\s+renderer\s+running\s+pane: graph/);
  });

  it("top summarises this session", () => {
    const state = seq("ls", "pwd", "ls").state; // consecutive duplicates are not recorded, so interleave
    const text = textOf(execute("top", state, portfolio, NOW + 60_000, { env: DEFAULT_ENV }).output);
    expect(text).toMatch(/^kernel — up 1m 0s/);
    expect(text).toMatch(/commands\s+4 this session · history 4/);
    expect(text).toMatch(/ls\s+█+ 2/);
  });

  it("env shows public configuration only", () => {
    const text = withEnv("env", { theme: "light", ai: "online", recruiter: true, motion: "reduced" });
    for (const line of ["KERNEL_VERSION=1.0", "CWD=~", "THEME=light", "MOTION=reduced", "RECRUITER=on", "AI=online", "HISTSIZE=1"]) {
      expect(text).toContain(line);
    }
    expect(text).toMatch(/SESSION_START=\d\d:\d\d/);
    expect(text).not.toMatch(/KEY|GEMINI/);
  });

  it("formats durations", () => {
    expect(formatDuration(5_000)).toBe("0m 5s");
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });

  it("tolerates a minimal portfolio", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.experience = [];
    p.systems = p.systems.slice(-1);
    for (const cmd of ["status", "ps", "top", "env"]) expect(() => withEnv(cmd, {}, p)).not.toThrow();
  });
});

describe("graph --depth", () => {
  it("expands focus by hops", () => {
    const res = execute("graph --depth 1 langgraph", initialState(NOW), portfolio, NOW);
    const focus = (res.effects[0] as { view: { focus: string[] } }).view.focus;
    expect(focus).toEqual(expect.arrayContaining(["tech:langgraph", "system:atlas", "system:relay", "cap:agents"]));
  });

  it("validates depth", () => {
    expect(withEnv("graph --depth 4 atlas")).toBe("graph: --depth must be 1, 2 or 3");
    expect(withEnv("graph --depth 2")).toBe("graph: --depth needs a node");
  });
});
```

`tests/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { statusResponse } from "@/server/status";

describe("statusResponse", () => {
  it("reports whether a key is configured without exposing it", async () => {
    const off = statusResponse({});
    expect(off.headers.get("cache-control")).toBe("no-store");
    expect(await off.json()).toEqual({ ai: false });
    const on = statusResponse({ GEMINI_API_KEY: "secret-123" });
    const body = await on.text();
    expect(JSON.parse(body)).toEqual({ ai: true });
    expect(body).not.toContain("secret-123");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/shell/runtime.test.ts tests/status.test.ts`
Expected: FAIL — modules/exports missing.

- [ ] **Step 3: Types, registry, execute, search**

In `core/shell/types.ts` add:

```ts
export interface RuntimeEnv {
  theme: "dark" | "light";
  motion: "full" | "reduced";
  recruiter: boolean;
  ai: "online" | "offline" | "unknown";
  pane: string | null;
}

export const DEFAULT_ENV: RuntimeEnv = { theme: "dark", motion: "full", recruiter: false, ai: "unknown", pane: null };
```

and extend `ShellState`:

```ts
export interface ShellState {
  cwd: string[];
  prevCwd: string[];
  history: HistoryEntry[];
  sessionStart: number;
  stats: { commands: number; simulations: number };
}
```

In `core/shell/registry.ts`: import `RuntimeEnv` in the existing `./types` import and add `env: RuntimeEnv;` to `Ctx`.

In `core/shell/execute.ts`:
- `initialState` returns `{ cwd: [], prevCwd: [], history: history.slice(-HISTORY_LIMIT), sessionStart: now, stats: { commands: 0, simulations: 0 } }`.
- Change the signature to `opts: { maxPipelines?: number; env?: RuntimeEnv } = {}` and import `DEFAULT_ENV, type RuntimeEnv` from `./types`.
- In the `let st: ShellState = { … }` initialiser add `stats: { ...state.stats, commands: state.stats.commands + 1 },`.
- Pass `env: opts.env ?? DEFAULT_ENV` in the `cmd.run(…)` context object.

In `core/search.ts` add at the end:

```ts
export const indexSize = (p: Portfolio): number => buildIndex(p).length;
```

- [ ] **Step 4: Create `core/shell/commands/runtime.ts`**

```ts
import { buildGraph } from "../../graph";
import { indexSize } from "../../search";
import { isDir, pathOf, walk } from "../fs";
import { blank, out, seg, type Command, type Ctx } from "../registry";
import type { Tone } from "../types";
import { hhmm } from "../util";

export const KERNEL_VERSION = "1.0";

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function counts(ctx: Ctx) {
  const entries = walk(ctx.fs, []).slice(1);
  const g = buildGraph(ctx.p);
  return {
    dirs: entries.filter((e) => isDir(e.node)).length,
    files: entries.filter((e) => !isDir(e.node)).length,
    nodes: g.nodes.length,
    edges: g.edges.length,
    docs: indexSize(ctx.p),
  };
}

const AI_STATE: Record<Ctx["env"]["ai"], { state: string; tone: Tone; detail: string }> = {
  online: { state: "ONLINE", tone: "ok", detail: "gemini configured" },
  offline: { state: "OFFLINE", tone: "warn", detail: "no key — local search answers" },
  unknown: { state: "UNKNOWN", tone: "faint", detail: "not checked yet" },
};

const status: Command = {
  name: "status",
  group: "info",
  summary: "kernel subsystem status",
  usage: "status",
  description: ["Shows each Kernel subsystem and what it has loaded — all from real runtime state."],
  examples: ["status"],
  seeAlso: ["ps", "top", "env"],
  run(_args, _flags, ctx) {
    const c = counts(ctx);
    const ai = AI_STATE[ctx.env.ai];
    const rows: [string, string, Tone, string][] = [
      ["portfolio", "READY", "ok", `${ctx.p.systems.length} systems · ${ctx.p.capabilities.length} capabilities · ${ctx.p.technologies.length} technologies`],
      ["filesystem", "READY", "ok", `${c.dirs} directories · ${c.files} files`],
      ["graph", "READY", "ok", `${c.nodes} nodes · ${c.edges} edges`],
      ["search", "READY", "ok", `${c.docs} documents indexed`],
      ["query", ai.state, ai.tone, ai.detail],
      ["session", "READY", "ok", `up ${formatDuration(ctx.now - ctx.state.sessionStart)} · ${ctx.state.stats.commands} commands`],
    ];
    return {
      output: [
        out(seg("KERNEL STATUS", "heading")),
        blank(),
        ...rows.map(([name, state, tone, detail]) => out(seg(name.padEnd(12)), seg(state.padEnd(10), tone), seg(detail, "muted"))),
      ],
    };
  },
};

const ps: Command = {
  name: "ps",
  group: "info",
  summary: "kernel modules as processes",
  usage: "ps",
  description: ["Lists Kernel's modules and what each holds. PIDs are stable indexes; there is no CPU or memory column because there is nothing real to show."],
  examples: ["ps"],
  seeAlso: ["status", "top"],
  run(_args, _flags, ctx) {
    const c = counts(ctx);
    const ai = ctx.env.ai;
    const rows: [string, string, string][] = [
      ["shell", "running", `${ctx.commands.length} commands`],
      ["fs", "running", `${c.dirs} dirs, ${c.files} files`],
      ["graph", "running", `${c.nodes} nodes`],
      ["search", "running", `${c.docs} docs`],
      ["query", ai, ai === "online" ? "gemini" : ai === "offline" ? "local search" : "—"],
      ["renderer", ctx.env.pane ? "running" : "idle", ctx.env.pane ? `pane: ${ctx.env.pane}` : "no pane"],
    ];
    return {
      output: [
        out(seg("  PID  NAME        STATE     DETAIL", "heading")),
        ...rows.map(([name, state, detail], i) =>
          out(seg(`  ${String(i + 1).padStart(3)}  `, "faint"), seg(name.padEnd(12), "accent"), seg(state.padEnd(10), state === "offline" ? "warn" : "ok"), seg(detail, "muted")),
        ),
      ],
    };
  },
};

const top: Command = {
  name: "top",
  group: "info",
  summary: "this session at a glance",
  usage: "top",
  description: ["A snapshot of this session: uptime, commands run, simulations played and your most-used commands."],
  examples: ["top"],
  seeAlso: ["history", "status"],
  run(_args, _flags, ctx) {
    const session = ctx.state.history.filter((h) => h.at >= ctx.state.sessionStart);
    const freq = new Map<string, number>();
    for (const h of session) {
      const name = h.command.trim().split(/\s+/)[0]?.toLowerCase();
      if (name) freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    return {
      output: [
        out(seg(`kernel — up ${formatDuration(ctx.now - ctx.state.sessionStart)}`, "accent"), seg(` · session started ${hhmm(ctx.state.sessionStart)}`, "faint")),
        out(seg("commands    ", "faint"), seg(`${session.length} this session · history ${ctx.state.history.length}`)),
        out(seg("simulations ", "faint"), seg(String(ctx.state.stats.simulations))),
        out(seg("pane        ", "faint"), seg(ctx.env.pane ?? "none")),
        blank(),
        out(seg("TOP COMMANDS (this session)", "faint")),
        ...(ranked.length
          ? ranked.map(([name, n]) => out(seg(`  ${name.padEnd(10)}`, "accent", { run: name }), seg("█".repeat(Math.min(n, 20)), "accent"), seg(` ${n}`, "muted")))
          : [out(seg("  (none yet)", "faint"))]),
      ],
    };
  },
};

const env: Command = {
  name: "env",
  group: "info",
  summary: "public kernel configuration",
  usage: "env",
  description: ["Prints Kernel's public configuration. Secrets are never part of the environment shown here."],
  examples: ["env", "env | grep AI"],
  seeAlso: ["status"],
  run(_args, _flags, ctx) {
    const vars: [string, string][] = [
      ["KERNEL_VERSION", KERNEL_VERSION],
      ["CWD", pathOf(ctx.state.cwd)],
      ["THEME", ctx.env.theme],
      ["MOTION", ctx.env.motion],
      ["RECRUITER", ctx.env.recruiter ? "on" : "off"],
      ["AI", ctx.env.ai],
      ["HISTSIZE", String(ctx.state.history.length)],
      ["SESSION_START", hhmm(ctx.state.sessionStart)],
    ];
    return { output: vars.map(([k, v]) => out(seg(k, "accent"), seg("=", "faint"), seg(v))) };
  },
};

export const runtimeCommands = [status, ps, top, env];
```

- [ ] **Step 5: `graph --depth` in `core/shell/commands/actions.ts`** — replace the `graph` command's `usage`, `description`, add `flags`, `examples` and `run`:

```ts
  usage: "graph [--depth n] [node…]",
  description: [
    "Opens the engineering graph in the side pane, focused on systems, capabilities or technologies by id or name.",
    "--depth expands the focus by that many hops (1–3).",
  ],
  flags: { depth: { value: true, placeholder: "n", describe: "also highlight neighbours up to n hops away (1–3)" } },
  examples: ["graph", "graph langgraph", "graph --depth 2 atlas"],
```

```ts
  run(args, flags, ctx) {
    const g = buildGraph(ctx.p);
    let focus = resolveFocus(g, args.join(","));
    if (args.length && focus.length === 0) return fail(`graph: nothing matches "${args.join(" ")}"`);
    if (flags.depth !== undefined) {
      const depth = Number(flags.depth);
      if (![1, 2, 3].includes(depth)) return fail("graph: --depth must be 1, 2 or 3");
      if (focus.length === 0) return fail("graph: --depth needs a node");
      const seen = new Set(focus);
      let frontier = [...focus];
      for (let i = 0; i < depth; i++) {
        frontier = frontier.flatMap((id) => [...neighbours(g, id)]).filter((id) => !seen.has(id));
        frontier.forEach((id) => seen.add(id));
      }
      focus = [...seen];
    }
    return { effects: [{ type: "openView", view: { type: "graph", focus } }] };
  },
```

and change the graph import to `import { buildGraph, neighbours, resolveFocus } from "../../graph";`.

- [ ] **Step 6: Register** — in `core/shell/commands/index.ts` add `import { runtimeCommands } from "./runtime";` and append `...runtimeCommands` to `COMMANDS`.

- [ ] **Step 7: `/api/status`**

`server/status.ts`:

```ts
export function statusResponse(env: { GEMINI_API_KEY?: string }): Response {
  return new Response(JSON.stringify({ ai: Boolean(env.GEMINI_API_KEY) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
```

`app/api/status/route.ts`:

```ts
import { statusResponse } from "@/server/status";

export const dynamic = "force-dynamic";

export function GET() {
  return statusResponse({ GEMINI_API_KEY: process.env.GEMINI_API_KEY });
}
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run tests/shell tests/status.test.ts && npm test`
Expected: PASS. Any older test that builds a `ShellState` literal without `stats` must use `initialState(...)` — fix such a test by spreading `initialState(NOW)` (helpers already do).

- [ ] **Step 9: Commit**

```bash
git add core server app/api/status tests
git commit -m "feat(shell): v2 status, ps, top, env, graph --depth and /api/status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: v3 — `ask` command and the explain results tree

**Files:**
- Create: `core/shell/explain.ts`
- Modify: `core/shell/commands/info.ts` (add `ask`), `core/shell/execute.ts` (`isQuestion` leaves `ask …` to the command)
- Test: `tests/shell/explain.test.ts`

**Interfaces:**
- Consumes: `searchPortfolio`, `tokenize` (`core/search`), registry `out`/`seg`.
- Produces: `similar(a: string, b: string): boolean`, `interface ExplainLeaf { kind: "component" | "decision" | "technology" | "impact"; label: string; run: string }`, `interface ExplainNode { slug: string; name: string; children: ExplainLeaf[] }`, `explain(p: Portfolio, question: string, limit = 3): ExplainNode[]`, `explainLines(nodes: ExplainNode[]): OutputItem[]`. Consumed by Task 8 (rendered after each AI answer).

- [ ] **Step 1: Write the failing test `tests/shell/explain.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { explain, explainLines, similar } from "@/core/shell/explain";
import { run, textOf } from "./helpers";

describe("similar", () => {
  it("matches words sharing a 5-letter stem", () => {
    expect(similar("citations", "citation")).toBe(true);
    expect(similar("verify", "verifier")).toBe(true);
    expect(similar("rag", "rags")).toBe(false);
    expect(similar("graph", "graph")).toBe(true);
  });
});

describe("explain", () => {
  it("returns matching systems with real children", () => {
    const nodes = explain(portfolio, "how does atlas verify citations");
    expect(nodes[0].slug).toBe("atlas");
    expect(nodes[0].children).toContainEqual({ kind: "component", label: "Citation Verifier", run: "open atlas" });
    expect(nodes[0].children.length).toBeLessThanOrEqual(3);
  });

  it("only uses labels that exist in content", () => {
    for (const n of explain(portfolio, "hybrid retrieval agents kafka latency")) {
      const s = portfolio.systems.find((x) => x.slug === n.slug)!;
      const real = new Set([
        ...s.architecture.nodes.map((x) => x.label),
        ...s.decisions.map((d) => d.title),
        ...s.technologies.map((t) => portfolio.technologies.find((x) => x.id === t)!.name),
        ...(s.impact ?? []).map((i) => `${i.value} ${i.label}`),
      ]);
      for (const c of n.children) expect(real.has(c.label), c.label).toBe(true);
    }
  });

  it("returns nothing for unrelated questions", () => {
    expect(explain(portfolio, "favourite pizza topping")).toEqual([]);
    expect(explain(portfolio, "")).toEqual([]);
  });

  it("explain tolerates a minimal portfolio", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = [{ ...p.systems[p.systems.length - 1], decisions: [], impact: undefined }];
    expect(() => explain(p, "kafka pipeline")).not.toThrow();
  });

  it("renders a clickable tree", () => {
    const items = explainLines(explain(portfolio, "how does atlas verify citations"));
    const text = textOf(items);
    expect(text.split("\n")[0]).toBe("  related in this portfolio");
    expect(text).toMatch(/[├└]── component: Citation Verifier/);
    expect(explainLines([])).toEqual([]);
  });
});

describe("ask command", () => {
  it("asks the question without the command word", () => {
    expect(run('ask "what is atlas?"').res.effects).toEqual([{ type: "ask", question: "what is atlas?" }]);
    expect(run("ask what has been built with agents?").res.effects).toEqual([{ type: "ask", question: "what has been built with agents?" }]);
  });

  it("needs a question", () => {
    expect(run("ask").text).toBe("ask: missing question\nusage: ask <question…>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/explain.test.ts`
Expected: FAIL — `@/core/shell/explain` missing.

- [ ] **Step 3: Create `core/shell/explain.ts`**

```ts
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
```

- [ ] **Step 4: Add `ask` to `core/shell/commands/info.ts`** — before `export const infoCommands`:

```ts
const ask: Command = {
  name: "ask",
  group: "info",
  summary: "ask Kernel's AI about this portfolio",
  usage: "ask <question…>",
  description: [
    "Answers from this portfolio's content only (Gemini when configured, local search otherwise), then lists the related systems and the parts that match.",
    "You can also just type a question — `ask` is optional.",
  ],
  examples: ["ask what has been built with agents?", 'ask "how does atlas stay grounded?"'],
  seeAlso: ["grep", "man"],
  run(args) {
    const question = args.join(" ").trim();
    if (!question) return fail("ask: missing question", `usage: ${this.usage}`);
    return { effects: [{ type: "ask", question }] };
  },
};
```

and add `ask` to the `infoCommands` array.

- [ ] **Step 5: Let the `ask` command handle its own input** — in `isQuestion` (`core/shell/execute.ts`), add as the first line after `const first = words[0];`:

```ts
  if (first.toLowerCase() === "ask") return false;
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add core/shell tests/shell
git commit -m "feat(shell): v3 ask command and explain results tree

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: UI policy helpers and analytics sanitiser

**Files:**
- Create: `components/kernel/policy.ts`, `core/shell/analytics.ts`, `lib/analytics.ts`
- Test: `tests/shell/policy.test.ts`

**Interfaces:**
- Produces (`components/kernel/policy.ts`, pure, no React):
  - `splitRows<T extends { live?: boolean }>(rows: T[]): { settled: T[]; live: T[] }`
  - `optionId(listId: string, index: number): string`
  - `comboboxProps(menu: { items: unknown[]; index: number } | null, listId: string): { role: "combobox"; "aria-expanded": boolean; "aria-controls"?: string; "aria-activedescendant"?: string; "aria-autocomplete": "list" }`
  - `type MobileKeyId = "tab" | "up" | "cdup" | "ls" | "help" | "clear" | "cancel"`, `mobileKeys(busy: boolean): { id: MobileKeyId; label: string; disabled: boolean }[]`
  - `drainCount(buffered: number, elapsedMs: number, baseCps = 60, tauMs = 200): number`
- Produces (`core/shell/analytics.ts`): `commandName(line: string): string` → known command name, `"ask"` for questions, `"unknown"` otherwise, `""` for blank.
- Produces (`lib/analytics.ts`, client): `track(event: string, props?: Record<string, string>): void` — no-op unless `window.plausible` exists.
- Consumed by Task 8.

- [ ] **Step 1: Write the failing test `tests/shell/policy.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { comboboxProps, drainCount, mobileKeys, optionId, splitRows } from "@/components/kernel/policy";
import { commandName } from "@/core/shell/analytics";

describe("splitRows", () => {
  it("keeps in-progress rows out of the live region", () => {
    const rows = [{ id: 1 }, { id: 2, live: true }, { id: 3 }];
    expect(splitRows(rows)).toEqual({ settled: [{ id: 1 }, { id: 3 }], live: [{ id: 2, live: true }] });
  });
});

describe("comboboxProps", () => {
  it("describes the completion menu to assistive tech", () => {
    expect(comboboxProps(null, "c")).toEqual({ role: "combobox", "aria-expanded": false, "aria-autocomplete": "list" });
    expect(comboboxProps({ items: [1, 2], index: -1 }, "c")).toEqual({
      role: "combobox",
      "aria-expanded": true,
      "aria-controls": "c",
      "aria-autocomplete": "list",
    });
    expect(comboboxProps({ items: [1, 2], index: 1 }, "c")["aria-activedescendant"]).toBe(optionId("c", 1));
    expect(optionId("c", 1)).toBe("c-1");
  });
});

describe("mobileKeys", () => {
  it("disables keys while busy and offers ^C", () => {
    expect(mobileKeys(false).map((k) => k.id)).toEqual(["tab", "up", "cdup", "ls", "help", "clear"]);
    expect(mobileKeys(false).every((k) => !k.disabled)).toBe(true);
    const busy = mobileKeys(true);
    expect(busy.find((k) => k.id === "cancel")).toEqual({ id: "cancel", label: "^C", disabled: false });
    expect(busy.filter((k) => k.id !== "cancel").every((k) => k.disabled)).toBe(true);
  });
});

describe("drainCount", () => {
  const simulate = (initial: number) => {
    let buffered = initial;
    let t = 0;
    while (buffered > 0 && t < 10_000) {
      buffered -= drainCount(buffered, 16);
      t += 16;
    }
    return t;
  };

  it("drain rate catches up with large buffers", () => {
    expect(simulate(5_000)).toBeLessThanOrEqual(1_300);
  });

  it("still types short answers visibly", () => {
    expect(simulate(40)).toBeGreaterThanOrEqual(200);
  });

  it("never stalls or overshoots", () => {
    expect(drainCount(1, 1)).toBe(1);
    expect(drainCount(3, 1000)).toBe(3);
    expect(drainCount(0, 16)).toBe(0);
  });
});

describe("commandName", () => {
  it("records only the command name", () => {
    expect(commandName("grep -i secret-project .")).toBe("grep");
    expect(commandName("what is atlas?")).toBe("ask");
    expect(commandName("ask how does relay work")).toBe("ask");
    expect(commandName("rm -rf /")).toBe("unknown");
    expect(commandName("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/policy.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create `components/kernel/policy.ts`**

```ts
// Pure UI policy for the shell — unit-tested, imported by Shell.tsx.

export function splitRows<T extends { live?: boolean }>(rows: T[]): { settled: T[]; live: T[] } {
  return { settled: rows.filter((r) => !r.live), live: rows.filter((r) => r.live) };
}

export const optionId = (listId: string, index: number) => `${listId}-${index}`;

export function comboboxProps(
  menu: { items: unknown[]; index: number } | null,
  listId: string,
): { role: "combobox"; "aria-expanded": boolean; "aria-controls"?: string; "aria-activedescendant"?: string; "aria-autocomplete": "list" } {
  return {
    role: "combobox",
    "aria-expanded": Boolean(menu),
    ...(menu ? { "aria-controls": listId } : {}),
    ...(menu && menu.index >= 0 ? { "aria-activedescendant": optionId(listId, menu.index) } : {}),
    "aria-autocomplete": "list",
  };
}

export type MobileKeyId = "tab" | "up" | "cdup" | "ls" | "help" | "clear" | "cancel";

export function mobileKeys(busy: boolean): { id: MobileKeyId; label: string; disabled: boolean }[] {
  const keys: { id: MobileKeyId; label: string }[] = [
    { id: "tab", label: "Tab" },
    { id: "up", label: "↑" },
    { id: "cdup", label: "cd .." },
    { id: "ls", label: "ls" },
    { id: "help", label: "help" },
    { id: "clear", label: "clear" },
  ];
  return [
    ...keys.map((k) => ({ ...k, disabled: busy })),
    ...(busy ? [{ id: "cancel" as const, label: "^C", disabled: false }] : []),
  ];
}

/**
 * Characters to reveal this frame for the typewriter: a steady base rate plus a share of the backlog,
 * so short answers visibly type and large bursts catch up within about a second.
 */
export function drainCount(buffered: number, elapsedMs: number, baseCps = 60, tauMs = 200): number {
  if (buffered <= 0) return 0;
  const n = Math.ceil((baseCps * elapsedMs) / 1000 + (buffered * elapsedMs) / tauMs);
  return Math.min(buffered, Math.max(1, n));
}
```

- [ ] **Step 4: Create `core/shell/analytics.ts`**

```ts
import { getCommand } from "./commands";
import { isQuestion } from "./execute";

/** The only thing analytics may record about a shell line: which command ran. Never arguments or questions. */
export function commandName(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  const first = trimmed.split(/\s+/)[0].toLowerCase();
  if (first === "ask" || isQuestion(trimmed)) return "ask";
  return getCommand(first)?.name ?? "unknown";
}
```

- [ ] **Step 5: Create `lib/analytics.ts`**

```ts
"use client";

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/** Sends an event only when the Plausible script is loaded (NEXT_PUBLIC_PLAUSIBLE_DOMAIN set). */
export function track(event: string, props?: Record<string, string>) {
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the app */
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/shell/policy.test.ts && npx vitest run tests/shell`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/kernel/policy.ts core/shell/analytics.ts lib/analytics.ts tests/shell/policy.test.ts
git commit -m "feat(shell): UI policy helpers (live region, combobox, mobile keys, typewriter) and analytics sanitiser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Shell integration — live region, combobox, typewriter, explain tree, runtime env, deep links, mobile keys, view transitions

**Files:**
- Modify: `core/shell/commands/actions.ts` (`open --full`), `components/kernel/Transcript.tsx` (`Row.live`), `components/kernel/ViewPane.tsx` (view-transition names, title), `components/shell/Overlays.tsx` (⌘K focuses the shell on `/`), `app/(gui)/systems/[slug]/page.tsx` (matching view-transition names), `app/globals.css` (view-transition CSS)
- Replace: `components/kernel/Shell.tsx`
- Test: `tests/shell/actions.test.ts` (append `open --full`)

**Interfaces:**
- Consumes: Task 2 `parseDeepLink → { commands, notices }`; Task 5 `RuntimeEnv`, `execute(…, { env })`, `ShellState.stats`; Task 6 `explain`, `explainLines`; Task 7 `splitRows`, `comboboxProps`, `optionId`, `mobileKeys`, `drainCount`, `commandName`, `track`; existing `blockWhileBusy`, `tabDecision` (`components/kernel/keys.ts`); React `ViewTransition`, `startTransition`.
- Produces: `Row = { id; kind: "prompt"; cwd; text } | { id; kind: "item"; item; live?: boolean }`; `open <system> --full` effect `navigate /systems/<slug>`; view-transition names `kernel-pane`, `system-title-<slug>`, `system-arch-<slug>`.

- [ ] **Step 1: Write the failing test** — append to `tests/shell/actions.test.ts` inside `describe("open", …)`:

```ts
  it("opens the full case study with --full", () => {
    expect(run("open atlas --full").res.effects).toEqual([{ type: "navigate", href: "/systems/atlas" }]);
    expect(run("open graph --full").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shell/actions.test.ts`
Expected: FAIL — `unknown flag --full`.

- [ ] **Step 3: Add `--full` to `open` in `core/shell/commands/actions.ts`** — add to the `open` command:

```ts
  flags: { full: { describe: "for a system, open the full visual case study instead of the side pane" } },
```

change its `examples` to `["open atlas", "open atlas --full", "open graph", "open resume", "open trace"]`, change `run(args, _flags, ctx)` to `run(args, flags, ctx)`, and replace the system line

```ts
    if (ctx.p.systems.some((s) => s.slug === t)) return { effects: [{ type: "openView", view: { type: "architecture", slug: t } }] };
```

with

```ts
    if (ctx.p.systems.some((s) => s.slug === t)) {
      return flags.full
        ? { effects: [{ type: "navigate", href: `/systems/${t}` }] }
        : { effects: [{ type: "openView", view: { type: "architecture", slug: t } }] };
    }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS.

- [ ] **Step 5: `components/kernel/Transcript.tsx`** — change the `Row` type to:

```ts
export type Row =
  | { id: number; kind: "prompt"; cwd: string[]; text: string }
  | { id: number; kind: "item"; item: OutputItem; live?: boolean };
```

- [ ] **Step 6: `components/kernel/ViewPane.tsx`** — add `import { ViewTransition } from "react";` (merge with the existing `react` import) and replace the body of `ArchitecturePane`'s returned JSX opening (the `<div className="space-y-3">` and the diagram frame) so it reads:

```tsx
    <div className="space-y-3">
      <ViewTransition name={`system-title-${slug}`} share="morph" default="none">
        <h3 className="text-sm font-semibold text-text">{system.name}</h3>
      </ViewTransition>
      <ViewTransition name={`system-arch-${slug}`} share="morph" default="none">
        <div className="overflow-x-auto rounded border border-border bg-bg [&_svg]:min-w-0">
          <ArchitectureDiagram architecture={system.architecture} focusId={hover} activeId={activeId} motion={motion} onHover={setHover} onSelect={setHover} />
        </div>
      </ViewTransition>
```

(the inspector `<div className="min-h-16 …">` that follows is unchanged).

- [ ] **Step 7: Case study names in `app/(gui)/systems/[slug]/page.tsx`** — add `import { ViewTransition } from "react";`. Wrap the `<h1 …>{system.name}</h1>` as:

```tsx
        <ViewTransition name={`system-title-${system.slug}`} share="morph" default="none">
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{system.name}</h1>
        </ViewTransition>
```

and wrap the `<ArchitectureExplorer … />` element as:

```tsx
        <ViewTransition name={`system-arch-${system.slug}`} share="morph" default="none">
          <div>
            <ArchitectureExplorer architecture={system.architecture} simulation={system.simulation} techNames={techNames} />
          </div>
        </ViewTransition>
```

- [ ] **Step 8: View-transition CSS** — append to `app/globals.css`:

```css
/* View transitions (React <ViewTransition>): gentle morphs, none for reduced motion or recruiter mode */
::view-transition-group(.morph) {
  animation-duration: 380ms;
}
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 180ms;
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
:root[data-recruiter="on"]::view-transition-group(*),
:root[data-recruiter="on"]::view-transition-old(*),
:root[data-recruiter="on"]::view-transition-new(*) {
  animation: none !important;
}
```

Also extend the recruiter kill list (A3.6) — change the selector list that starts `:root[data-recruiter="on"] .motion-optional,` to also include `:root[data-recruiter="on"] .animate-fade-up,` and `:root[data-recruiter="on"] .cursor-blink,`.

- [ ] **Step 9: ⌘K focuses the shell on `/`** — in `components/shell/Overlays.tsx` replace

```ts
        if (pathname !== "/") router.push("/");
        return;
```

with

```ts
        if (pathname !== "/") router.push("/");
        else document.querySelector<HTMLInputElement>('input[aria-label="Kernel shell input"]')?.focus();
        return;
```

- [ ] **Step 10: Replace `components/kernel/Shell.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { createLineDecoder } from "@/components/query/stream";
import { validateAction, type UiAction } from "@/core/actions";
import { getSystem, portfolio } from "@/core/content";
import type { GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { commandName } from "@/core/shell/analytics";
import { COMMANDS } from "@/core/shell/commands";
import { autosuggest, commonPrefix, complete, describeCandidates, type MenuItem } from "@/core/shell/complete";
import { parseDeepLink } from "@/core/shell/deeplink";
import { execute, HISTORY_LIMIT, initialState } from "@/core/shell/execute";
import { explain, explainLines } from "@/core/shell/explain";
import { pathOf } from "@/core/shell/fs";
import { out, seg } from "@/core/shell/registry";
import { styleLine } from "@/core/shell/style";
import type { Effect, HistoryEntry, OutputItem, RuntimeEnv, Seg, ShellState, View } from "@/core/shell/types";
import { bootLines } from "@/core/shell/welcome";
import { track } from "@/lib/analytics";
import { kernel, useKernel } from "@/lib/store";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import type { QueryEvent } from "@/server/query-handler";
import { blockWhileBusy, tabDecision } from "./keys";
import { comboboxProps, drainCount, mobileKeys, optionId, splitRows, type MobileKeyId } from "./policy";
import { PromptText, Transcript, type Row } from "./Transcript";
import { ViewPane } from "./ViewPane";

const HISTORY_KEY = "kernel:history";
const BOOT_KEY = "kernel:booted";
const LIST_ID = "kernel-completions";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

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

const answerLine = (text: string, suffix: Seg[] = []): OutputItem => ({
  line: [seg("▸ ", "accent"), ...(text || "…").split("\n").flatMap((l, i) => [...(i ? [seg("\n")] : []), ...styleLine(l)]), ...suffix],
});

type Pane = { view: View; activeId: string | null } | null;
type Search = { query: string; skip: number };
type Ai = RuntimeEnv["ai"];

export function Shell({ graph, initial }: { graph: { nodes: PositionedNode[]; edges: GraphEdge[] }; initial: OutputItem[] }) {
  const router = useRouter();
  const motion = useMotionAllowed();
  const theme = useKernel((s) => s.theme);
  const recruiter = useKernel((s) => s.recruiter);
  const motionRef = useRef(motion);

  const idRef = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((item, i) => ({ id: i + 1, kind: "item", item })));
  const stateRef = useRef<ShellState>(initialState(0));
  const [cwd, setCwd] = useState<string[]>([]);
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [histCursor, setHistCursor] = useState<number | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  const [menu, setMenu] = useState<{ items: MenuItem[]; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pane, setPaneState] = useState<Pane>(null);
  const [ai, setAi] = useState<Ai>("unknown");
  const [clock, setClock] = useState("");
  const envRef = useRef<RuntimeEnv>({ theme: "dark", motion: "full", recruiter: false, ai: "unknown", pane: null });
  const cancel = useRef<{ cancelled: boolean; abort?: AbortController }>({ cancelled: false });
  const aiHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    motionRef.current = motion;
    envRef.current = {
      theme,
      motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full",
      recruiter,
      ai,
      pane: pane?.view.type ?? null,
    };
  }, [motion, theme, recruiter, ai, pane]);

  /** Pane open/close/switch animates (view transition); activeId changes during a simulation do not. */
  const showPane = useCallback((next: Pane) => startTransition(() => setPaneState(next)), []);

  const add = useCallback((items: OutputItem[], live = false) => {
    const created: Row[] = items.map((item) => ({ id: ++idRef.current, kind: "item", item, ...(live ? { live } : {}) }));
    setRows((r) => [...r, ...created]);
    return created.map((c) => c.id);
  }, []);

  const replace = useCallback((id: number, item: OutputItem, live = false) => {
    setRows((r) => r.map((row) => (row.id === id ? { id, kind: "item", item, ...(live ? { live } : {}) } : row)));
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
  }, [rows, busy, search, menu]);

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
      showPane({ view: { type: "architecture", slug }, activeId: null });
      add([out(seg("▶ ", "accent"), seg(system.name, "heading"), seg(`  "${system.simulation.prompt}"`, "muted"))]);
      const t0 = performance.now();
      for (const step of system.simulation.steps) {
        if (cancel.current.cancelled) break;
        setPaneState({ view: { type: "architecture", slug }, activeId: step.nodeId });
        const label = seg(`  [${step.title}]`.padEnd(15), "accent");
        const [rowId] = add([out(label, seg("─".repeat(W), "faint"), seg(`  ${step.detail}`, "muted"))], true);
        const bar = (filled: number, done: boolean) =>
          out(label, seg("━".repeat(filled), "accent"), seg("─".repeat(W - filled), "faint"), seg(`  ${step.detail}`, done ? "text" : "muted"));
        const frames = motionRef.current ? W : 1;
        let filled = 0;
        for (let f = 1; f <= frames; f++) {
          if (cancel.current.cancelled) break;
          if (motionRef.current) await sleep((step.durationMs * 0.7) / frames);
          filled = Math.round((f / frames) * W);
          replace(rowId, bar(filled, false), true);
        }
        replace(rowId, bar(filled, filled === W)); // settle into the log at its real progress
      }
      setPaneState({ view: { type: "architecture", slug }, activeId: null });
      if (cancel.current.cancelled) add([out(seg("^C interrupted", "error"))]);
      else {
        stateRef.current = { ...stateRef.current, stats: { ...stateRef.current.stats, simulations: stateRef.current.stats.simulations + 1 } };
        add([out(seg(`  ✓ completed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, "ok"), seg("  (simulated walkthrough)", "faint"))]);
      }
    },
    [add, replace, showPane],
  );

  const applyAction = useCallback(
    (raw: UiAction) => {
      const a = validateAction(raw, portfolio);
      if (!a) {
        if (process.env.NODE_ENV !== "production") console.debug("[kernel] dropped action", raw);
        return;
      }
      if (a.type === "openSystem") showPane({ view: { type: "architecture", slug: a.slug }, activeId: null });
      else if (a.type === "highlightGraph") showPane({ view: { type: "graph", focus: a.ids }, activeId: null });
      else if (a.type === "filterSystems") showPane({ view: { type: "graph", focus: [a.tech ? `tech:${a.tech}` : `cap:${a.capability}`] }, activeId: null });
      else if (a.type === "navigate") {
        const system = /^\/systems\/([a-z0-9-]+)$/.exec(a.path);
        if (system) showPane({ view: { type: "architecture", slug: system[1] }, activeId: null });
        else {
          const page = a.path.replace(/^\//, "") || "systems";
          add([out(seg("  → ", "faint"), seg(`gui ${page}`, "accent", { run: `gui ${page}` }), seg(" to open it visually", "faint"))]);
        }
      } else add([out(seg("  → ", "faint"), seg("recruiter", "accent", { run: "recruiter" }), seg(" for the one-screen summary", "faint"))]);
    },
    [add, showPane],
  );

  const ask = useCallback(
    async (question: string) => {
      const abort = new AbortController();
      cancel.current.abort = abort;
      const [rowId] = add([out(seg("▸ ", "accent"), seg("thinking…", "faint"))], true);
      let received = "";
      let shown = 0;
      let streaming = true;
      let sources: string[] = [];

      // Typewriter: reveal the received text at a steady rate that catches up with bursts (instant without motion).
      const pump = (async () => {
        let last = performance.now();
        while (streaming || shown < received.length) {
          if (cancel.current.cancelled) return;
          const now = await nextFrame();
          const backlog = received.length - shown;
          const n = motionRef.current ? drainCount(backlog, now - last) : backlog;
          last = now;
          if (n > 0) {
            shown += n;
            replace(rowId, answerLine(received.slice(0, shown)), true);
          }
        }
      })();

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
          streaming = false;
          await pump;
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
          } else if (e.type === "text") received += e.text;
          else if (e.type === "action" || e.type === "suggestion") applyAction(e.action);
          else if (e.type === "error") add([out(seg(e.message, "error"))]);
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lines.push(decoder.decode(value, { stream: true }));
        }
        lines.flush();
        streaming = false;
        await pump;
        replace(rowId, answerLine(received));
        if (received) aiHistory.current = [...aiHistory.current, { role: "assistant" as const, content: received.slice(0, 1500) }];
        else aiHistory.current.pop();
        if (sources.length) add([out(seg(`  sources: ${sources.join(" · ")}`, "faint"))]);
        add(explainLines(explain(portfolio, question)));
      } catch {
        streaming = false;
        if (cancel.current.cancelled) replace(rowId, answerLine(received.slice(0, shown), [seg(" ^C", "faint")]));
        else replace(rowId, out(seg("▸ ", "error"), seg("network error — try again", "error")));
        aiHistory.current.pop();
      }
    },
    [add, applyAction, replace],
  );

  const perform = useCallback(
    async (e: Effect) => {
      switch (e.type) {
        case "openView":
          showPane({ view: e.view, activeId: null });
          return;
        case "closeView":
          showPane(null);
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
    [ask, playSimulation, router, showPane],
  );

  const run = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      cancel.current = { cancelled: false };
      // Capture before execute(): the updater runs later, after stateRef has moved on.
      const promptRow: Row = { id: ++idRef.current, kind: "prompt", cwd: stateRef.current.cwd, text: raw };
      setRows((r) => [...r, promptRow]);
      setInput("");
      setCaret(0);
      setHistCursor(null);
      setSearch(null);
      setMenu(null);
      const name = commandName(raw);
      if (name) track("command", { command: name });
      try {
        const res = execute(raw, stateRef.current, portfolio, Date.now(), { env: envRef.current });
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

  const cancelRunning = () => {
    cancel.current.cancelled = true;
    cancel.current.abort?.abort();
  };

  // ---------- boot, AI status, deep links ----------

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
    fetch("/api/status")
      .then((r) => r.json() as Promise<{ ai?: boolean }>)
      .then((d) => setAi(d.ai ? "online" : "offline"))
      .catch(() => {});
    void (async () => {
      setHistoryList(restored);
      if (firstVisit && !reduced && link.commands.length === 0) {
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
      for (const notice of link.notices) add([out(seg(notice, "faint"))]);
      for (const command of link.commands) await run(command);
      inputRef.current?.focus({ preventScroll: true });
    })();
  }, [add, run]);

  // ---------- input ----------

  const candidates = useMemo(() => (search || !input ? [] : complete(input, cwd, portfolio, COMMANDS)), [input, cwd, search]);
  // fish-style: newest matching history entry first, then the first completion candidate
  const suggestion = caret === input.length && !menu ? autosuggest(input, historyList, candidates) : "";
  const searchMatch = useMemo(() => {
    if (!search || !search.query) return null;
    const hits = [...historyList].reverse().filter((c) => c.includes(search.query));
    return hits.length ? hits[Math.min(search.skip, hits.length - 1)] : null;
  }, [search, historyList]);

  // zsh-style: complete, extend to the common prefix, then open a menu that Tab / Shift+Tab cycles through.
  const completeNow = (back = false) => {
    if (menu) {
      const n = menu.items.length;
      const index = menu.index < 0 ? (back ? n - 1 : 0) : (menu.index + (back ? -1 : 1) + n) % n;
      setMenu({ ...menu, index });
      setInput(menu.items[index].value);
      setCaretAt(menu.items[index].value.length);
      return;
    }
    if (candidates.length === 1) {
      setInput(candidates[0]);
      setCaretAt(candidates[0].length);
    } else if (candidates.length > 1) {
      const prefix = commonPrefix(candidates);
      if (prefix.length > input.length) {
        setInput(prefix);
        setCaretAt(prefix.length);
      } else {
        setMenu({ items: describeCandidates(candidates, cwd, portfolio, COMMANDS), index: -1 });
      }
    }
  };

  const pickFromMenu = (item: MenuItem) => {
    setMenu(null);
    setInput(item.value);
    setCaretAt(item.value.length);
    inputRef.current?.focus({ preventScroll: true });
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
      if (busyRef.current) cancelRunning();
      else {
        setRows((r) => [...r, { id: ++idRef.current, kind: "prompt", cwd, text: `${search ? "" : input}^C` }]);
        setInput("");
        setCaret(0);
        setSearch(null);
      }
      return;
    }
    if (busyRef.current) {
      if (blockWhileBusy({ key: k, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey })) e.preventDefault();
      return;
    }
    if (k === "Escape") {
      e.nativeEvent.stopImmediatePropagation();
      if (menu) setMenu(null);
      else if (search) setSearch(null);
      else showPane(null);
      return;
    }
    if (menu) {
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        completeNow(k === "ArrowUp");
        return;
      }
      if (k === "Enter" && menu.index >= 0) {
        e.preventDefault();
        setMenu(null);
        return;
      }
      if (k !== "Tab" && !["Shift", "Control", "Alt", "Meta"].includes(k)) setMenu(null);
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
      showPane(null);
    } else if (k === "Enter") {
      e.preventDefault();
      void run(input);
    } else if (k === "Tab") {
      if (tabDecision({ input, menuOpen: Boolean(menu), busy: busyRef.current }) === "pass") return;
      e.preventDefault();
      completeNow(e.shiftKey);
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
  const { settled, live } = splitRows(rows);
  const keyActions: Record<MobileKeyId, () => void> = {
    tab: () => completeNow(),
    up: historyPrev,
    cdup: () => runFromClick("cd .."),
    ls: () => runFromClick("ls"),
    help: () => runFromClick("help"),
    clear: () => setRows([]),
    cancel: cancelRunning,
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg font-mono text-[13px] leading-[1.65] text-text">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] text-faint">
        <span className="size-2.5 rounded-full bg-[var(--k-model)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-queue)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-store)]" aria-hidden="true" />
        <span className="ml-3 truncate">kernel — {pathOf(cwd)}</span>
        <Link href="/systems" className="ml-auto hover:text-text">
          gui ↗
        </Link>
        <button type="button" onClick={kernel.toggleTheme} className="hover:text-text" aria-label="Toggle theme">
          ◐
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6"
          onMouseUp={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
          }}
        >
          <div role="log" aria-live="polite" aria-label="Kernel shell output">
            <Transcript rows={settled} onRun={runFromClick} />
          </div>
          {live.length > 0 && (
            <div aria-hidden="true">
              <Transcript rows={live} onRun={runFromClick} />
            </div>
          )}
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
                setMenu(null);
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
              {...comboboxProps(menu, LIST_ID)}
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
          </label>
          {menu && (
            <div id={LIST_ID} role="listbox" aria-label="Completions" className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 border-t border-border pt-1">
              {menu.items.map((item, i) => (
                <button
                  key={item.value}
                  id={optionId(LIST_ID, i)}
                  type="button"
                  role="option"
                  aria-selected={i === menu.index}
                  onPointerDown={(ev) => ev.preventDefault()}
                  onClick={() => pickFromMenu(item)}
                  className={`flex min-w-0 gap-2 rounded-sm px-1 text-left ${i === menu.index ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                >
                  <span className={i === menu.index ? "text-accent" : "text-text"}>{item.label}</span>
                  <span className="truncate text-faint">{item.detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {pane && (
          <ViewTransition name="kernel-pane">
            <div className="h-[42%] shrink-0 border-t border-border md:h-auto md:w-[46%] md:min-w-[420px] md:border-t-0">
              <ViewPane view={pane.view} activeId={pane.activeId} graph={graph} onClose={() => showPane(null)} onRun={runFromClick} />
            </div>
          </ViewTransition>
        )}
      </div>

      <div className="hidden shrink-0 gap-1.5 overflow-x-auto border-t border-border px-2 py-1.5 [@media(pointer:coarse)]:flex" aria-label="Shell keys">
        {mobileKeys(busy).map((key) => (
          <button
            key={key.id}
            type="button"
            disabled={key.disabled}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              keyActions[key.id]();
              inputRef.current?.focus({ preventScroll: true });
            }}
            className={`shrink-0 rounded border px-2.5 py-1 text-[12px] disabled:opacity-40 ${key.id === "cancel" ? "border-accent text-accent" : "border-border text-muted"}`}
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

- [ ] **Step 11: Verify statically**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean; all tests pass. If lint flags `react-hooks/set-state-in-effect` on the mount effect's `fetch(...).then(setAi)` (it should not — the call is async), leave it; if it flags the clock `tick()`, wrap the first call in `requestAnimationFrame(tick)`. If `ViewTransition` props `share`/`default` are rejected by the installed `@types/react`, check `node_modules/@types/react/index.d.ts` `ViewTransitionProps` and use the documented prop names.

- [ ] **Step 12: Build and browser-verify** (production server on :3100, Playwright, Chromium)

```bash
rm -rf .next && npm run build && (npm run start -- -p 3100 > /tmp/kernel-start.log 2>&1 &) && sleep 5
```

Check, at 1440×900 then 390×844:
1. `run atlas`: steps settle one by one; the `role="log"` region never contains a half-filled bar (inspect DOM mid-run: in-progress row is inside the `aria-hidden` sibling).
2. `what's the stack` (or any question): text types out progressively (motion on), appears at once under reduced motion; afterwards `related in this portfolio` tree appears when matches exist and its leaves run commands.
3. Ctrl+C during an answer keeps the partial text followed by `^C`.
4. Type `gr`, Tab Tab: input has `aria-expanded="true"`, `aria-controls="kernel-completions"`, `aria-activedescendant="kernel-completions-0"`.
5. `/?cmd=pwd;ls` runs both; `/?cmd=` with 7 commands prints the "skipped 2 more commands" notice.
6. `status` shows `query ONLINE/OFFLINE` matching `/api/status`; `env` shows `THEME`/`MOTION` matching the UI; after `run atlas`, `top` shows `simulations 1`.
7. `open atlas` then `graph`: the pane crossfades (Chromium); `open atlas --full` navigates to `/systems/atlas` with the title/diagram morph; none of this animates under reduced motion or recruiter mode.
8. Click somewhere outside the input on `/`, press ⌘K/Ctrl+K: focus returns to the shell input.
9. Mobile (touch emulation): while `run atlas` is running, keys are disabled and `^C` appears and cancels.
10. `gui ↗` is a link (`<a href="/systems">`).
11. No console errors or hydration warnings.

Kill the server afterwards: `lsof -ti tcp:3100 | xargs kill`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(shell): integrate live region, combobox a11y, typewriter answers, explain tree, runtime env, view transitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Query panel and theme fixes (A3.5–A3.8, dialog focus)

**Files:**
- Create: `lib/theme-color.ts`
- Modify: `components/query/QueryPanel.tsx`, `lib/store.ts`, `app/layout.tsx`
- Test: `tests/theme-color.test.ts`

**Interfaces:**
- Produces: `THEME_COLORS = { dark: "#0e0f11", light: "#f6f4ef" }`, `themeColorFor(theme: string | null): string`, `applyThemeColor(theme: "dark" | "light"): void` (DOM; creates/updates `<meta name="theme-color">`).

- [ ] **Step 1: Write the failing test `tests/theme-color.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { THEME_COLORS, themeColorFor } from "@/lib/theme-color";

describe("themeColorFor", () => {
  it("follows the site theme, defaulting to dark", () => {
    expect(themeColorFor("light")).toBe(THEME_COLORS.light);
    expect(themeColorFor("dark")).toBe(THEME_COLORS.dark);
    expect(themeColorFor(null)).toBe(THEME_COLORS.dark);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme-color.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `lib/theme-color.ts`**

```ts
export const THEME_COLORS = { dark: "#0e0f11", light: "#f6f4ef" } as const;

export function themeColorFor(theme: string | null): string {
  return theme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;
}

/** Keeps the browser chrome colour in step with the site theme (not the OS preference). */
export function applyThemeColor(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColorFor(theme);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/theme-color.test.ts`
Expected: PASS.

- [ ] **Step 5: Theme colour wiring**

In `app/layout.tsx`: delete the `export const viewport: Viewport = { … };` block and remove `Viewport` from the `next` type import. Replace the `themeScript` constant with:

```ts
// Runs before paint: restores theme + recruiter mode and sets the browser chrome colour from the site theme.
const themeScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("kernel:theme");if(t)d.dataset.theme=t;if(s.getItem("kernel:recruiter")==="on")d.dataset.recruiter="on";var m=document.createElement("meta");m.name="theme-color";m.content=t==="light"?"#f6f4ef":"#0e0f11";document.head.appendChild(m);}catch(e){}})();`;
```

In `lib/store.ts`: add `import { applyThemeColor } from "./theme-color";` and in `toggleTheme()` add `applyThemeColor(theme);` after `document.documentElement.dataset.theme = theme;`.

- [ ] **Step 6: `components/query/QueryPanel.tsx`**

(a) Imports — change `import { AnimatePresence, motion } from "motion/react";` to `import { AnimatePresence, MotionConfig, motion } from "motion/react";` and add `import { useMotionAllowed } from "@/lib/use-motion-allowed";`.

(b) In the component body, after `const runAction = useRunAction();` add:

```ts
  const motionAllowed = useMotionAllowed();
  const returnFocus = useRef<HTMLElement | null>(null);
```

(c) Replace the focus effect

```ts
  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
```

with

```ts
  // Dialog focus: move in on open, return to where the visitor was on close.
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else if (returnFocus.current) {
      returnFocus.current.focus?.();
      returnFocus.current = null;
    }
  }, [open]);
```

(d) Log dropped actions in development — replace `if (!action) return;` (inside the `e.type === "action"` branch) with:

```ts
          if (!action) {
            if (process.env.NODE_ENV !== "production") console.debug("[kernel] dropped action", e.action);
            return;
          }
```

and replace `if (action) updateLast((m) => ({ ...m, suggestions: [...(m.suggestions ?? []), action] }));` with:

```ts
          if (action) updateLast((m) => ({ ...m, suggestions: [...(m.suggestions ?? []), action] }));
          else if (process.env.NODE_ENV !== "production") console.debug("[kernel] dropped suggestion", e.action);
```

(e) Badge follows the latest answer — replace `{messages.some((m) => m.mode === "local") && (` with `{[...messages].reverse().find((m) => m.role === "assistant")?.mode === "local" && (`.

(f) Modal semantics — directly after `role="dialog"` add the line `aria-modal="true"`.

(g) Reduced motion and recruiter mode for the overlay — change `    <AnimatePresence>` (the first JSX line of the `return`) to

```tsx
    <MotionConfig reducedMotion={motionAllowed ? "never" : "always"}>
      <AnimatePresence>
```

and the closing `    </AnimatePresence>` (last line before `  );`) to

```tsx
      </AnimatePresence>
    </MotionConfig>
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test && rm -rf .next && npm run build`
Expected: clean.

Browser (production server on :3100): on `/systems` press `/` → panel opens with focus in the textarea; Esc → focus returns to the element focused before (`document.activeElement`); toggle theme → `document.querySelector('meta[name="theme-color"]').content` flips between `#0e0f11` and `#f6f4ef`; with recruiter mode on or reduced motion, the panel appears without the slide. Ask a question (offline, no key): the badge shows "offline mode"; after `clear` in the panel it disappears.

- [ ] **Step 8: Commit**

```bash
git add lib components/query/QueryPanel.tsx app/layout.tsx tests/theme-color.test.ts
git commit -m "fix(ui): query dialog focus + modal, motion config, accurate offline badge, dev action logging, theme-colored browser chrome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Share cards, sitemap, robots, apple icon, analytics hook (Part B)

**Files:**
- Create: `lib/site.ts`, `lib/og.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `app/(gui)/systems/[slug]/opengraph-image.tsx`, `app/apple-icon.tsx`, `app/sitemap.ts`, `app/robots.ts`, `components/shell/Analytics.tsx`
- Modify: `app/layout.tsx` (`metadataBase`, `openGraph`, `twitter`, `<Analytics />`)
- Test: `tests/seo.test.ts`

**Interfaces:**
- Produces: `siteUrl(): string` (from `NEXT_PUBLIC_SITE_URL`, trailing slash trimmed, default `http://localhost:3000`); `OG_SIZE = { width: 1200, height: 630 }`; `shareCard(card: { eyebrow: string; title: string; subtitle: string; prompt: string; footer: string }): ImageResponse`; `Analytics()` (renders Plausible only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set).

- [ ] **Step 1: Write the failing test `tests/seo.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { Analytics } from "@/components/shell/Analytics";
import { portfolio } from "@/core/content";
import { siteUrl } from "@/lib/site";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev/";
    expect(siteUrl()).toBe("https://kernel.example.dev");
  });
});

describe("sitemap", () => {
  it("lists the shell, gui pages and every system", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev";
    const urls = sitemap().map((e) => e.url);
    for (const path of ["", "/systems", "/graph", "/trace", "/human", "/connect"]) expect(urls).toContain(`https://kernel.example.dev${path}`);
    for (const s of portfolio.systems) expect(urls).toContain(`https://kernel.example.dev/systems/${s.slug}`);
  });
});

describe("robots", () => {
  it("allows crawling except the API and points at the sitemap", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev";
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: "/api/" });
    expect(r.sitemap).toBe("https://kernel.example.dev/sitemap.xml");
  });
});

describe("Analytics", () => {
  it("renders nothing unless configured", () => {
    expect(Analytics()).toBeNull();
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "kernel.example.dev";
    expect(Analytics()).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/seo.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create `lib/site.ts`**

```ts
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
```

- [ ] **Step 4: Create `app/sitemap.ts` and `app/robots.ts`**

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { getSystems } from "@/core/content";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    ...["/systems", "/graph", "/trace", "/human", "/connect"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...getSystems().map((s) => ({ url: `${base}/systems/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: Create `components/shell/Analytics.tsx`**

```tsx
import Script from "next/script";

/** Privacy-friendly analytics (Plausible): no cookies, nothing personal. Off unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <>
      <Script id="plausible-queue" strategy="afterInteractive">
        {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};"}
      </Script>
      <Script defer data-domain={domain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
    </>
  );
}
```

- [ ] **Step 6: Run SEO tests**

Run: `npx vitest run tests/seo.test.ts`
Expected: PASS.

- [ ] **Step 7: Create `lib/og.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

const C = { bg: "#0e0f11", surface: "#141619", border: "#272b31", text: "#ece8e1", muted: "#a19d94", faint: "#6e6b65", accent: "#e8a23b", dir: "#7aa2c8" };

export function shareCard(card: { eyebrow: string; title: string; subtitle: string; prompt: string; footer: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, padding: 56 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#d7826b" }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#c9b46b" }} />
            <div style={{ width: 14, height: 14, borderRadius: 7, background: "#78b39a" }} />
            <div style={{ marginLeft: 16, color: C.faint, fontSize: 22 }}>kernel — ~</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "40px 48px", flex: 1 }}>
            <div style={{ color: C.accent, fontSize: 26, letterSpacing: 2 }}>{card.eyebrow}</div>
            <div style={{ color: C.text, fontSize: 68, fontWeight: 700, marginTop: 18 }}>{card.title}</div>
            <div style={{ color: C.muted, fontSize: 32, marginTop: 14 }}>{card.subtitle}</div>
            <div style={{ display: "flex", marginTop: "auto", fontSize: 28 }}>
              <span style={{ color: C.accent }}>kernel</span>
              <span style={{ color: C.dir, marginLeft: 12 }}>~</span>
              <span style={{ color: C.faint, marginLeft: 12 }}>$</span>
              <span style={{ color: C.text, marginLeft: 12 }}>{card.prompt}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: C.faint, fontSize: 22, marginTop: 20 }}>
          <span>{card.footer}</span>
          <span>KERNEL</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
```

- [ ] **Step 8: Create the image routes**

```tsx
// app/opengraph-image.tsx
import { getIdentity, getSystems, portfolio } from "@/core/content";
import { OG_SIZE, shareCard } from "@/lib/og";

export const alt = "Kernel — an interactive engineering portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const id = getIdentity();
  const runnable = getSystems().find((s) => s.simulation) ?? getSystems()[0];
  return shareCard({
    eyebrow: id.role.toUpperCase(),
    title: id.name,
    subtitle: id.tagline,
    prompt: runnable ? `run ${runnable.slug}` : "ls systems",
    footer: `${portfolio.systems.length} systems · ${portfolio.capabilities.length} capabilities`,
  });
}
```

```tsx
// app/twitter-image.tsx
import { getIdentity, getSystems, portfolio } from "@/core/content";
import { OG_SIZE, shareCard } from "@/lib/og";

export const alt = "Kernel — an interactive engineering portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const id = getIdentity();
  const runnable = getSystems().find((s) => s.simulation) ?? getSystems()[0];
  return shareCard({
    eyebrow: id.role.toUpperCase(),
    title: id.name,
    subtitle: id.tagline,
    prompt: runnable ? `run ${runnable.slug}` : "ls systems",
    footer: `${portfolio.systems.length} systems · ${portfolio.capabilities.length} capabilities`,
  });
}
```

```tsx
// app/(gui)/systems/[slug]/opengraph-image.tsx
import { getSystem, getSystems } from "@/core/content";
import { systemNumber } from "@/core/format";
import { OG_SIZE, shareCard } from "@/lib/og";

export const alt = "A system in the Kernel portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getSystems().map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSystem(slug) ?? getSystems()[0];
  const impact = s.impact?.[0];
  return shareCard({
    eyebrow: `SYSTEM / ${systemNumber(s.number)} · ${s.status.toUpperCase()}`,
    title: s.name,
    subtitle: s.tagline,
    prompt: `open ${s.slug}`,
    footer: impact ? `${impact.value} ${impact.label}` : s.category,
  });
}
```

```tsx
// app/apple-icon.tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e0f11", borderRadius: 36 }}>
        <div style={{ display: "flex", color: "#e8a23b", fontSize: 108, fontWeight: 700 }}>K</div>
      </div>
    ),
    { ...size },
  );
}
```

If the per-system image's `generateStaticParams` export is rejected by the build, delete that export (the route will render on demand) and note it in the commit message.

- [ ] **Step 9: Metadata and analytics in `app/layout.tsx`** — add imports `import { Analytics } from "@/components/shell/Analytics";` and `import { siteUrl } from "@/lib/site";`, replace the `metadata` export with:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Kernel", template: "%s · Kernel" },
  description: `${identity.role}. ${identity.tagline}`,
  openGraph: { type: "website", title: `${identity.name} — Kernel`, description: identity.tagline, siteName: "Kernel" },
  twitter: { card: "summary_large_image", title: `${identity.name} — Kernel`, description: identity.tagline },
};
```

and render `<Analytics />` directly after `<Overlays />` in `<body>`.

- [ ] **Step 10: Verify**

```bash
npx tsc --noEmit && npm run lint && npm test && rm -rf .next && npm run build
lsof -ti tcp:3100 | xargs kill 2>/dev/null; (npm run start -- -p 3100 > /tmp/kernel-start.log 2>&1 &); sleep 5
for p in /opengraph-image /twitter-image /systems/atlas/opengraph-image /apple-icon /sitemap.xml /robots.txt; do printf "%-34s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "localhost:3100$p")"; done
curl -s localhost:3100/ | grep -o 'property="og:image"[^>]*' | head -1
curl -s localhost:3100/sitemap.xml | grep -c "<loc>"
```

Expected: images `200 image/png`; sitemap `200 application/xml` with `<loc>` count = 6 + number of systems; robots `200 text/plain`; home HTML has an `og:image` meta. Open `/opengraph-image` and `/systems/atlas/opengraph-image` in the browser and check the card renders (name, role, tagline, prompt line, footer). Kill the server.

- [ ] **Step 11: Commit**

```bash
git add lib app components/shell/Analytics.tsx tests/seo.test.ts
git commit -m "feat: share cards, sitemap, robots, apple icon and opt-in privacy analytics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Deploy preparation, docs, cleanup and final verification (Parts A4, E)

**Files:**
- Modify: `README.md` (replace the "Deploy free on Vercel" section; add "Shell v2/v3" commands; add "Analytics"), `.env.example`, `package.json` (`check` script), `AGENTS.md` (wrap-up spec/plan pointers)

**Interfaces:** none.

- [ ] **Step 1: `.env.example`** — replace contents with:

```bash
# Free key from https://aistudio.google.com/apikey — optional; Query falls back to local search without it.
GEMINI_API_KEY=
# Optional model override (default: gemini-flash-latest)
GEMINI_MODEL=
# Public URL of the deployed site (used for share images, sitemap and canonical links)
NEXT_PUBLIC_SITE_URL=
# Optional: enable Plausible analytics for this domain (no cookies; records page views and command names only)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=
```

- [ ] **Step 2: `package.json`** — add to `scripts`: `"check": "tsc --noEmit && eslint && vitest run && next build"`.

- [ ] **Step 3: README** — replace everything from the heading `## Deploy free on Vercel` up to (not including) `## Project structure` with:

````markdown
## Deploy (free) — checklist

Nothing has been published yet. When the real content is in:

1. **Replace the sample content** in `content/` and `public/resume.pdf`, then run:
   ```bash
   npm run check        # typecheck + lint + tests + production build
   ```
2. **Create a GitHub repository and push** (private shown; use `--public` if you prefer):
   ```bash
   gh repo create kernel --private --source . --push
   ```
3. **Import on Vercel:** go to <https://vercel.com/new>, pick the repository (Next.js is detected automatically).
4. **Environment variables** (Vercel → Project → Settings → Environment Variables):

   | Variable | Required | Value |
   |---|---|---|
   | `GEMINI_API_KEY` | recommended | free key from Google AI Studio |
   | `NEXT_PUBLIC_SITE_URL` | recommended | e.g. `https://your-name.vercel.app` |
   | `GEMINI_MODEL` | optional | defaults to `gemini-flash-latest` |
   | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | optional | enables analytics for that domain |

5. **Redeploy** so the variables apply, then smoke-test:
   `/`, `/?cmd=man%20kernel`, `/?cmd=run%20atlas`, `/systems`, `/opengraph-image`, `/sitemap.xml`, and ask a question in the shell (status bar should read `ai:online`).
6. Optional: add a custom domain in Vercel → Domains, then update `NEXT_PUBLIC_SITE_URL`.

## Analytics (optional)

Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to load [Plausible](https://plausible.io). No cookies, nothing personal: page views plus a `command` event whose only property is the command name (e.g. `grep`, `ask`) — never arguments or questions.
````

In the "## The shell" section, after the "Try …" paragraph, add:

```markdown
Engineering introspection: `git log [system] [--oneline]`, `git show <hash>`, `git branch`, `diff atlas relay`, `status`, `ps`, `top`, `env`, `benchmark <system>` (prints only measurements you add as `benchmarks` in a system's content), `graph --depth 2 atlas`. Ask with `ask <question>` or just type it — answers are followed by a clickable tree of related systems. `open atlas --full` jumps to the visual case study.
```

- [ ] **Step 4: `AGENTS.md`** — append:

```markdown
- Wrap-up spec: `docs/superpowers/specs/2026-10-05-kernel-wrapup-design.md`; plan: `docs/superpowers/plans/2026-10-05-kernel-wrapup.md`.
- Pure UI policy lives in `components/kernel/policy.ts` and `components/kernel/keys.ts` (unit-tested); keep Shell.tsx free of logic that can be tested without React.
```

- [ ] **Step 5: Full verification**

```bash
npm run check
lsof -ti tcp:3100 | xargs kill 2>/dev/null; (npm run start -- -p 3100 > /tmp/kernel-start.log 2>&1 &); sleep 5
for p in / "/?cmd=status" /systems /systems/atlas /graph /trace /human /connect /api/status /opengraph-image /sitemap.xml /robots.txt /missing; do printf "%-24s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' "localhost:3100$p")"; done
curl -s localhost:3100/api/status
```

Expected: `check` green; all routes `200` except `/missing` → `404`; `/api/status` → `{"ai":false}` (no key on this machine).

Browser pass (Playwright, 1440 dark/light and 390 touch + reduced motion): repeat Task 8 Step 12 items 1–11 plus: `git log`, `git show 7f3b`, `git branch`, `diff atlas relay`, `benchmark atlas` (refuses), `status`, `ps`, `top`, `env | grep AI`, `graph --depth 2 atlas`; Query panel focus return on `/systems`; theme-color meta flips. Record what was verified; live Gemini remains unverified without a key.

- [ ] **Step 6: Commit**

```bash
git add README.md .env.example package.json AGENTS.md
git commit -m "docs: deploy checklist, env reference, analytics notes and check script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Delete merged/obsolete branches (A4, local only)**

```bash
git branch -d feat/kernel     # identical to main
git branch -D spike/shell     # throwaway prototype (never merged by design)
git branch
```

Expected: only `main` and `feat/wrapup` remain.
