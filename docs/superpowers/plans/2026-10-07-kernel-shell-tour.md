# Kernel Shell Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach first-time shell visitors the three core moves with an opt-in 3-step tour, and show 2–3 context-aware next commands at every prompt.

**Architecture:**
- **Pure logic.** All decisions live in a new file, `core/shell/guide.ts`: which tour step comes next, what each step says, whether to offer the tour, and which hints to show. They are unit-tested against the real sample portfolio.
- **Command.** The `tour` command emits a new `tour` effect.
- **UI.** Two small components, `TourCard` and `HintBar`, are wired into `Shell.tsx`. After every command, the shell builds a `StepEvent` and feeds it to the pure functions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-kernel-shell-tour-design.md`

## Global Constraints

- **Location and branch:** repo root is `/Users/Pruthvi.Parade@gruve.ai/Desktop/Experiments/kernel`; work on branch `feat/shell-tour`, cut from `main`.
- **Purity:** `core/**` imports nothing from React, `next/*` or `components/**`, and the same inputs always give the same output.
- **Manual pages:** every command needs `summary`, `usage`, `description`, at least one entry in `examples` and at least one in `seeAlso`. The test "every command has a complete manual" in `tests/shell/info.test.ts` must keep passing.
- **Storage:**
  - The browser-storage key is exactly `kernel:tour`, with the value `"done"` or `"skipped"`.
  - Every storage read and write is wrapped in try/catch.
  - If storage fails, the visitor counts as never having seen the tour.
- **Reduced motion:** the type-in animation is skipped under `prefers-reduced-motion` and when the site's own motion setting is off (`useMotionAllowed()` → `motionRef.current`).
- **Hint bar:**
  - It never shows a command that fails against the shipped content.
  - It shows at least 1 and at most 3 hints.
- **Tour placement:** the tour is offered and shown only in the full-page shell (`variant === "page"`). It is never offered when the page was opened with `?cmd=`.
- **Commits:** commit after each task. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Stale build cache:** if `next build` reports stale `.next/**/validator.ts` errors, run `rm -rf .next` and rebuild.

## Plan-level rulings (deviations from the spec, decided while planning)

- **`StepEvent` gains `exitCode: 0 | 1`.** The spec says failed commands must not advance the tour, but the spec's event had no way to tell that a command failed. `ls nope` would otherwise count as "listed projects".
- **`advanceTour` and `hints` both take the portfolio `p`.** The step checks depend on whether there are any systems at all.
- **No-systems tour:** step 1 is `ls`, step 2 is `cd ~/skills` (done when the current folder is under `~/skills`), and step 3 is a question. The schema allows `systems: []`.
- **Fallback hints use home-relative paths away from home.** At home the hints are `ls systems` and `cat about.md`. Elsewhere they are `ls ~/systems` and `cat ~/about.md`, because the relative forms fail outside `~`. The tour's step-1 command follows the same rule.
- **The hint bar stays mounted but invisible** while a command runs or the completion menu is open, instead of being removed. The spec says "hidden"; this way the prompt doesn't jump up and down on every command.

## Review Focus

1. **Failed commands never advance the tour.** During step 1, `ls nope` or `cd nope` keeps the visitor on step 1. Test: Task 1, `failed commands never advance`.
2. **Hints in non-system folders still work.** In `~/skills` or `~/stack`, the hint bar offers runnable commands with `~/`-paths, not relative ones. Test: Task 2, `every hint runs cleanly in every context`.
3. **AI sources that are unknown or not systems are ignored.** For example a technology id, or a slug that doesn't exist. Only real system slugs become `open <slug>`. Test: Task 2, `ask hints keep only real systems`.
4. **The `tour` command tolerates case and stray arguments.** `TOUR`, `tour SKIP` and `tour skip now` → start, skip, and a usage error. Test: Task 3, `tour parses case-insensitively and rejects extra args`.
5. **Junk in storage counts as unseen.** `kernel:tour` set to `"yes"`, an empty string, or a read that throws → status `null`, so the offer shows. Test: Task 1, `readTourStatus accepts only done and skipped`.

---

### Task 1: Tour logic in `core/shell/guide.ts`

**Files:**
- Create: `core/shell/guide.ts`
- Test: `tests/shell/guide.test.ts`

**Interfaces:**
- Consumes:
  - `Portfolio` from `core/schema`;
  - `Effect` and `OutputItem` from `core/shell/types`;
  - `out` and `seg` from `core/shell/registry`.
- Produces:
  - `TOUR_KEY = "kernel:tour"` and `TOUR_LENGTH = 3`.
  - `type TourStatus = "done" | "skipped" | null`.
  - `interface StepEvent { command: string; cwd: string[]; effects: Effect[]; exitCode: 0 | 1 }`.
  - `interface TourStep { text: string; command: string }`.
  - `readTourStatus(raw: string | null): TourStatus`.
  - `shouldOfferTour(o: { status: TourStatus; variant: "page" | "console"; deepLinked: boolean }): boolean`.
  - `tourStep(step: number, cwd: string[], p: Portfolio): TourStep | null`.
  - `advanceTour(step: number, ev: StepEvent, p: Portfolio): number`.
  - `tourOffer(): OutputItem` and `tourDoneLine(): OutputItem`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/Pruthvi.Parade@gruve.ai/Desktop/Experiments/kernel
git checkout -b feat/shell-tour
```

- [ ] **Step 2: Write the failing test `tests/shell/guide.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import {
  advanceTour,
  readTourStatus,
  shouldOfferTour,
  TOUR_LENGTH,
  tourDoneLine,
  tourOffer,
  tourStep,
  type StepEvent,
} from "@/core/shell/guide";
import { plainText } from "@/core/shell/registry";

const clone = (): Portfolio => structuredClone(portfolio);
const ev = (command: string, cwd: string[] = [], patch: Partial<StepEvent> = {}): StepEvent => ({ command, cwd, effects: [], exitCode: 0, ...patch });
const first = portfolio.systems[0].slug;
const runnable = portfolio.systems.find((s) => s.simulation)!.slug;

describe("readTourStatus", () => {
  it("readTourStatus accepts only done and skipped", () => {
    expect(readTourStatus("done")).toBe("done");
    expect(readTourStatus("skipped")).toBe("skipped");
    for (const junk of [null, "", "yes", "DONE", "true"]) expect(readTourStatus(junk)).toBeNull();
  });
});

describe("shouldOfferTour", () => {
  it("offers only on an unseen, full-page, non-deep-linked shell", () => {
    expect(shouldOfferTour({ status: null, variant: "page", deepLinked: false })).toBe(true);
    expect(shouldOfferTour({ status: "done", variant: "page", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: "skipped", variant: "page", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: null, variant: "console", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: null, variant: "page", deepLinked: true })).toBe(false);
  });
});

describe("advanceTour", () => {
  it("step 1 completes on listing or entering systems", () => {
    for (const e of [ev("ls"), ev("ls -la"), ev("ls systems"), ev("tree"), ev("cd systems", ["systems"])]) {
      expect(advanceTour(0, e, portfolio), e.command).toBe(1);
    }
    expect(advanceTour(0, ev("cat about.md"), portfolio)).toBe(0);
    expect(advanceTour(0, ev("whoami"), portfolio)).toBe(0);
  });

  it("entering a project directly finishes steps 1 and 2", () => {
    expect(advanceTour(0, ev(`cd ~/systems/${first}`, ["systems", first]), portfolio)).toBe(2);
    expect(advanceTour(1, ev(`cd ${first}`, ["systems", first]), portfolio)).toBe(2);
    expect(advanceTour(1, ev("ls", ["systems"]), portfolio)).toBe(1);
  });

  it("step 3 completes on a demo or a question", () => {
    const sim = ev(`run ${runnable}`, ["systems", first], { effects: [{ type: "simulate", slug: runnable }] });
    const ask = ev("what is atlas?", ["systems", first], { effects: [{ type: "ask", question: "what is atlas?" }] });
    expect(advanceTour(2, sim, portfolio)).toBe(TOUR_LENGTH);
    expect(advanceTour(2, ask, portfolio)).toBe(TOUR_LENGTH);
    expect(advanceTour(2, ev("cat README.md", ["systems", first]), portfolio)).toBe(2);
  });

  it("failed commands never advance", () => {
    expect(advanceTour(0, ev("ls nope", [], { exitCode: 1 }), portfolio)).toBe(0);
    expect(advanceTour(1, ev("cd nope", ["systems"], { exitCode: 1 }), portfolio)).toBe(1);
  });

  it("never goes backwards and stays finished", () => {
    expect(advanceTour(2, ev("ls"), portfolio)).toBe(2);
    expect(advanceTour(TOUR_LENGTH, ev("ls"), portfolio)).toBe(TOUR_LENGTH);
  });

  it("without systems, step 2 is entering skills", () => {
    const p = clone();
    p.systems = [];
    expect(advanceTour(0, ev("ls"), p)).toBe(1);
    expect(advanceTour(1, ev("cd skills", ["skills"]), p)).toBe(2);
  });
});

describe("tourStep", () => {
  it("suggests commands that fit the current folder", () => {
    expect(tourStep(0, [], portfolio)!.command).toBe("ls systems");
    expect(tourStep(0, ["skills"], portfolio)!.command).toBe("ls ~/systems");
    expect(tourStep(1, [], portfolio)!.command).toBe(`cd systems/${first}`);
    expect(tourStep(1, ["systems"], portfolio)!.command).toBe(`cd ${first}`);
    expect(tourStep(1, ["stack"], portfolio)!.command).toBe(`cd ~/systems/${first}`);
    expect(tourStep(TOUR_LENGTH, [], portfolio)).toBeNull();
  });

  it("step 3 runs the project you are in when it has a demo", () => {
    expect(tourStep(2, ["systems", runnable], portfolio)!.command).toBe(`run ${runnable}`);
    const noDemo = portfolio.systems.find((s) => !s.simulation);
    if (noDemo) expect(tourStep(2, ["systems", noDemo.slug], portfolio)!.command).toBe(`run ${runnable}`);
  });

  it("falls back to a question when nothing is runnable, and to skills when there are no systems", () => {
    const p = clone();
    for (const s of p.systems) delete s.simulation;
    expect(tourStep(2, [], p)!.command).toMatch(/^ask /);
    p.systems = [];
    expect(tourStep(0, [], p)!.command).toBe("ls");
    expect(tourStep(1, [], p)!.command).toBe("cd ~/skills");
    expect(tourStep(2, [], p)!.command).toMatch(/^ask /);
  });
});

describe("tour lines", () => {
  it("the offer runs `tour` when clicked", () => {
    const offer = tourOffer();
    expect(plainText([offer])[0]).toContain("take the 20-second tour");
    expect("line" in offer && offer.line.some((s) => s.run === "tour")).toBe(true);
    expect(plainText([tourDoneLine()])[0]).toContain("tour done");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/shell/guide.test.ts`
Expected: FAIL. The module `@/core/shell/guide` cannot be resolved.

- [ ] **Step 4: Create `core/shell/guide.ts`**

```ts
import type { Portfolio } from "../schema";
import { out, seg } from "./registry";
import type { Effect, OutputItem } from "./types";

// Guided tour and next-command hints for the shell. Pure: the UI feeds in what happened, this decides what to show.

export const TOUR_KEY = "kernel:tour";
export const TOUR_LENGTH = 3;
export type TourStatus = "done" | "skipped" | null;

/** What a finished command did: the line, the folder afterwards, its effects and whether it succeeded. */
export interface StepEvent {
  command: string;
  cwd: string[];
  effects: Effect[];
  exitCode: 0 | 1;
}

export interface TourStep {
  text: string;
  command: string;
}

const SAMPLE_QUESTION = "ask which project should I look at first?";

export function readTourStatus(raw: string | null): TourStatus {
  return raw === "done" || raw === "skipped" ? raw : null;
}

export function shouldOfferTour(o: { status: TourStatus; variant: "page" | "console"; deepLinked: boolean }): boolean {
  return o.status === null && o.variant === "page" && !o.deepLinked;
}

const nameOf = (command: string) => command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
const inSystem = (cwd: string[]) => cwd[0] === "systems" && cwd.length >= 2;
const hasDemo = (p: Portfolio, slug: string) => Boolean(p.systems.find((s) => s.slug === slug)?.simulation);

function stepDone(step: number, ev: StepEvent, p: Portfolio): boolean {
  if (ev.exitCode !== 0) return false;
  const withSystems = p.systems.length > 0;
  switch (step) {
    case 0:
      return ["ls", "tree"].includes(nameOf(ev.command)) || (withSystems && ev.cwd[0] === "systems");
    case 1:
      return withSystems ? inSystem(ev.cwd) : ev.cwd[0] === "skills";
    case 2:
      return ev.effects.some((e) => e.type === "simulate" || e.type === "ask");
    default:
      return false;
  }
}

/** The step after this event. Keeps going while later steps are also satisfied; never goes backwards. */
export function advanceTour(step: number, ev: StepEvent, p: Portfolio): number {
  let next = step;
  while (next < TOUR_LENGTH && stepDone(next, ev, p)) next++;
  return next;
}

export function tourStep(step: number, cwd: string[], p: Portfolio): TourStep | null {
  const home = cwd.length === 0;
  const firstSlug = p.systems[0]?.slug;
  switch (step) {
    case 0:
      if (!firstSlug) return { text: "Everything here is a folder. Look around:", command: "ls" };
      return { text: "Projects live in folders. Look around:", command: home ? "ls systems" : "ls ~/systems" };
    case 1:
      if (!firstSlug) return { text: "Skills live in a folder too. Step inside:", command: "cd ~/skills" };
      return {
        text: "Click a project to step inside (or type it):",
        command: home ? `cd systems/${firstSlug}` : cwd[0] === "systems" && cwd.length === 1 ? `cd ${firstSlug}` : `cd ~/systems/${firstSlug}`,
      };
    case 2: {
      const here = inSystem(cwd) && hasDemo(p, cwd[1]) ? cwd[1] : p.systems.find((s) => s.simulation)?.slug;
      return here
        ? { text: "Now watch it work — or just ask in plain English:", command: `run ${here}` }
        : { text: "Now just ask in plain English:", command: SAMPLE_QUESTION };
    }
    default:
      return null;
  }
}

export const tourOffer = (): OutputItem =>
  out(seg("new here?  ", "faint"), seg("▸ take the 20-second tour", "accent", { run: "tour" }), seg("   or just start typing", "faint"));

export const tourDoneLine = (): OutputItem =>
  out(seg("✓ tour done", "ok"), seg(" — the bar above the prompt always shows what to try next", "faint"));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/shell/guide.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add core/shell/guide.ts tests/shell/guide.test.ts
git commit -m "feat(shell): pure tour logic — steps, completion checks, offer rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Context hints in `core/shell/guide.ts`

**Files:**
- Modify: `core/shell/guide.ts` (append)
- Test: `tests/shell/guide-hints.test.ts`

**Interfaces:**
- Consumes:
  - `StepEvent` (Task 1);
  - `buildFs` and `resolve` from `core/shell/fs`;
  - `execute` and `initialState` from `core/shell/execute` (test only).
- Produces:
  - `interface HintContext { cwd: string[]; last?: StepEvent; sources?: string[] }`, where `sources` are system slugs taken from the last AI answer.
  - `hints(ctx: HintContext, p: Portfolio): string[]`, which returns 1–3 commands.

- [ ] **Step 1: Write the failing test `tests/shell/guide-hints.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { execute, initialState } from "@/core/shell/execute";
import { hints, type HintContext, type StepEvent } from "@/core/shell/guide";
import { NOW } from "./helpers";

const ev = (command: string, cwd: string[], patch: Partial<StepEvent> = {}): StepEvent => ({ command, cwd, effects: [], exitCode: 0, ...patch });
const runnable = portfolio.systems.find((s) => s.simulation)!.slug;
const noDemo = portfolio.systems.find((s) => !s.simulation);

function contexts(p: Portfolio): HintContext[] {
  const slugs = p.systems.map((s) => s.slug);
  const demo = p.systems.find((s) => s.simulation)?.slug;
  return [
    { cwd: [] },
    { cwd: ["systems"] },
    { cwd: ["skills"] },
    { cwd: ["stack"] },
    ...slugs.map((slug) => ({ cwd: ["systems", slug] })),
    ...(demo
      ? [
          { cwd: [], last: ev(`run ${demo}`, [], { effects: [{ type: "simulate" as const, slug: demo }] }) },
          { cwd: ["systems", demo], last: ev(`run ${demo}`, ["systems", demo], { effects: [{ type: "simulate" as const, slug: demo }] }) },
        ]
      : []),
    { cwd: [], last: ev("ask x", [], { effects: [{ type: "ask", question: "x" }] }), sources: [...slugs, "nope"] },
    { cwd: [], last: ev("ask x", [], { effects: [{ type: "ask", question: "x" }] }), sources: [] },
  ];
}

describe("hints", () => {
  it("every hint runs cleanly in every context", () => {
    for (const ctx of contexts(portfolio)) {
      const list = hints(ctx, portfolio);
      expect(list.length, JSON.stringify(ctx)).toBeGreaterThanOrEqual(1);
      expect(list.length, JSON.stringify(ctx)).toBeLessThanOrEqual(3);
      for (const command of list) {
        const res = execute(command, { ...initialState(NOW), cwd: ctx.cwd }, portfolio, NOW);
        expect(res.exitCode, `${command} in ~/${ctx.cwd.join("/")}`).toBe(0);
      }
    }
  });

  it("follows where the visitor is", () => {
    expect(hints({ cwd: [] }, portfolio)).toEqual(["ls systems", "cat about.md", "ask what have you built?"]);
    expect(hints({ cwd: ["skills"] }, portfolio)).toEqual(["ls ~/systems", "cat ~/about.md", "ask what have you built?"]);
    expect(hints({ cwd: ["systems"] }, portfolio)).toEqual(portfolio.systems.slice(0, 2).map((s) => `cd ${s.slug}`));
    expect(hints({ cwd: ["systems", runnable] }, portfolio)).toEqual(["cat README.md", `run ${runnable}`, "cd .."]);
    if (noDemo) expect(hints({ cwd: ["systems", noDemo.slug] }, portfolio)).toEqual(["cat README.md", "cd .."]);
  });

  it("after a demo, suggests its decisions and a comparison", () => {
    const other = portfolio.systems.find((s) => s.slug !== runnable)!.slug;
    const sim = { effects: [{ type: "simulate" as const, slug: runnable }] };
    expect(hints({ cwd: ["systems", runnable], last: ev(`run ${runnable}`, ["systems", runnable], sim) }, portfolio)).toEqual([
      "cat decisions.md",
      `diff ${runnable} ${other}`,
    ]);
    expect(hints({ cwd: [], last: ev(`run ${runnable}`, [], sim) }, portfolio)[0]).toBe(`cat ~/systems/${runnable}/decisions.md`);
  });

  it("ask hints keep only real systems", () => {
    const ask = ev("ask x", [], { effects: [{ type: "ask", question: "x" }] });
    expect(hints({ cwd: [], last: ask, sources: ["nope", "react", runnable] }, portfolio)).toEqual([`open ${runnable}`]);
    expect(hints({ cwd: [], last: ask, sources: ["nope"] }, portfolio)).toEqual(hints({ cwd: [] }, portfolio));
  });

  it("a failed last command does not change the hints", () => {
    const failed = ev("run nope", [], { exitCode: 1, effects: [{ type: "simulate", slug: runnable }] });
    expect(hints({ cwd: [], last: failed }, portfolio)).toEqual(hints({ cwd: [] }, portfolio));
  });

  it("tolerates a minimal portfolio", () => {
    const one = structuredClone(portfolio);
    one.systems = [one.systems[one.systems.length - 1]];
    one.experience = [];
    const none = structuredClone(portfolio);
    none.systems = [];
    for (const p of [one, none]) {
      for (const ctx of contexts(p)) {
        for (const command of hints(ctx, p)) {
          const res = execute(command, { ...initialState(NOW), cwd: ctx.cwd }, p, NOW);
          expect(res.exitCode, `${command} in ~/${ctx.cwd.join("/")}`).toBe(0);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/shell/guide-hints.test.ts`
Expected: FAIL with `hints is not a function` (or a missing-export type error).

- [ ] **Step 3: Append to `core/shell/guide.ts`**

Add `import { buildFs, resolve } from "./fs";` to the imports at the top of the file, then append:

```ts
export interface HintContext {
  cwd: string[];
  last?: StepEvent;
  /** System slugs named by the last AI answer's sources. */
  sources?: string[];
}

const MAX_HINTS = 3;
const ASK_HINT = "ask what have you built?";

/** 1–3 next commands for where the visitor is and what they just did. Every one runs as written. */
export function hints(ctx: HintContext, p: Portfolio): string[] {
  const fs = buildFs(p);
  const exists = (path: string) => resolve(fs, ctx.cwd, path) !== undefined;
  const system = (slug: string | undefined) => p.systems.find((s) => s.slug === slug);
  const take = (list: (string | false | undefined)[]) => list.filter((x): x is string => Boolean(x)).slice(0, MAX_HINTS);
  const fallback = () =>
    ctx.cwd.length === 0
      ? take(["ls systems", exists("about.md") && "cat about.md", ASK_HINT])
      : take(["ls ~/systems", exists("~/about.md") && "cat ~/about.md", ASK_HINT]);
  const effects = ctx.last?.exitCode === 0 ? ctx.last.effects : [];

  let list: string[] = [];
  const sim = effects.find((e): e is Extract<Effect, { type: "simulate" }> => e.type === "simulate");
  if (effects.some((e) => e.type === "ask")) {
    list = take([...new Set(ctx.sources ?? [])].filter((slug) => system(slug)).slice(0, 2).map((slug) => `open ${slug}`));
  } else if (sim && system(sim.slug)) {
    const here = ctx.cwd[0] === "systems" && ctx.cwd[1] === sim.slug;
    const decisions = here ? "decisions.md" : `~/systems/${sim.slug}/decisions.md`;
    const other = p.systems.find((s) => s.slug !== sim.slug)?.slug;
    list = take([exists(decisions) && `cat ${decisions}`, other && `diff ${sim.slug} ${other}`]);
  } else if (ctx.cwd[0] === "systems" && ctx.cwd.length >= 2) {
    const s = system(ctx.cwd[1]);
    if (s) list = take([exists("README.md") && "cat README.md", s.simulation && `run ${s.slug}`, "cd .."]);
  } else if (ctx.cwd[0] === "systems") {
    list = take(p.systems.slice(0, 2).map((s) => `cd ${s.slug}`));
  }
  return list.length ? list : fallback();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/shell/guide-hints.test.ts tests/shell/guide.test.ts`
Expected: PASS, all tests.

If an `execute` exit code fails for a context, read the failing command in the assertion message. Fix the hint logic, not the test. The test is the spec's success criterion 2.

- [ ] **Step 5: Commit**

```bash
git add core/shell/guide.ts tests/shell/guide-hints.test.ts
git commit -m "feat(shell): context-aware next-command hints, every one verified runnable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `tour` command, `tour` effect, slimmer welcome

**Files:**
- Modify: `core/shell/types.ts` (the `Effect` union)
- Modify: `core/shell/commands/info.ts` (add `tour` and register it in `infoCommands`)
- Modify: `core/shell/welcome.ts` (`welcome()`)
- Test: `tests/shell/tour-command.test.ts`

**Interfaces:**
- Consumes: `fail`, `out`, `seg` and `Command` from `core/shell/registry`.
- Produces:
  - Effect variant `{ type: "tour"; action: "start" | "skip" }`;
  - command `tour [skip]`.

- [ ] **Step 1: Write the failing test `tests/shell/tour-command.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { plainText } from "@/core/shell/registry";
import { welcome } from "@/core/shell/welcome";
import { run } from "./helpers";

describe("tour command", () => {
  it("starts and skips the tour through an effect", () => {
    expect(run("tour").res.effects).toEqual([{ type: "tour", action: "start" }]);
    expect(run("tour skip").res.effects).toEqual([{ type: "tour", action: "skip" }]);
    expect(run("tour").res.exitCode).toBe(0);
  });

  it("tour parses case-insensitively and rejects extra args", () => {
    expect(run("TOUR").res.effects).toEqual([{ type: "tour", action: "start" }]);
    expect(run("tour SKIP").res.effects).toEqual([{ type: "tour", action: "skip" }]);
    const bad = run("tour skip now");
    expect(bad.res.exitCode).toBe(1);
    expect(bad.res.effects).toEqual([]);
    expect(bad.text).toContain("usage: tour [skip]");
  });

  it("has a manual page and shows up in help", () => {
    expect(run("man tour").text).toContain("TOUR(1)");
    expect(run("help").text).toContain("tour");
  });

  it("plain `skip` is not a command outside the tour", () => {
    expect(run("skip").res.exitCode).toBe(1);
  });
});

describe("welcome", () => {
  it("drops the old `try` line — the hint bar replaces it", () => {
    const text = plainText(welcome(portfolio));
    expect(text.some((l) => l.startsWith("try"))).toBe(false);
    expect(text.some((l) => l.includes("what has been built with agents?"))).toBe(true);
    expect(text.some((l) => portfolio.systems.every((s) => l.includes(s.slug)))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/shell/tour-command.test.ts`
Expected: FAIL. `tour` is an unknown command (`effects` is `[]`), and the welcome still has a `try` line.

- [ ] **Step 3: Add the effect variant in `core/shell/types.ts`**

Change the last line of the `Effect` union from

```ts
  | { type: "exit" };
```

to

```ts
  | { type: "exit" }
  | { type: "tour"; action: "start" | "skip" };
```

- [ ] **Step 4: Add the command in `core/shell/commands/info.ts`**

Insert this block directly above `export const infoCommands = …`:

```ts
const tour: Command = {
  name: "tour",
  group: "info",
  summary: "a 20-second guided tour of the shell",
  usage: "tour [skip]",
  description: [
    "Walks you through the three moves that matter: look around, step into a project, then run it or ask a question.",
    "Each step finishes when you do it — type the command or click it. `tour skip` (or Esc) ends the tour; `tour` starts it again.",
  ],
  examples: ["tour", "tour skip"],
  seeAlso: ["help", "man"],
  run(args) {
    const a = args.map((x) => x.toLowerCase());
    if (a.length === 0) return { effects: [{ type: "tour", action: "start" }] };
    if (a.length === 1 && a[0] === "skip") return { effects: [{ type: "tour", action: "skip" }] };
    return fail(`tour: unexpected "${args.join(" ")}"`, `usage: ${this.usage}`);
  },
};
```

Then change

```ts
export const infoCommands = [man, help, history, whoami, id, resume, exportCmd, ask];
```

to

```ts
export const infoCommands = [man, help, tour, history, whoami, id, resume, exportCmd, ask];
```

- [ ] **Step 5: Slim the welcome in `core/shell/welcome.ts`**

Replace the whole `welcome` function with:

```ts
export function welcome(p: Portfolio): OutputItem[] {
  return [
    { block: { kind: "neofetch" } },
    blank(),
    out(seg("just ask:  ", "faint"), seg('"what has been built with agents?"', "text", { run: "what has been built with agents?" })),
    out(
      seg("systems:   ", "faint"),
      ...p.systems.flatMap((s, i) => [...(i ? [seg("  ")] : []), seg(s.slug, "dir", { run: `cd ~/systems/${s.slug}` })]),
    ),
    blank(),
  ];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/shell/tour-command.test.ts tests/shell/info.test.ts tests/shell/ssr.test.tsx`
Expected: PASS. The info test "every command has a complete manual" now also covers `tour`.

Run: `npx tsc --noEmit`
Expected: clean. If `components/kernel/Shell.tsx` reports that the `perform` switch doesn't handle `"tour"`, add `case "tour": return;` there. Task 4 replaces it. Log the change as a ruling.

Run: `npm test > .superpowers/task3-tests.log 2>&1; tail -5 .superpowers/task3-tests.log`
Expected: all test files pass. If any other test asserted the old `try` line, update that assertion to the new welcome and log it as a ruling.

- [ ] **Step 7: Commit**

```bash
git add core/shell/types.ts core/shell/commands/info.ts core/shell/welcome.ts tests/shell/tour-command.test.ts
git commit -m "feat(shell): tour command and effect; welcome drops the try line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: TourCard, HintBar and Shell wiring

**Files:**
- Create: `components/kernel/TourCard.tsx`
- Create: `components/kernel/HintBar.tsx`
- Modify: `components/kernel/keys.ts` (`escapeAction` gains a `tour` layer)
- Modify: `components/kernel/Shell.tsx`
- Modify: `README.md` (shell cheat sheet)
- Test: `tests/console-keys.test.ts` (extend), `tests/shell/tour-ui.test.tsx` (new, server-rendered markup)

**Interfaces:**
- Consumes:
  - from Task 1: `TOUR_KEY`, `TOUR_LENGTH`, `StepEvent`, `readTourStatus`, `shouldOfferTour`, `tourStep`, `advanceTour`, `tourOffer`, `tourDoneLine`;
  - from Task 2: `hints`;
  - from Task 3: the effect `{ type: "tour"; action }`;
  - existing: `deepLinkFor` from `core/shell/deeplink`.
- Produces:
  - `TourCard({ step, total, text, command, disabled, onRun, onSkip })`;
  - `HintBar({ hints, hidden, onRun })`;
  - `escapeAction({ menu, search, pane, tour, console })`, which returns `"menu" | "search" | "pane" | "tour" | "exit" | "none"`.

- [ ] **Step 1: Write the failing tests**

In `tests/console-keys.test.ts`, replace the `describe("escapeAction", …)` block with:

```ts
describe("escapeAction", () => {
  it("peels one layer at a time, and finally closes the console", () => {
    const base = { menu: false, search: false, pane: false, tour: false, console: true };
    expect(escapeAction({ ...base, menu: true, search: true, pane: true, tour: true })).toBe("menu");
    expect(escapeAction({ ...base, search: true, pane: true, tour: true })).toBe("search");
    expect(escapeAction({ ...base, pane: true, tour: true })).toBe("pane");
    expect(escapeAction(base)).toBe("exit");
    expect(escapeAction({ ...base, console: false })).toBe("none");
  });

  it("ends the tour after closing any open pane", () => {
    const page = { menu: false, search: false, pane: false, tour: true, console: false };
    expect(escapeAction({ ...page, pane: true })).toBe("pane");
    expect(escapeAction(page)).toBe("tour");
  });
});
```

Create `tests/shell/tour-ui.test.tsx`:

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HintBar } from "@/components/kernel/HintBar";
import { TourCard } from "@/components/kernel/TourCard";

describe("TourCard", () => {
  it("shows the step, the text and a clickable command", () => {
    const html = renderToString(<TourCard step={0} total={3} text="Look around:" command="ls systems" disabled={false} onRun={() => {}} onSkip={() => {}} />);
    expect(html).toContain("tour 1/3");
    expect(html).toContain("Look around:");
    expect(html).toContain("▸ ls systems");
    expect(html).toContain('aria-label="Skip the tour"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("HintBar", () => {
  it("renders one button per hint and stays mounted when hidden", () => {
    const html = renderToString(<HintBar hints={["ls systems", "cat about.md"]} hidden={false} onRun={() => {}} />);
    expect(html.match(/<button/g)?.length).toBe(2);
    expect(html).toContain("▸ cat about.md");
    const hidden = renderToString(<HintBar hints={["ls"]} hidden onRun={() => {}} />);
    expect(hidden).toContain("invisible");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/console-keys.test.ts tests/shell/tour-ui.test.tsx`
Expected: FAIL. `escapeAction` returns `"none"` instead of `"tour"`, and the component modules are missing.

- [ ] **Step 3: Update `escapeAction` in `components/kernel/keys.ts`**

Replace the function with:

```ts
/** Escape in the shell closes the innermost layer (menu, search, pane, then the tour); in the drop-down console the last Escape closes the console. */
export function escapeAction(s: { menu: boolean; search: boolean; pane: boolean; tour: boolean; console: boolean }): "menu" | "search" | "pane" | "tour" | "exit" | "none" {
  if (s.menu) return "menu";
  if (s.search) return "search";
  if (s.pane) return "pane";
  if (s.tour) return "tour";
  return s.console ? "exit" : "none";
}
```

- [ ] **Step 4: Create `components/kernel/TourCard.tsx`**

```tsx
"use client";

/** The tour's step box above the prompt. Not a dialog: focus stays on the prompt, buttons never take it. */
export function TourCard({
  step,
  total,
  text,
  command,
  disabled,
  onRun,
  onSkip,
}: {
  step: number;
  total: number;
  text: string;
  command: string;
  disabled: boolean;
  onRun: (command: string) => void;
  onSkip: () => void;
}) {
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className="my-2 rounded border border-accent bg-accent-soft px-3 py-2">
      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="text-accent">
          tour {step + 1}/{total}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded bg-surface-2" aria-hidden="true">
          <span className="block h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round((step / total) * 100)}%` }} />
        </span>
        <button type="button" onPointerDown={keepFocus} onClick={onSkip} className="hover:text-text" aria-label="Skip the tour">
          ✕
        </button>
      </div>
      <p className="mt-1" aria-live="polite">
        <span className="text-muted">{text}</span>{" "}
        <button type="button" disabled={disabled} onPointerDown={keepFocus} onClick={() => onRun(command)} className="text-accent hover:underline disabled:opacity-50">
          ▸ {command}
        </button>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/kernel/HintBar.tsx`**

```tsx
"use client";

/** Next-command suggestions above the status bar. Stays mounted (invisible) while busy so the layout never jumps. */
export function HintBar({ hints, hidden, onRun }: { hints: string[]; hidden: boolean; onRun: (command: string) => void }) {
  if (hints.length === 0) return null;
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-1 text-[12px] ${hidden ? "invisible" : ""}`}
      aria-label="Suggested commands"
      aria-hidden={hidden || undefined}
    >
      <span className="shrink-0 text-faint">try</span>
      {hints.map((h) => (
        <button
          key={h}
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onRun(h)}
          className="shrink-0 rounded border border-border px-2 py-0.5 text-muted hover:border-accent hover:text-accent"
        >
          ▸ {h}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the component and key tests**

Run: `npx vitest run tests/console-keys.test.ts tests/shell/tour-ui.test.tsx`
Expected: PASS.

- [ ] **Step 7: Wire it into `components/kernel/Shell.tsx`**

Make these edits in order. Each "find" quotes the current code exactly.

(a) **Imports.** After `import { parseDeepLink } from "@/core/shell/deeplink";`, change that line to:

```ts
import { deepLinkFor, parseDeepLink } from "@/core/shell/deeplink";
```

After `import { explain, explainLines } from "@/core/shell/explain";`, add:

```ts
import {
  advanceTour,
  hints as hintsFor,
  readTourStatus,
  shouldOfferTour,
  TOUR_KEY,
  TOUR_LENGTH,
  tourDoneLine,
  tourOffer,
  tourStep,
  type StepEvent,
  type TourStatus,
} from "@/core/shell/guide";
```

After `import { blockWhileBusy, consoleModeAction, escapeAction, tabDecision } from "./keys";`, add:

```ts
import { HintBar } from "./HintBar";
```

After `import { PromptText, Transcript, type Row } from "./Transcript";`, add:

```ts
import { TourCard } from "./TourCard";
```

(b) **State.** Directly after `const started = useRef(false);`, add:

```ts
  // Guided tour (null = not running) and the context the hint bar reads.
  const [tour, setTourState] = useState<number | null>(null);
  const tourRef = useRef<number | null>(null);
  const [hintCtx, setHintCtx] = useState<{ last?: StepEvent; sources?: string[] }>({});
  const sourcesRef = useRef<string[]>([]);
  const typingRef = useRef(false);

  const setTour = useCallback((step: number | null) => {
    tourRef.current = step;
    setTourState(step);
  }, []);

  const endTour = useCallback(
    (status: Exclude<TourStatus, null>) => {
      setTour(null);
      try {
        window.localStorage.setItem(TOUR_KEY, status);
      } catch {
        /* storage blocked: the offer just shows again next visit */
      }
    },
    [setTour],
  );
```

(c) **AI sources.** Inside `ask`, after `let sources: string[] = [];`, add:

```ts
      sourcesRef.current = [];
```

and in the `meta` branch, change

```ts
            sources = e.sources.slice(0, 4).map((s) => s.title);
```

to

```ts
            sources = e.sources.slice(0, 4).map((s) => s.title);
            sourcesRef.current = e.sources.filter((s) => s.kind === "system").map((s) => s.id);
```

(d) **The `tour` effect.** In `perform`'s `switch`, add this case before `case "exit":`. If Task 3 added a stub `case "tour": return;`, replace it.

```ts
        case "tour":
          if (e.action === "skip") {
            endTour("skipped");
            add([out(seg("tour skipped", "faint"), seg(" — type ", "faint"), seg("tour", "accent", { run: "tour" }), seg(" to start it again", "faint"))]);
            return;
          }
          if (variant === "console") {
            add([out(seg("the tour runs in the full shell — opening /shell", "faint"))]);
            router.push(deepLinkFor("tour"));
            return;
          }
          setTour(0);
          return;
```

Add `endTour` and `setTour` to `perform`'s dependency array. It becomes `[ask, endTour, onExit, pathname, playSimulation, router, setTour, showPane, variant]`.

(e) **Feed every finished command to the tour and hints.** In `run`, change

```ts
        const res = execute(raw, stateRef.current, portfolio, Date.now(), { env: envRef.current });
```

to

```ts
        // While the tour is up, a bare `skip` means `tour skip`.
        const line = tourRef.current !== null && raw.trim().toLowerCase() === "skip" ? "tour skip" : raw;
        const res = execute(line, stateRef.current, portfolio, Date.now(), { env: envRef.current });
```

and directly after the `for (const effect of res.effects) { … }` loop (still inside `try`), add:

```ts
        if (!cancel.current.cancelled) {
          const ev: StepEvent = { command: line, cwd: res.state.cwd, effects: res.effects, exitCode: res.exitCode };
          setHintCtx({ last: ev, sources: res.effects.some((x) => x.type === "ask") ? sourcesRef.current : undefined });
          if (tourRef.current !== null) {
            const next = advanceTour(tourRef.current, ev, portfolio);
            if (next >= TOUR_LENGTH) {
              endTour("done");
              add([tourDoneLine()]);
            } else if (next !== tourRef.current) setTour(next);
          }
        }
```

Change `run`'s dependency array from `[perform, typeOut]` to `[add, endTour, perform, setTour, typeOut]`.

(f) **Type the command in, then run it.** Directly after the `cancelRunning` function, add:

```ts
  /** Tour and hint clicks: type the command into the prompt (≤0.3 s, instant with reduced motion), then run it. */
  const typeAndRun = useCallback(
    async (command: string) => {
      if (busyRef.current || typingRef.current) return;
      typingRef.current = true;
      try {
        if (motionRef.current) {
          const per = Math.min(25, 300 / Math.max(1, command.length));
          for (let i = 1; i <= command.length; i++) {
            setInput(command.slice(0, i));
            setCaret(i);
            await sleep(per);
          }
        }
      } finally {
        typingRef.current = false;
      }
      await run(command);
    },
    [run],
  );
```

(g) **Offer the tour on boot.** In the boot effect, find

```ts
      for (const notice of link.notices) add([out(seg(notice, "faint"))]);
```

and insert directly before it:

```ts
      let tourStatus: TourStatus = null;
      try {
        tourStatus = readTourStatus(window.localStorage.getItem(TOUR_KEY));
      } catch {
        /* storage blocked: treat as never seen */
      }
      if (shouldOfferTour({ status: tourStatus, variant, deepLinked: link.commands.length > 0 })) add([tourOffer()]);
```

(h) **Escape.** In `onKeyDown`, change

```ts
      const layer = escapeAction({ menu: Boolean(menu), search: Boolean(search), pane: Boolean(pane), console: variant === "console" });
```

to

```ts
      const layer = escapeAction({ menu: Boolean(menu), search: Boolean(search), pane: Boolean(pane), tour: tourRef.current !== null, console: variant === "console" });
```

and after `else if (layer === "pane") showPane(null);`, add:

```ts
      else if (layer === "tour") endTour("skipped");
```

(i) **Derived values.** Directly after `const { settled, live } = splitRows(rows);`, add:

```ts
  const tourNow = tour === null ? null : tourStep(tour, cwd, portfolio);
  const hintList = useMemo(() => hintsFor({ cwd, ...hintCtx }, portfolio), [cwd, hintCtx]);
```

`useMemo` here is a hook placed after the early `const` declarations but before `return`, at the top level of the component, so it is a valid hook position.

(j) **Render the tour box.** Find the prompt line's opening tag

```tsx
          <label className="relative block whitespace-pre-wrap break-all">
```

and insert directly before it:

```tsx
          {tourNow && tour !== null && (
            <TourCard
              step={tour}
              total={TOUR_LENGTH}
              text={tourNow.text}
              command={tourNow.command}
              disabled={busy}
              onRun={(c) => void typeAndRun(c)}
              onSkip={() => {
                endTour("skipped");
                inputRef.current?.focus({ preventScroll: true });
              }}
            />
          )}
```

(k) **Render the hint bar.** Find the mobile key row's opening line

```tsx
      <div className="hidden shrink-0 gap-1.5 overflow-x-auto border-t border-border px-2 py-1.5 [@media(pointer:coarse)]:flex" aria-label="Shell keys">
```

and insert directly before it:

```tsx
      {tour === null && <HintBar hints={hintList} hidden={busy || Boolean(menu)} onRun={(c) => void typeAndRun(c)} />}
```

- [ ] **Step 8: Static checks and the full suite**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If lint flags "setState in effect" or hook ordering, fix it the way the codebase already does elsewhere: move the call into the existing async callback, or move the hook above any conditional. Log any such change as a ruling.

Run: `npm test > .superpowers/task4-tests.log 2>&1; tail -6 .superpowers/task4-tests.log`
Expected: all test files pass.

- [ ] **Step 9: README cheat sheet**

In `README.md`, find the cheat-sheet row

```
| `man kernel`, `help` | See every command |
```

and replace it with

```
| `tour` | A 20-second guided tour (offered on your first visit) |
| `man kernel`, `help` | See every command |
```

and change the sentence

```
Tab autocompletes, ↑/↓ scrolls through history, and Ctrl+L clears the screen.
```

to

```
Tab autocompletes, ↑/↓ scrolls through history, and Ctrl+L clears the screen. The bar above the prompt always suggests what to try next.
```

- [ ] **Step 10: Production build and browser check**

Run: `rm -rf .next && npm run build > .superpowers/task4-build.log 2>&1; tail -15 .superpowers/task4-build.log`
Expected: build succeeds, and `/shell` is listed as static (`○`).

Start the server: `npx next start -p 3100` (in the background). Then use Playwright MCP against `http://localhost:3100`.

1. **Clean state.** Open `/shell?boot=1`, then run `localStorage.clear(); sessionStorage.clear()` and reload `/shell`.
   Expected: after the boot lines, the transcript shows `new here?  ▸ take the 20-second tour`, and the hint bar shows `try ▸ ls systems ▸ cat about.md ▸ ask what have you built?`.
2. **Start the tour.** Click `▸ take the 20-second tour`.
   Expected: the tour box shows `tour 1/3` and `▸ ls systems`, and the hint bar is gone.
3. **Step 1.** Click `▸ ls systems`.
   Expected: the command types into the prompt, runs, and lists the systems. The box moves to `tour 2/3`.
4. **Step 2.** Click a system name in the `ls` output.
   Expected: the `cd` runs, and the box moves to `tour 3/3` with `▸ run <that slug>` (or `run atlas` if it has no demo).
5. **Step 3.** Click the step-3 command.
   Expected: the demo plays, the box disappears, the line `✓ tour done` is appended, the hint bar returns with the decisions and diff hints, and `localStorage.getItem("kernel:tour") === "done"`. Time from step 1's click to the box disappearing, excluding the demo, is under 20 s.
6. **No repeat.** Reload.
   Expected: no offer line.
7. **Restart and Esc.** Type `tour` and press Enter.
   Expected: the box is back at 1/3. Press Esc and the box closes, with `kernel:tour === "skipped"`.
8. **Plain `skip`.** Type `tour`, then `skip`.
   Expected: the box closes and `tour skipped — type tour to start it again` is printed.
9. **Hints follow the visitor.** Type `cd ~/skills`.
   Expected: the hints are `ls ~/systems`, `cat ~/about.md`, `ask …`. Click each one and confirm none prints an error.
10. **Drop-down console.** Open `/systems`, press `` ` ``.
    Expected: the console shows a hint bar. Type `tour` and it navigates to `/shell` with the tour box at 1/3.
11. **Phone width.** Resize to 390×844 and reload `/shell` (with `kernel:tour` cleared).
    Expected: the offer, tour box and hint bar fit without horizontal page scroll, and the hint bar scrolls sideways if needed.
12. **Reduced motion.** Emulate `prefers-reduced-motion: reduce` and click a hint.
    Expected: the command appears instantly and runs.

Stop the server afterwards.

- [ ] **Step 11: Commit**

```bash
git add components/kernel/TourCard.tsx components/kernel/HintBar.tsx components/kernel/keys.ts components/kernel/Shell.tsx tests/console-keys.test.ts tests/shell/tour-ui.test.tsx README.md
git commit -m "feat(shell): guided tour box and next-command hint bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Final gate for the branch: `npm run check` must pass.
