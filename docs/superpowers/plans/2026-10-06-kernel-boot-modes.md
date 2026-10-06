# Kernel Boot Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A GRUB-style first-visit bootloader that recommends Recruiter Mode (a new server-rendered front door at `/`) or Developer Mode (the shell, moved to `/shell`), with one-click/one-key switching everywhere (mode pill, `` ` `` drop-down console, shell commands, URLs).

**Architecture:** Boot decisions are pure functions in `core/boot.ts` (plus an inline pre-paint script generated from the same module and tested for parity). The Recruiter page is a server component composed from pure selectors in `core/front.ts`, with three client islands: `AskInline`, `BootOverlay`, and the console. The existing `Shell` gains a `variant="console"` so the drop-down console is the real shell. The old `recruiter` boolean (motion-off) is replaced by `mode: "human" | "shell"`.

**Tech Stack:** Next.js 16.3 App Router (`next.config` redirects with `has`), React 19 (`flushSync`, `document.startViewTransition` for the in-page boot morph), TypeScript, Tailwind 4, Vitest 5 (`node` environment; `node:vm` to test the inline script).

**Spec:** `docs/superpowers/specs/2026-10-06-kernel-boot-modes-design.md`

## Global Constraints

- Root `/Users/Pruthvi.Parade@gruve.ai/Desktop/Experiments/kernel`, branch `feat/boot-modes` (already created, spec committed). Read `node_modules/next/dist/docs/` before using a Next API not shown here.
- `core/**` imports nothing from React, `next/*`, `components/**` or `lib/**`; deterministic given inputs.
- **No fabricated data:** every value shown comes from `content/` or runtime state. Sections with no data are omitted, never filled with invented numbers.
- Every shell command has `summary`, `usage`, `description`, `examples` (≥1), `seeAlso` (≥1) — `tests/shell/info.test.ts` "every command has a complete manual" must keep passing.
- Motion follows only `prefers-reduced-motion` (`useMotionAllowed`). Recruiter Mode never disables motion. Every boot/switch animation has a no-motion path.
- Storage access is always wrapped in try/catch; blocked storage must never throw or blank the page.
- Countdown: 3000 ms desktop, 2000 ms mobile (`(pointer: coarse)`). Hydration watchdog: 1500 ms.
- localStorage keys: `kernel:mode` (`"human"|"shell"`), `kernel:bootmenu` (`"seen"`), existing `kernel:theme`, `kernel:history`. Legacy `kernel:recruiter` is deleted on load. sessionStorage: existing `kernel:booted` (shell's own boot animation), new `kernel:cwd`.
- Nothing is pushed or published. Commit after each task; message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After moving routes, if `next build` reports stale `.next/**` type errors, `rm -rf .next` and rebuild.

## Plan-level rulings (deviations from the spec, decided while planning)

- **R1 storage key:** spec's `kernel:booted` (localStorage) collides with the shell's existing sessionStorage `kernel:booted`. The bootloader uses `kernel:bootmenu = "seen"` instead.
- **R2 boot morph mechanism:** the hero is already mounted under the overlay, so React `<ViewTransition>` (mount/unmount pairs) cannot morph it. The in-page morph uses `document.startViewTransition(() => flushSync(...))`; front-page elements carry `view-transition-name: var(--vt)` only while `data-boot` is absent (CSS), so names are never duplicated. No API → instant switch.
- **R3 pre-paint parity:** the inline script cannot import `decideBoot`. `bootScript()` in `core/boot.ts` returns the script text; a test executes it in `node:vm` over a signal table and asserts it agrees with `decideBoot`.
- **R4 Ask streaming:** the inline Ask renders text as it streams (same as the Query panel), without the shell's typewriter. Inline Ask never auto-runs actions (that would navigate away from the page mid-read); actions are shown as suggestion buttons.
- **R5 referrer list:** preselect `shell` for github.com, news.ycombinator.com, dev.to, lobste.rs, stackoverflow.com (and subdomains); everything else (LinkedIn, mail, mobile, none) is `human`, which is the default — no separate human-host list.
- **R6 late hydration:** if the overlay hydrates after the 1500 ms watchdog, it does not appear (the visitor is already reading); mode stays unset so the menu shows on the next visit.

## Review Focus

1. **Returning visitor with stale/partial storage** (`kernel:bootmenu=seen` but no/invalid `kernel:mode`, or the reverse) → menu shows, never a redirect loop or blank page. Test: Task 1 `script and decideBoot agree on every signal combination`.
2. **Overlay hydrates late (slow JS)** → no menu over a page the visitor is reading, body scroll not locked. Test: Task 1 `late hydration never shows the menu`; Task 9 CSS keeps `overflow:hidden` only for `data-boot="live"`.
3. **`` ` `` typed inside an input** (Ask box, query panel, shell input) → types a backtick, never toggles the console. Test: Task 8 `console key ignores editable targets and modifiers`.
4. **Console `exit` vs page `exit`** → console closes itself; `/shell` switches to human. Test: Task 4 `exit depends on the surface`.
5. **Restored cwd that no longer exists** (content changed between visits) → shell starts at `~`, no crash. Test: Task 7 `parseCwd rejects unknown or malformed paths`.

---
### Task 1: Boot decisions, boot log and pre-paint script (`core/boot.ts`)

**Files:**
- Create: `core/boot.ts`
- Test: `tests/boot.test.ts`

**Interfaces:**
- Consumes: `buildGraph(p)` from `core/graph`, `handleOf(p)` from `core/shell/welcome`, `out`, `seg`, `blank` from `core/shell/registry`, `OutputItem` from `core/shell/types`.
- Produces:
  - `type Mode = "human" | "shell"`, `isMode(v: unknown): v is Mode`
  - `MODE_KEY = "kernel:mode"`, `MENU_KEY = "kernel:bootmenu"`, `COUNTDOWN_MS = { desktop: 3000, mobile: 2000 }`, `HYDRATION_WATCHDOG_MS = 1500`
  - `interface BootSignals { storedMode: Mode | null; menuSeen: boolean; referrer: string; cmdParam: string | null; modeParam: string | null; forceBoot: boolean; isMobile: boolean; lateHydration: boolean }`
  - `interface BootDecision { show: boolean; preselect: Mode; countdownMs: number; target: Mode }`
  - `decideBoot(s: BootSignals): BootDecision`
  - `interface BootLine { id: "identity" | "systems" | "index" | "graph"; label: string; detail: string; slugs: string[] }`
  - `bootLog(p: Portfolio): BootLine[]`, `bootLogItems(lines: BootLine[]): OutputItem[]`
  - `bootScript(): string` — inline pre-paint script text

- [ ] **Step 1: Write the failing test `tests/boot.test.ts`**

```ts
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { bootLog, bootLogItems, bootScript, decideBoot, type BootSignals, type Mode } from "@/core/boot";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";

const base: BootSignals = {
  storedMode: null,
  menuSeen: false,
  referrer: "",
  cmdParam: null,
  modeParam: null,
  forceBoot: false,
  isMobile: false,
  lateHydration: false,
};
const sig = (patch: Partial<BootSignals>): BootSignals => ({ ...base, ...patch });
const textOf = (items: ReturnType<typeof bootLogItems>) =>
  items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : "")).join("\n");

describe("decideBoot", () => {
  it("first visit shows the menu with recruiter preselected and a 3 s countdown", () => {
    expect(decideBoot(base)).toEqual({ show: true, preselect: "human", countdownMs: 3000, target: "human" });
  });

  it("mobile gets a 2 s countdown and still prefers recruiter", () => {
    expect(decideBoot(sig({ isMobile: true }))).toMatchObject({ show: true, preselect: "human", countdownMs: 2000 });
  });

  it("developer referrers preselect the shell (subdomains too) but still show the menu", () => {
    for (const referrer of ["https://github.com/someone", "https://news.ycombinator.com/item?id=1", "https://www.dev.to/x", "https://gist.github.com/x"]) {
      expect(decideBoot(sig({ referrer })), referrer).toMatchObject({ show: true, preselect: "shell" });
    }
    for (const referrer of ["https://www.linkedin.com/feed", "https://mail.google.com/", "not a url", "https://notgithub.com/"]) {
      expect(decideBoot(sig({ referrer })).preselect, referrer).toBe("human");
    }
  });

  it("returning visitors skip the menu and go to their stored mode", () => {
    expect(decideBoot(sig({ menuSeen: true, storedMode: "shell" }))).toMatchObject({ show: false, target: "shell" });
    expect(decideBoot(sig({ menuSeen: true, storedMode: "human" }))).toMatchObject({ show: false, target: "human" });
  });

  it("partial storage shows the menu", () => {
    expect(decideBoot(sig({ menuSeen: true, storedMode: null })).show).toBe(true);
    expect(decideBoot(sig({ menuSeen: false, storedMode: "shell" })).show).toBe(true);
  });

  it("explicit mode and cmd params skip the menu", () => {
    expect(decideBoot(sig({ modeParam: "shell" }))).toMatchObject({ show: false, preselect: "shell", target: "shell" });
    expect(decideBoot(sig({ modeParam: "human", menuSeen: true, storedMode: "shell" }))).toMatchObject({ show: false, target: "human" });
    expect(decideBoot(sig({ cmdParam: "ls" }))).toMatchObject({ show: false, target: "shell" });
    expect(decideBoot(sig({ modeParam: "bogus" }))).toMatchObject({ show: true, preselect: "human" });
  });

  it("?boot=1 always shows the menu", () => {
    expect(decideBoot(sig({ forceBoot: true, menuSeen: true, storedMode: "shell" })).show).toBe(true);
    expect(decideBoot(sig({ forceBoot: true, lateHydration: true })).show).toBe(true);
  });

  it("late hydration never shows the menu and stays on the recruiter page", () => {
    expect(decideBoot(sig({ lateHydration: true }))).toMatchObject({ show: false, target: "human" });
    expect(decideBoot(sig({ lateHydration: true, referrer: "https://github.com/" }))).toMatchObject({ show: false, target: "human" });
  });
});

describe("bootLog", () => {
  it("builds lines from real content", () => {
    const lines = bootLog(portfolio);
    expect(lines.map((l) => l.id)).toEqual(["identity", "systems", "index", "graph"]);
    expect(lines[0].detail).toContain(portfolio.identity.role);
    expect(lines[1].slugs).toEqual(portfolio.systems.map((s) => s.slug));
    expect(lines[2].detail).toBe(`${portfolio.capabilities.length} capabilities · ${portfolio.technologies.length} technologies`);
  });

  it("an empty portfolio still yields the identity line and never throws", () => {
    const empty: Portfolio = { ...portfolio, systems: [], capabilities: [], technologies: [], experience: [] };
    expect(bootLog(empty).map((l) => l.id)).toEqual(["identity"]);
  });

  it("renders as shell transcript items", () => {
    const text = textOf(bootLogItems(bootLog(portfolio)));
    expect(text).toContain("KERNEL 1.0 (tty1)");
    expect(text).toContain("[ ok ] mount /systems");
  });
});

/** Runs the inline script against fake browser globals. */
function runScript(opts: { path?: string; search?: string; storage?: Record<string, string> | "blocked" }) {
  const store = opts.storage === "blocked" ? null : { ...(opts.storage ?? {}) };
  const dataset: Record<string, string> = {};
  let replaced: string | null = null;
  const localStorage = {
    getItem(k: string) {
      if (!store) throw new Error("blocked");
      return k in store ? store[k] : null;
    },
    setItem(k: string, v: string) {
      if (!store) throw new Error("blocked");
      store[k] = v;
    },
  };
  const context = {
    document: { documentElement: { dataset } },
    location: { pathname: opts.path ?? "/", search: opts.search ?? "", replace: (u: string) => (replaced = u) },
    URLSearchParams,
    get localStorage() {
      if (!store) throw new Error("blocked");
      return localStorage;
    },
  };
  vm.runInNewContext(bootScript(), context);
  return { boot: dataset.boot ?? null, replaced, store };
}

describe("bootScript", () => {
  it("marks first visits for the overlay", () => {
    expect(runScript({}).boot).toBe("on");
  });

  it("does nothing outside the front page", () => {
    expect(runScript({ path: "/systems" })).toMatchObject({ boot: null, replaced: null });
  });

  it("blocked storage behaves as a first visit", () => {
    expect(runScript({ storage: "blocked" })).toMatchObject({ boot: "on", replaced: null });
  });

  it("?mode= persists the choice", () => {
    const r = runScript({ search: "?mode=shell" });
    expect(r).toMatchObject({ boot: null, replaced: "/shell" });
    expect(r.store).toMatchObject({ "kernel:mode": "shell", "kernel:bootmenu": "seen" });
  });

  it("script and decideBoot agree on every signal combination", () => {
    const modes: (Mode | null)[] = [null, "human", "shell"];
    const params = ["", "?mode=human", "?mode=shell", "?mode=bogus", "?boot=1"];
    for (const storedMode of modes)
      for (const menuSeen of [false, true])
        for (const search of params) {
          const storage: Record<string, string> = {};
          if (storedMode) storage["kernel:mode"] = storedMode;
          if (menuSeen) storage["kernel:bootmenu"] = "seen";
          const q = new URLSearchParams(search);
          const d = decideBoot(sig({ storedMode, menuSeen, modeParam: q.get("mode"), forceBoot: q.get("boot") === "1" }));
          const r = runScript({ search, storage });
          const label = JSON.stringify({ storedMode, menuSeen, search });
          expect(r.boot === "on", label).toBe(d.show);
          expect(r.replaced === "/shell", label).toBe(!d.show && d.target === "shell");
        }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/boot.test.ts`
Expected: FAIL — `Cannot find module '@/core/boot'` (or equivalent resolve error).

- [ ] **Step 3: Create `core/boot.ts`**

```ts
import { buildGraph } from "./graph";
import type { Portfolio } from "./schema";
import { blank, out, seg } from "./shell/registry";
import type { OutputItem } from "./shell/types";
import { handleOf } from "./shell/welcome";

export type Mode = "human" | "shell";
export const isMode = (v: unknown): v is Mode => v === "human" || v === "shell";

export const MODE_KEY = "kernel:mode";
export const MENU_KEY = "kernel:bootmenu";
export const COUNTDOWN_MS = { desktop: 3000, mobile: 2000 } as const;
export const HYDRATION_WATCHDOG_MS = 1500;

/** Hosts whose visitors are most likely engineers: the shell is preselected (they can still pick either). */
const DEV_HOSTS = ["github.com", "news.ycombinator.com", "dev.to", "lobste.rs", "stackoverflow.com"];

export interface BootSignals {
  storedMode: Mode | null;
  menuSeen: boolean;
  referrer: string;
  cmdParam: string | null;
  modeParam: string | null;
  forceBoot: boolean;
  isMobile: boolean;
  lateHydration: boolean;
}

export interface BootDecision {
  show: boolean;
  preselect: Mode;
  countdownMs: number;
  target: Mode;
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function preselectFor(s: BootSignals): Mode {
  if (isMode(s.modeParam)) return s.modeParam;
  if (s.cmdParam) return "shell";
  const host = referrerHost(s.referrer);
  if (DEV_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "shell";
  return "human";
}

/** Signals only choose the preselected line; the visitor always decides (or the countdown does). */
export function decideBoot(s: BootSignals): BootDecision {
  const preselect = preselectFor(s);
  const countdownMs = s.isMobile ? COUNTDOWN_MS.mobile : COUNTDOWN_MS.desktop;
  const explicit = isMode(s.modeParam) || Boolean(s.cmdParam);
  if (s.forceBoot) return { show: true, preselect, countdownMs, target: preselect };
  if (explicit) return { show: false, preselect, countdownMs, target: preselect };
  if (s.lateHydration) return { show: false, preselect, countdownMs, target: "human" };
  if (s.menuSeen && s.storedMode) return { show: false, preselect, countdownMs, target: s.storedMode };
  return { show: true, preselect, countdownMs, target: preselect };
}

export interface BootLine {
  id: "identity" | "systems" | "index" | "graph";
  label: string;
  detail: string;
  /** System slugs on this line (each morphs into its card on the recruiter page). */
  slugs: string[];
}

export function bootLog(p: Portfolio): BootLine[] {
  const lines: BootLine[] = [{ id: "identity", label: "identity", detail: `${handleOf(p)} · ${p.identity.role}`, slugs: [] }];
  if (p.systems.length) {
    const slugs = p.systems.map((s) => s.slug);
    lines.push({ id: "systems", label: "mount /systems", detail: slugs.join(" "), slugs });
  }
  if (p.capabilities.length || p.technologies.length) {
    lines.push({ id: "index", label: "index", detail: `${p.capabilities.length} capabilities · ${p.technologies.length} technologies`, slugs: [] });
  }
  const g = buildGraph(p);
  if (g.edges.length) lines.push({ id: "graph", label: "link", detail: `graph ${g.nodes.length} nodes / ${g.edges.length} edges`, slugs: [] });
  return lines;
}

/** The same lines as shell transcript rows, handed to /shell when the visitor boots the shell. */
export function bootLogItems(lines: BootLine[]): OutputItem[] {
  return [
    out(seg("KERNEL 1.0 (tty1)", "accent")),
    ...lines.map((l) => out(seg("[ ok ] ", "ok"), seg(`${l.label}  `, "muted"), seg(l.detail))),
    blank(),
  ];
}

/**
 * Pre-paint script for the front page (inlined in <head>). Mirrors decideBoot for the signals available
 * before paint; tests/boot.test.ts checks the two agree. `?cmd=` never reaches here (next.config redirect).
 */
export function bootScript(): string {
  return `(function(){try{var d=document.documentElement,l=location;if(l.pathname!=="/")return;var q=new URLSearchParams(l.search);
var g=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var p=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
if(q.get("boot")==="1"){d.dataset.boot="on";return}
var m=q.get("mode");if(m==="human"||m==="shell"){p("${MODE_KEY}",m);p("${MENU_KEY}","seen");if(m==="shell")l.replace("/shell");return}
var s=g("${MODE_KEY}"),seen=g("${MENU_KEY}")==="seen";
if(seen&&s==="shell"){l.replace("/shell");return}
if(seen&&s==="human")return;
d.dataset.boot="on"}catch(e){}})();`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/boot.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add core/boot.ts tests/boot.test.ts
git commit -m "feat(boot): pure boot decisions, real-content boot log and tested pre-paint script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Mode state replaces the recruiter flag

**Files:**
- Modify: `lib/store.ts`, `lib/use-motion-allowed.ts`, `lib/use-run-action.ts`, `app/globals.css`, `app/layout.tsx`, `app/(gui)/layout.tsx`, `components/shell/Header.tsx`, `core/actions.ts`, `core/query.ts`, `server/query-handler.ts`, `core/shell/types.ts`, `core/shell/commands/runtime.ts`, `core/shell/commands/actions.ts`, `components/kernel/Shell.tsx`
- Delete: `components/recruiter/RecruiterSummary.tsx`, `components/shell/RecruiterToggle.tsx`
- Test: `tests/store.test.ts` (new), `tests/actions.test.ts`, `tests/shell/actions.test.ts`, `tests/shell/runtime.test.ts`

**Interfaces:**
- Consumes: `Mode`, `isMode`, `MODE_KEY`, `MENU_KEY` from `core/boot` (Task 1).
- Produces:
  - store `KernelState` fields `mode: Mode` (default `"human"`), `bootHandoff: OutputItem[] | null`, `reboot: string | null` (replaces `recruiter`).
  - `kernel.setMode(mode: Mode): void` — persists `kernel:mode` and `kernel:bootmenu=seen`.
  - `kernel.handOff(items: OutputItem[]): void`, `kernel.takeHandoff(): OutputItem[] | null` (returns once, then null).
  - `kernel.setReboot(text: string | null): void`.
  - `readBootPrefs(): { storedMode: Mode | null; menuSeen: boolean }` and `kernelSnapshot(): KernelState` (exported from `lib/store.ts`).
  - `UiAction` member `{ type: "switchMode"; mode: Mode }` (replaces `toggleRecruiter`); `actionToHref` → `"/"` or `"/shell"`.
  - `Effect` member `{ type: "mode"; mode: Mode }` (replaces `{ type: "recruiter"; on }`).
  - `RuntimeEnv.mode: Mode` (replaces `recruiter`); `DEFAULT_ENV.mode = "shell"`; `env` prints `MODE=<mode>`.

- [ ] **Step 1: Write the failing store test `tests/store.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage(init: Record<string, string> = {}, broken = false) {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => {
      if (broken) throw new Error("blocked");
      return k in data ? data[k] : null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("blocked");
      data[k] = v;
    },
    removeItem: (k: string) => {
      if (broken) throw new Error("blocked");
      delete data[k];
    },
  };
}

async function loadStore(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("document", { documentElement: { dataset: {} as Record<string, string> } });
  return import("@/lib/store");
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("kernel store mode", () => {
  it("restores the saved mode and deletes the legacy recruiter key", async () => {
    const storage = fakeStorage({ "kernel:mode": "shell", "kernel:recruiter": "on" });
    const { kernelSnapshot } = await loadStore(storage);
    expect(kernelSnapshot().mode).toBe("shell");
    expect(storage.data).not.toHaveProperty("kernel:recruiter");
  });

  it("defaults to human and ignores invalid values", async () => {
    const { kernelSnapshot } = await loadStore(fakeStorage({ "kernel:mode": "robot" }));
    expect(kernelSnapshot().mode).toBe("human");
  });

  it("setMode persists the mode and marks the menu as seen", async () => {
    const storage = fakeStorage();
    const { kernel, kernelSnapshot, readBootPrefs } = await loadStore(storage);
    kernel.setMode("shell");
    expect(kernelSnapshot().mode).toBe("shell");
    expect(storage.data).toMatchObject({ "kernel:mode": "shell", "kernel:bootmenu": "seen" });
    expect(readBootPrefs()).toEqual({ storedMode: "shell", menuSeen: true });
  });

  it("blocked storage never throws", async () => {
    const { kernel, kernelSnapshot, readBootPrefs } = await loadStore(fakeStorage({}, true));
    expect(kernelSnapshot().mode).toBe("human");
    expect(() => kernel.setMode("shell")).not.toThrow();
    expect(kernelSnapshot().mode).toBe("shell");
    expect(readBootPrefs()).toEqual({ storedMode: null, menuSeen: false });
  });

  it("the boot handoff is taken exactly once", async () => {
    const { kernel } = await loadStore(fakeStorage());
    kernel.handOff([{ line: [{ text: "boot" }] }]);
    expect(kernel.takeHandoff()).toEqual([{ line: [{ text: "boot" }] }]);
    expect(kernel.takeHandoff()).toBeNull();
  });
});
```

- [ ] **Step 2: Update the existing tests to the new names (they fail until Step 4)**

`tests/actions.test.ts`:
- replace `expect(validateAction({ type: "toggleRecruiter", on: "yes" }, portfolio)).toBeNull();` with
  ```ts
      expect(validateAction({ type: "switchMode", mode: "robot" }, portfolio)).toBeNull();
      expect(validateAction({ type: "switchMode", mode: "shell" }, portfolio)).toEqual({ type: "switchMode", mode: "shell" });
  ```
- replace `expect(actionToHref({ type: "toggleRecruiter", on: true })).toBeNull();` with
  ```ts
      expect(actionToHref({ type: "switchMode", mode: "human" })).toBe("/");
      expect(actionToHref({ type: "switchMode", mode: "shell" })).toBe("/shell");
  ```

`tests/shell/actions.test.ts`: replace
`expect(run("recruiter").res.effects).toEqual([{ type: "recruiter", on: true }, { type: "navigate", href: "/systems" }]);` with
`expect(run("recruiter").res.effects).toEqual([{ type: "mode", mode: "human" }]);`

`tests/shell/runtime.test.ts`: in "env shows public configuration only", replace `recruiter: true` with `mode: "human"` and `"RECRUITER=on"` with `"MODE=human"`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/store.test.ts tests/actions.test.ts tests/shell/actions.test.ts tests/shell/runtime.test.ts`
Expected: FAIL — `kernelSnapshot is not a function`, `switchMode` rejected by the schema, `recruiter` effect mismatch, `MODE=human` missing.

- [ ] **Step 4: Implement**

(a) `lib/store.ts` — replace the whole file:

```ts
"use client";

import { useSyncExternalStore } from "react";
import { isMode, MENU_KEY, MODE_KEY, type Mode } from "@/core/boot";
import type { OutputItem } from "@/core/shell/types";
import { applyThemeColor } from "./theme-color";

export type KernelState = {
  mode: Mode;
  theme: "dark" | "light";
  queryOpen: boolean;
  querySeed: string | null;
  queryNonce: number;
  /** Boot lines the bootloader hands to /shell so the transcript continues where the overlay stopped. */
  bootHandoff: OutputItem[] | null;
  /** One-line "switching to …" flash shown while changing modes; null when idle. */
  reboot: string | null;
};

const initial: KernelState = {
  mode: "human",
  theme: "dark",
  queryOpen: false,
  querySeed: null,
  queryNonce: 0,
  bootHandoff: null,
  reboot: null,
};

let state = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  remove("kernel:recruiter"); // legacy flag (motion-off recruiter mode), superseded by kernel:mode
  const mode = read(MODE_KEY);
  state = {
    ...state,
    mode: isMode(mode) ? mode : "human",
    theme: read("kernel:theme") === "light" ? "light" : "dark",
  };
}

function set(patch: Partial<KernelState>) {
  hydrate();
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function kernelSnapshot(): KernelState {
  hydrate();
  return state;
}

export function readBootPrefs(): { storedMode: Mode | null; menuSeen: boolean } {
  const mode = read(MODE_KEY);
  return { storedMode: isMode(mode) ? mode : null, menuSeen: read(MENU_KEY) === "seen" };
}

export const kernel = {
  setMode(mode: Mode) {
    set({ mode });
    write(MODE_KEY, mode);
    write(MENU_KEY, "seen");
  },
  handOff(items: OutputItem[]) {
    set({ bootHandoff: items });
  },
  takeHandoff(): OutputItem[] | null {
    hydrate();
    const items = state.bootHandoff;
    if (items) state = { ...state, bootHandoff: null };
    return items;
  },
  setReboot(text: string | null) {
    set({ reboot: text });
  },
  toggleTheme() {
    hydrate();
    const theme = state.theme === "dark" ? "light" : "dark";
    set({ theme });
    write("kernel:theme", theme);
    document.documentElement.dataset.theme = theme;
    applyThemeColor(theme);
  },
  openQuery(seed?: string) {
    hydrate();
    set({ queryOpen: true, querySeed: seed ?? null, queryNonce: state.queryNonce + 1 });
  },
  closeQuery() {
    set({ queryOpen: false, querySeed: null });
  },
};

export function useKernel<T>(selector: (s: KernelState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return selector(state);
    },
    () => selector(initial),
  );
}
```

(b) `lib/use-motion-allowed.ts` — delete `import { useKernel } from "./store";` and the `recruiter` line; return `!reduced`.

(c) `app/globals.css` — delete the block `:root[data-recruiter="on"] .motion-optional, … { animation: none !important; }` and the block `:root[data-recruiter="on"]::view-transition-group(*), … { animation: none !important; }`. Change the comment `/* View transitions (React <ViewTransition>): gentle morphs, none for reduced motion or recruiter mode */` to `/* View transitions: gentle morphs, none for reduced motion */`.

(d) `app/layout.tsx` — replace the `themeScript` constant and its comment with:

```ts
// Runs before paint: restores the theme and sets the browser chrome colour from the site theme.
const themeScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("kernel:theme");if(t)d.dataset.theme=t;var m=document.createElement("meta");m.name="theme-color";m.content=t==="light"?"#f6f4ef":"#0e0f11";document.head.appendChild(m);}catch(e){}})();`;
```

(e) `app/(gui)/layout.tsx` — remove the `RecruiterSummary` import and `<RecruiterSummary />`. Delete `components/recruiter/RecruiterSummary.tsx` and `components/shell/RecruiterToggle.tsx`.

(f) `components/shell/Header.tsx` — remove the `RecruiterToggle` import and `<RecruiterToggle />`; in the mobile nav remove the `<span className="text-faint">·</span>` and the "Recruiter mode" `<button>` (the pill arrives in Task 7).

(g) `core/actions.ts`:
- replace `z.object({ type: z.literal("toggleRecruiter"), on: z.boolean() }),` with `z.object({ type: z.literal("switchMode"), mode: z.enum(["human", "shell"]) }),`
- in `validateAction`: `case "switchMode": return a;`
- in `actionToHref`: `case "switchMode": return a.mode === "human" ? "/" : "/shell";`
- in `describeAction`: `case "switchMode": return a.mode === "human" ? "Switched to the recruiter view" : "Switched to the shell";`

(h) `server/query-handler.ts` — replace the `toggleRecruiter: tool({...})` entry with:

```ts
  switchMode: tool({
    description: "Switch the site between the recruiter view (human) and the terminal (shell).",
    inputSchema: z.object({ mode: z.enum(["human", "shell"]) }),
  }),
```

(i) `core/query.ts` `systemPrompt` — replace the line `"  toggleRecruiter(on) when they ask for a quick overview or recruiter mode.",` with
`"  switchMode(mode): \"human\" when they want a quick overview or the recruiter view, \"shell\" when they want the terminal.",`
and in the `navigate(path)` line replace `/trace, /human, /connect, /graph, /systems` with `/trace, /connect, /graph, /systems`.

(j) `core/shell/types.ts`:
- add `import type { Mode } from "../boot";` at the top.
- replace `| { type: "recruiter"; on: boolean };` with `| { type: "mode"; mode: Mode };`
- in `RuntimeEnv` replace `recruiter: boolean;` with `mode: Mode;`
- `DEFAULT_ENV`: replace `recruiter: false` with `mode: "shell"`.

(k) `core/shell/commands/runtime.ts` — replace `["RECRUITER", ctx.env.recruiter ? "on" : "off"],` with `["MODE", ctx.env.mode],`.

(l) `core/shell/commands/actions.ts` — replace the `recruiter` command with:

```ts
const recruiter: Command = {
  name: "recruiter",
  group: "actions",
  summary: "switch to the recruiter view",
  usage: "recruiter",
  description: ["Switches to the recruiter view: a fast, readable overview of the work. Same as `human`."],
  examples: ["recruiter"],
  seeAlso: ["resume", "gui"],
  run() {
    return { effects: [{ type: "mode", mode: "human" }] };
  },
};
```

(m) `lib/use-run-action.ts` — replace the `toggleRecruiter` branch with:

```ts
      if (action.type === "switchMode") kernel.setMode(action.mode);
```
(leave the following `const href = actionToHref(action); if (href) router.push(href);` as is — it now routes switchMode too).

(n) `components/kernel/Shell.tsx`:
- delete `const recruiter = useKernel((s) => s.recruiter);`
- `envRef` initial value: `{ theme: "dark", motion: "full", mode: "shell", ai: "unknown", pane: null }`
- in the env effect replace `recruiter,` with `mode: "shell",` and remove `recruiter` from the dependency array.
- in `applyAction`, replace the final `else add([... "recruiter" ... " for the one-screen summary" ...]);` with
  ```ts
      } else add([out(seg("  → ", "faint"), seg(a.mode === "human" ? "human" : "pwd", "accent", { run: a.mode === "human" ? "human" : "pwd" }), seg(a.mode === "human" ? " for the recruiter view" : " — you are already in the shell", "faint"))]);
  ```
  (the `human` command arrives in Task 4; until then the clickable hint prints "command not found", which Task 4 fixes.)
- in `perform` replace the `case "recruiter":` block with
  ```ts
        case "mode":
          kernel.setMode(e.mode);
          router.push(e.mode === "human" ? "/" : "/shell");
          return;
  ```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/store.test.ts tests/actions.test.ts tests/shell/actions.test.ts tests/shell/runtime.test.ts`
Expected: PASS.

Run: `grep -rn "recruiter" lib core server components app --include=*.ts --include=*.tsx --include=*.css | grep -iv "recruiter view\|name: \"recruiter\"\|const recruiter\|, recruiter,\|\"recruiter\"\]" `
Expected: only intentional mentions (the `recruiter` command and prose like "recruiters"); no `data-recruiter`, `toggleRecruiter`, `setRecruiter`, `RecruiterSummary` or `RecruiterToggle`.

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A lib core server components app tests
git commit -m "refactor: replace motion-off recruiter flag with a persisted human/shell mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Routes — shell to `/shell`, front-door placeholder at `/`, redirects

**Files:**
- Move: `app/(shell)/page.tsx` → `app/(shell)/shell/page.tsx`
- Create: `app/(gui)/page.tsx` (placeholder front page; filled in Task 5)
- Delete: `app/(gui)/human/page.tsx`
- Modify: `next.config.ts`, `app/sitemap.ts`, `core/actions.ts`, `core/search.ts`, `core/shell/deeplink.ts`, `core/shell/commands/info.ts`, `core/shell/commands/actions.ts`, `components/shell/Header.tsx`, `components/shell/Overlays.tsx`, `components/shell/Footer.tsx`, `README.md`
- Test: `tests/routes.test.ts` (new), `tests/seo.test.ts`, `tests/shell/deeplink.test.ts`, `tests/shell/actions.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: routes `/` (GUI front door) and `/shell`; `deepLinkFor(cmd)` → `/shell?cmd=…`; `INTERNAL_ROUTES = ["/", "/shell", "/systems", "/graph", "/trace", "/connect"]`; `GUI_PAGES = ["systems", "graph", "trace", "human", "connect"]` where `gui human` navigates to `/#human`.

- [ ] **Step 1: Write the failing tests**

Create `tests/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { INTERNAL_ROUTES } from "@/core/actions";

describe("redirects", () => {
  it("sends old shell deep links to /shell and /human to the front door", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({ source: "/", has: [{ type: "query", key: "cmd" }], destination: "/shell", permanent: false });
    expect(redirects).toContainEqual({ source: "/human", destination: "/#human", permanent: true });
  });
});

describe("internal routes", () => {
  it("include the shell and no longer list /human", () => {
    expect(INTERNAL_ROUTES).toContain("/shell");
    expect(INTERNAL_ROUTES).not.toContain("/human");
  });
});
```

In `tests/seo.test.ts` "lists the shell, gui pages and every system": replace the path list `["", "/systems", "/graph", "/trace", "/human", "/connect"]` with `["", "/shell", "/systems", "/graph", "/trace", "/connect"]` and add after the loop:
```ts
    expect(urls).not.toContain("https://kernel.example.dev/human");
```

In `tests/shell/deeplink.test.ts` replace `expect(deepLinkFor("grep -i rag .")).toBe("/?cmd=grep%20-i%20rag%20.");` with `expect(deepLinkFor("grep -i rag .")).toBe("/shell?cmd=grep%20-i%20rag%20.");`

In `tests/shell/info.test.ts` replace `expect(run("help links").text).toContain("/?cmd=");` with `expect(run("help links").text).toContain("/shell?cmd=");`

In `tests/shell/actions.test.ts` "gui, recruiter, clear" add:
```ts
    expect(run("gui human").res.effects).toEqual([{ type: "navigate", href: "/#human" }]);
    expect(run("gui about").res.effects).toEqual([{ type: "navigate", href: "/#human" }]);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/routes.test.ts tests/seo.test.ts tests/shell/deeplink.test.ts tests/shell/actions.test.ts tests/shell/info.test.ts`
Expected: FAIL — `redirects` undefined, `/shell` missing, deep link still `/?cmd=`, `gui human` → `/human`.

- [ ] **Step 3: Implement**

(a) `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The shell moved from / to /shell; old share links (/?cmd=…) keep working. Query strings pass through.
      { source: "/", has: [{ type: "query", key: "cmd" }], destination: "/shell", permanent: false },
      { source: "/human", destination: "/#human", permanent: true },
    ];
  },
};

export default nextConfig;
```

(b) Move the shell page: `mkdir -p "app/(shell)/shell" && git mv "app/(shell)/page.tsx" "app/(shell)/shell/page.tsx"`. In the moved file change `export const metadata: Metadata = { title: { absolute: "Kernel" } };` to `export const metadata: Metadata = { title: "Shell", description: "The Kernel terminal: explore the portfolio with ls, cd, grep, man, run and plain-English questions." };`

(c) Delete `app/(gui)/human/page.tsx` (`git rm`). Its content moves to the front page in Task 5.

(d) Create placeholder `app/(gui)/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getIdentity } from "@/core/content";

const identity = getIdentity();

export const metadata: Metadata = { title: { absolute: `${identity.name} — ${identity.role}` } };

export default function FrontPage() {
  return (
    <div className="py-14 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{identity.name}</h1>
      <p className="mt-3 text-lg text-muted">{identity.role}</p>
    </div>
  );
}
```

(e) `app/sitemap.ts` — replace the middle line with:
```ts
    ...["/shell", "/systems", "/graph", "/trace", "/connect"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.7 })),
```

(f) `core/actions.ts` — `export const INTERNAL_ROUTES = ["/", "/shell", "/systems", "/graph", "/trace", "/connect"] as const;`

(g) `core/search.ts` — in the identity doc, change the href `"/human"` to `"/#human"`.

(h) `core/shell/deeplink.ts` — `export const deepLinkFor = (command: string) => \`/shell?cmd=${encodeURIComponent(command)}\`;`
`core/shell/commands/info.ts` — change the two manual lines `"/?cmd=man%20atlas"` and `"/?cmd=run%20atlas"` to `"/shell?cmd=man%20atlas"` and `"/shell?cmd=run%20atlas"`.

(i) `core/shell/commands/actions.ts` `gui` command: change `return { effects: [{ type: "navigate", href: \`/${page}\` }] };` to
```ts
    return { effects: [{ type: "navigate", href: page === "human" ? "/#human" : `/${page}` }] };
```
and its description to `["Opens a page of the visual site (the recruiter view). Press the backtick key there for a drop-down shell, or ⌘K to come back here."]`.
In the `open` command, change `if (isPage && (!local || ctx.state.cwd.length === 0)) return { effects: [{ type: "navigate", href: \`/${page}\` }] };` to use `href: page === "human" ? "/#human" : \`/${page}\``.

(j) `components/shell/Header.tsx`:
- `LINKS`: replace `{ href: "/human", label: "Human" }` with `{ href: "/#human", label: "Human" }` and make `isActive` ignore hash links: `const isActive = (href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(\`${href}/\`));`
- the `>_ shell ⌘K` link and the mobile "Shell" link: `href="/"` → `href="/shell"`.

(k) `components/shell/Overlays.tsx` — ⌘K: `if (pathname !== "/shell") router.push("/shell");`; the `/` quick-ask guard: `pathname !== "/shell"`.

(l) `README.md` — replace every `/?cmd=` with `/shell?cmd=`, and in the deploy smoke-test line replace `` `/`, `/?cmd=man%20kernel` `` with `` `/`, `/shell`, `/?cmd=man%20kernel` (should redirect to `/shell`) ``.

- [ ] **Step 4: Run tests and build**

Run: `npx vitest run tests/routes.test.ts tests/seo.test.ts tests/shell/deeplink.test.ts tests/shell/actions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit && npm run lint && npm test && rm -rf .next && npm run build`
Expected: clean; the build route list shows `○ /` and `○ /shell` (both static) and no `/human`.

Run: `npx next start -p 3100 & sleep 3; curl -sI "http://localhost:3100/?cmd=ls" | grep -i location; curl -sI http://localhost:3100/human | grep -i location; kill %1`
Expected: `location: /shell?cmd=ls` and `location: /#human`. If the `/human` location lacks `#human` (Next strips fragments), Ruling: change the destination to `/` and the test to match — the "How I think" section is still on the front page.

- [ ] **Step 5: Commit**

```bash
git add -A app core components next.config.ts README.md tests
git commit -m "feat(routes): shell moves to /shell, / becomes the GUI front door, old links redirect

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Shell commands — `exit`, `human`, `reboot`, `fullscreen`

**Files:**
- Modify: `core/shell/types.ts`, `core/shell/commands/actions.ts`, `components/kernel/Shell.tsx`
- Test: `tests/shell/modes.test.ts` (new), `tests/shell/actions.test.ts`

**Interfaces:**
- Consumes: `Effect` `{ type: "mode"; mode: Mode }` and `RuntimeEnv.mode` (Task 2).
- Produces:
  - `RuntimeEnv.surface: "page" | "console"` (`DEFAULT_ENV.surface = "page"`).
  - `Effect` member `{ type: "exit" }` — handled by the Shell UI: console → close; page → switch to human.
  - Commands `human` (alias of nothing; `recruiter` stays as its own command with the same effect), `reboot`, `fullscreen`; `exit`/`logout` rewritten.

- [ ] **Step 1: Write the failing test `tests/shell/modes.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { execute, initialState } from "@/core/shell/execute";
import { DEFAULT_ENV, type RuntimeEnv } from "@/core/shell/types";
import { NOW, textOf } from "./helpers";

const on = (input: string, env: Partial<RuntimeEnv> = {}) => {
  const res = execute(input, initialState(NOW), portfolio, NOW, { env: { ...DEFAULT_ENV, ...env } });
  return { effects: res.effects, text: textOf(res.output), exitCode: res.exitCode };
};

describe("mode commands", () => {
  it("human switches to the recruiter view", () => {
    expect(on("human").effects).toEqual([{ type: "mode", mode: "human" }]);
  });

  it("exit depends on the surface", () => {
    expect(on("exit", { surface: "console" }).effects).toEqual([{ type: "exit" }]);
    expect(on("exit", { surface: "page" }).effects).toEqual([{ type: "exit" }]);
    expect(on("exit", { surface: "page" }).text).toContain("recruiter view");
    expect(on("logout").effects).toEqual([{ type: "exit" }]);
  });

  it("reboot replays the bootloader", () => {
    expect(on("reboot").effects).toEqual([{ type: "navigate", href: "/?boot=1" }]);
  });

  it("fullscreen opens the full shell from the console only", () => {
    expect(on("fullscreen", { surface: "console" }).effects).toEqual([{ type: "navigate", href: "/shell" }]);
    const page = on("fullscreen", { surface: "page" });
    expect(page.effects).toEqual([]);
    expect(page.text).toBe("fullscreen: already in the full shell");
  });

  it("mode effects are dropped inside pipelines", () => {
    for (const cmd of ["human | cat", "exit | wc -l", "reboot | head"]) expect(on(cmd).effects, cmd).toEqual([]);
  });
});
```

In `tests/shell/actions.test.ts` "easter eggs use real contact data": replace `expect(run("exit").text).toContain("gui");` with `expect(run("exit").res.effects).toEqual([{ type: "exit" }]);`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/shell/modes.test.ts tests/shell/actions.test.ts`
Expected: FAIL — `human: command not found`, `exit` has no effects, `surface` unknown.

- [ ] **Step 3: Implement**

(a) `core/shell/types.ts`:
- add `| { type: "exit" }` to `Effect`.
- add `surface: "page" | "console";` to `RuntimeEnv`.
- `DEFAULT_ENV`: `{ theme: "dark", motion: "full", mode: "shell", surface: "page", ai: "unknown", pane: null }`.

(b) `core/shell/commands/actions.ts` — replace the `exit` command and add three commands before `export const actionCommands`:

```ts
const exit: Command = {
  name: "exit",
  aliases: ["logout"],
  group: "actions",
  summary: "leave the shell",
  usage: "exit",
  description: ["In the drop-down console: closes it. In the full shell: switches to the recruiter view."],
  examples: ["exit"],
  seeAlso: ["human", "reboot"],
  run(_args, _flags, ctx) {
    const note = ctx.env.surface === "console" ? "closing console…" : "logout — switching to the recruiter view…";
    return { output: [out(seg(note, "faint"))], effects: [{ type: "exit" }] };
  },
};

const human: Command = {
  name: "human",
  group: "actions",
  summary: "switch to the recruiter view",
  usage: "human",
  description: ["Switches to the recruiter view: the work at a glance. Press the backtick key there to drop the shell back down."],
  examples: ["human"],
  seeAlso: ["exit", "reboot", "gui"],
  run() {
    return { effects: [{ type: "mode", mode: "human" }] };
  },
};

const reboot: Command = {
  name: "reboot",
  group: "actions",
  summary: "replay the bootloader",
  usage: "reboot",
  description: ["Restarts Kernel at the boot menu, where you can pick the recruiter view or the shell."],
  examples: ["reboot"],
  seeAlso: ["human", "exit"],
  run() {
    return { output: [out(seg("rebooting…", "faint"))], effects: [{ type: "navigate", href: "/?boot=1" }] };
  },
};

const fullscreen: Command = {
  name: "fullscreen",
  group: "actions",
  summary: "open the full shell (from the console)",
  usage: "fullscreen",
  description: ["From the drop-down console, opens the full-screen shell with the same history."],
  examples: ["fullscreen"],
  seeAlso: ["exit"],
  run(_args, _flags, ctx) {
    if (ctx.env.surface !== "console") return fail("fullscreen: already in the full shell");
    return { effects: [{ type: "navigate", href: "/shell" }] };
  },
};

export const actionCommands = [open, runCmd, graph, gui, recruiter, human, reboot, fullscreen, clear, sudo, exit];
```

Check `fail(...)` prints only its first argument as the text (the test expects exactly `fullscreen: already in the full shell`); if `fail` adds a second line, pass only one argument as above.

(c) `components/kernel/Shell.tsx`:
- `envRef` initial value and the env effect: add `surface: "page"` (Task 7 makes it variant-aware).
- in `perform` add before the closing of the switch:
  ```ts
        case "exit":
          kernel.setMode("human");
          router.push("/");
          return;
  ```
- in `applyAction` the `human` hint added in Task 2 now resolves to a real command (no change needed).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/shell`
Expected: PASS, including `tests/shell/info.test.ts` "every command has a complete manual" and the completion tests (new commands appear in `help`).

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add core/shell components/kernel/Shell.tsx tests/shell
git commit -m "feat(shell): human, reboot, fullscreen and a real exit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: The Recruiter page (front door at `/`)

**Files:**
- Create: `core/front.ts`, `components/front/Hero.tsx`, `components/front/ProofStrip.tsx`, `components/front/Flagships.tsx`, `components/front/FlagshipCard.tsx`, `components/front/Experience.tsx`, `components/front/Stack.tsx`, `components/front/HowIThink.tsx`
- Modify: `app/(gui)/page.tsx` (replace placeholder), `components/architecture/ArchitectureDiagram.tsx` (optional `className`), `components/shell/Footer.tsx`
- Test: `tests/front.test.ts`, `tests/front-page.test.tsx`

**Interfaces:**
- Consumes: `formatPeriod(start, end?)` from `core/format`, `TECH_CATEGORIES` from `core/schema`, content getters, `ArchitectureDiagram`, `useMotionAllowed`.
- Produces:
  - `flagships(p, limit = 3): System[]` — featured systems, or the first systems if none are featured.
  - `proofStats(p, limit = 3): { value: string; label: string; slug: string }[]` — first `impact` entry of each flagship that has one.
  - `outcomeOf(s: System): string` — `"<value> <label>"` of the first impact, else the tagline.
  - `timeline(p): { id: string; role: string; organisation: string; period: string; highlight: string }[]` — newest first (content order), highlight = first commit message, else the summary.
  - `stackGroups(p): { category: TechCategory; names: string[] }[]` — non-empty categories in `TECH_CATEGORIES` order.
  - `askChips(p): string[]` — three recruiter questions using the first name (used in Task 6).
  - DOM contract for Task 9's morph: the hero `<h1>` has class `vt-boot` and style `--vt: kernel-name`; each flagship card root has class `vt-boot` and `--vt: boot-system-<slug>`. The hero section has `id="top"`, the Ask slot is `<div id="ask-slot">` (Task 6 fills it), the principles section has `id="human"`.

- [ ] **Step 1: Write the failing test `tests/front.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { askChips, flagships, outcomeOf, proofStats, stackGroups, timeline } from "@/core/front";
import type { Portfolio } from "@/core/schema";

const first = portfolio.systems[0];
const minimal: Portfolio = {
  ...portfolio,
  systems: [{ ...first, featured: false, impact: undefined }],
  experience: [],
  technologies: [],
};

describe("front page selectors", () => {
  it("flagships prefer featured systems, max three", () => {
    const f = flagships(portfolio);
    expect(f.length).toBeLessThanOrEqual(3);
    expect(f.every((s) => s.featured)).toBe(true);
  });

  it("falls back to any system when none are featured", () => {
    expect(flagships(minimal).map((s) => s.slug)).toEqual([first.slug]);
  });

  it("proof stats come only from real impact entries", () => {
    for (const stat of proofStats(portfolio)) {
      const s = portfolio.systems.find((x) => x.slug === stat.slug)!;
      expect(s.impact?.[0]).toMatchObject({ value: stat.value, label: stat.label });
    }
    expect(proofStats(minimal)).toEqual([]);
  });

  it("outcome leads with impact, else the tagline", () => {
    expect(outcomeOf({ ...first, impact: [{ value: "40%", label: "faster triage" }] })).toBe("40% faster triage");
    expect(outcomeOf({ ...first, impact: undefined })).toBe(first.tagline);
  });

  it("timeline keeps content order and has an empty state", () => {
    const t = timeline(portfolio);
    expect(t.map((e) => e.id)).toEqual(portfolio.experience.map((e) => e.id));
    expect(t[0].period.length).toBeGreaterThan(0);
    expect(timeline(minimal)).toEqual([]);
  });

  it("stack groups skip empty categories", () => {
    const groups = stackGroups(portfolio);
    expect(groups.every((g) => g.names.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.names).sort()).toEqual(portfolio.technologies.map((t) => t.name).sort());
    expect(stackGroups(minimal)).toEqual([]);
  });

  it("ask chips use the first name", () => {
    const name = portfolio.identity.name.split(/\s+/)[0];
    const chips = askChips(portfolio);
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => c.includes(name))).toBe(true);
  });
});
```

Create `tests/front-page.test.tsx`:

```tsx
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FrontPage from "@/app/(gui)/page";
import { portfolio } from "@/core/content";
import { flagships } from "@/core/front";

describe("front page SSR", () => {
  it("server-renders the recruiter view with real content and the morph hooks", () => {
    const html = renderToString(<FrontPage />);
    expect(html).toContain(portfolio.identity.name);
    expect(html).toContain(portfolio.identity.role);
    expect(html).toContain('id="human"');
    expect(html).toContain('id="ask-slot"');
    expect(html).toContain("--vt:kernel-name");
    for (const s of flagships(portfolio)) {
      expect(html).toContain(`--vt:boot-system-${s.slug}`);
      expect(html).toContain(`href="/systems/${s.slug}"`);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/front.test.ts tests/front-page.test.tsx`
Expected: FAIL — `@/core/front` missing; the placeholder page lacks `id="human"`.

- [ ] **Step 3: Create `core/front.ts`**

```ts
import { formatPeriod } from "./format";
import { TECH_CATEGORIES, type Portfolio, type System, type TechCategory } from "./schema";

export function flagships(p: Portfolio, limit = 3): System[] {
  const featured = p.systems.filter((s) => s.featured);
  return (featured.length ? featured : p.systems).slice(0, limit);
}

export function proofStats(p: Portfolio, limit = 3): { value: string; label: string; slug: string }[] {
  return flagships(p)
    .flatMap((s) => (s.impact?.[0] ? [{ value: s.impact[0].value, label: s.impact[0].label, slug: s.slug }] : []))
    .slice(0, limit);
}

export function outcomeOf(s: System): string {
  const i = s.impact?.[0];
  return i ? `${i.value} ${i.label}` : s.tagline;
}

export function timeline(p: Portfolio) {
  return p.experience.map((e) => ({
    id: e.id,
    role: e.role,
    organisation: e.organisation,
    period: formatPeriod(e.start, e.end),
    highlight: e.commits[0]?.message ?? e.summary,
  }));
}

export function stackGroups(p: Portfolio): { category: TechCategory; names: string[] }[] {
  return TECH_CATEGORIES.map((category) => ({
    category,
    names: p.technologies.filter((t) => t.category === category).map((t) => t.name),
  })).filter((g) => g.names.length > 0);
}

export function askChips(p: Portfolio): string[] {
  const first = p.identity.name.split(/\s+/)[0];
  return [`What kind of role is ${first} looking for?`, `What is ${first}'s strongest project?`, `How does ${first} work in a team?`];
}
```

Run: `npx vitest run tests/front.test.ts`
Expected: PASS.

- [ ] **Step 4: `ArchitectureDiagram` gets an optional `className`**

In `components/architecture/ArchitectureDiagram.tsx` add `className = "h-auto w-full min-w-[720px]",` to the destructured props, `className?: string;` to the props type, and use `className={className}` on the root `<svg>` (replacing the literal).

- [ ] **Step 5: Create the section components**

`components/front/Hero.tsx`:

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import { btnGhost, btnPrimary } from "@/components/ui/styles";
import type { Identity } from "@/core/schema";

export function Hero({ identity }: { identity: Identity }) {
  return (
    <section id="top" aria-labelledby="hero-name" className="pt-14 sm:pt-24">
      {identity.availability && (
        <p className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-accent">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
          {identity.availability}
        </p>
      )}
      <h1 id="hero-name" className="vt-boot mt-5 text-4xl font-semibold tracking-tight sm:text-6xl" style={{ "--vt": "kernel-name" } as CSSProperties}>
        {identity.name}
      </h1>
      <p className="mt-3 text-lg text-muted sm:text-xl">
        {identity.role}
        {identity.location ? ` · ${identity.location}` : ""}
      </p>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text">{identity.tagline}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/connect" className={btnPrimary}>
          Contact
        </Link>
        {identity.links.resume && (
          <a href={identity.links.resume} className={btnGhost} download>
            Résumé ↓
          </a>
        )}
        <a href="#ask" className="inline-flex items-center px-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline">
          Ask about me →
        </a>
      </div>
    </section>
  );
}
```

`components/front/ProofStrip.tsx`:

```tsx
export function ProofStrip({ stats }: { stats: { value: string; label: string; slug: string }[] }) {
  if (stats.length === 0) return null;
  return (
    <section aria-label="Impact" className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.slug} className="bg-surface p-6">
          <p className="text-3xl font-semibold tracking-tight text-accent sm:text-4xl">{s.value}</p>
          <p className="mt-2 text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
```

`components/front/FlagshipCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import type { System } from "@/core/schema";
import { useMotionAllowed } from "@/lib/use-motion-allowed";

export function FlagshipCard({ system, outcome, stack }: { system: System; outcome: string; stack: string[] }) {
  const [peek, setPeek] = useState(false);
  const motion = useMotionAllowed();
  return (
    <article
      className="vt-boot group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-border-strong"
      style={{ "--vt": `boot-system-${system.slug}` } as CSSProperties}
      onPointerEnter={() => setPeek(true)}
      onPointerLeave={() => setPeek(false)}
      onFocus={() => setPeek(true)}
      onBlur={() => setPeek(false)}
    >
      <p className="font-mono text-[11px] text-faint">{system.category}</p>
      <h3 className="mt-1 text-lg font-semibold">{system.name}</h3>
      <p className="mt-2 text-sm font-medium text-accent">{outcome}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{system.summary}</p>
      <div className={`mt-4 overflow-hidden rounded-md border border-border bg-bg transition-all duration-300 ${peek ? "max-h-56 opacity-100" : "max-h-0 border-transparent opacity-0"}`} aria-hidden={!peek}>
        {peek && (
          <ArchitectureDiagram
            architecture={system.architecture}
            focusId={null}
            activeId={null}
            motion={motion}
            onHover={() => {}}
            onSelect={() => {}}
            className="h-auto w-full"
          />
        )}
      </div>
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Stack">
        {stack.map((t) => (
          <li key={t} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {t}
          </li>
        ))}
      </ul>
      <Link href={`/systems/${system.slug}`} className="mt-auto pt-5 text-sm text-text underline-offset-4 hover:underline">
        Case study →
      </Link>
    </article>
  );
}
```

`components/front/Flagships.tsx`:

```tsx
import { SectionLabel } from "@/components/ui/SectionLabel";
import { outcomeOf } from "@/core/front";
import type { Portfolio, System } from "@/core/schema";
import { FlagshipCard } from "./FlagshipCard";

export function Flagships({ systems, p }: { systems: System[]; p: Portfolio }) {
  if (systems.length === 0) return null;
  const nameOf = (id: string) => p.technologies.find((t) => t.id === id)?.name ?? id;
  return (
    <section aria-labelledby="work" className="mt-20">
      <SectionLabel>Selected work</SectionLabel>
      <h2 id="work" className="mt-3 text-2xl font-semibold tracking-tight">What I&apos;ve built</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {systems.map((s) => (
          <FlagshipCard key={s.slug} system={s} outcome={outcomeOf(s)} stack={s.technologies.slice(0, 5).map(nameOf)} />
        ))}
      </div>
    </section>
  );
}
```

`components/front/Experience.tsx`:

```tsx
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { timeline } from "@/core/front";

export function Experience({ entries }: { entries: ReturnType<typeof timeline> }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="experience" className="mt-20">
      <SectionLabel>Experience</SectionLabel>
      <h2 id="experience" className="sr-only">Experience</h2>
      <ol className="mt-5 divide-y divide-border rounded-lg border border-border">
        {entries.map((e) => (
          <li key={e.id} className="grid gap-1 p-5 sm:grid-cols-[1fr_auto] sm:gap-6">
            <div>
              <p className="font-semibold">
                {e.role} <span className="font-normal text-muted">· {e.organisation}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{e.highlight}</p>
            </div>
            <p className="font-mono text-xs text-faint sm:text-right">{e.period}</p>
          </li>
        ))}
      </ol>
      <Link href="/trace" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        Full history →
      </Link>
    </section>
  );
}
```

`components/front/Stack.tsx`:

```tsx
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { stackGroups } from "@/core/front";

export function Stack({ groups }: { groups: ReturnType<typeof stackGroups> }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="stack" className="mt-20">
      <SectionLabel>Stack</SectionLabel>
      <h2 id="stack" className="sr-only">Stack</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.category} className="flex flex-wrap items-baseline gap-2">
            <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-wider text-faint">{g.category}</dt>
            {g.names.map((n) => (
              <dd key={n} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                {n}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <Link href="/graph" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-text hover:underline">
        See how it connects →
      </Link>
    </section>
  );
}
```

`components/front/HowIThink.tsx` (content of the old `/human` page):

```tsx
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { Identity } from "@/core/schema";

export function HowIThink({ identity }: { identity: Identity }) {
  return (
    <section id="human" aria-labelledby="human-title" className="mt-20 scroll-mt-20">
      <SectionLabel>How I think</SectionLabel>
      <h2 id="human-title" className="mt-3 text-2xl font-semibold tracking-tight">Behind the systems</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">{identity.human.about}</p>
      {identity.principles.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {identity.principles.map((p, i) => (
            <article key={p.title} className="rounded-lg border border-border bg-surface p-6">
              <p className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </article>
          ))}
        </div>
      )}
      {identity.human.interests.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Interests">
          {identity.human.interests.map((x) => (
            <li key={x} className="rounded-full border border-border px-3 py-1 text-sm text-muted">
              {x}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Replace `app/(gui)/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Experience } from "@/components/front/Experience";
import { Flagships } from "@/components/front/Flagships";
import { Hero } from "@/components/front/Hero";
import { HowIThink } from "@/components/front/HowIThink";
import { ProofStrip } from "@/components/front/ProofStrip";
import { Stack } from "@/components/front/Stack";
import { portfolio } from "@/core/content";
import { flagships, proofStats, stackGroups, timeline } from "@/core/front";

const identity = portfolio.identity;

export const metadata: Metadata = { title: { absolute: `${identity.name} — ${identity.role}` }, description: identity.tagline };

export default function FrontPage() {
  return (
    <div className="pb-10">
      <Hero identity={identity} />
      <ProofStrip stats={proofStats(portfolio)} />
      <Flagships systems={flagships(portfolio)} p={portfolio} />
      <div id="ask-slot" />
      <Experience entries={timeline(portfolio)} />
      <Stack groups={stackGroups(portfolio)} />
      <HowIThink identity={identity} />
    </div>
  );
}
```

`components/shell/Footer.tsx` — replace the right-hand `<p>` with:

```tsx
        <p className="flex items-center gap-2">
          Curious how this was built? <Kbd>`</Kbd> console <span aria-hidden>·</span> <Kbd>⌘K</Kbd> shell <span aria-hidden>·</span> <Kbd>/</Kbd> ask
        </p>
```

- [ ] **Step 7: Run tests and build**

Run: `npx vitest run tests/front.test.ts tests/front-page.test.tsx`
Expected: PASS. (React serialises the inline custom property as `--vt:kernel-name`; if the renderer emits a space, adjust both assertions to the emitted form.)

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: clean; `/` is static (`○`).

Browser (production server on :3100, desktop and 390 px): `/` shows hero, proof strip (or none, if no impact), three cards whose diagram peeks on hover/focus, experience, stack, "How I think"; `/human` lands on `/#human`.

- [ ] **Step 8: Commit**

```bash
git add -A core/front.ts components app tests
git commit -m "feat(front): recruiter front door — hero, proof, flagship cards with diagram peek, experience, stack, principles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: "Ask about me" on the front page (shared conversation logic)

**Files:**
- Create: `components/query/conversation.ts` (pure), `components/query/useConversation.ts` (hook), `components/query/MessageList.tsx`, `components/front/AskInline.tsx`
- Modify: `components/query/QueryPanel.tsx`, `app/(gui)/page.tsx`
- Test: `tests/conversation.test.ts` (new), `tests/front-page.test.tsx`

**Interfaces:**
- Consumes: `askChips(p)` (Task 5), `validateAction`, `actionToHref`, `describeAction` (`core/actions`), `QueryEvent` (type, `server/query-handler`), `createLineDecoder` (`components/query/stream`), `kernel.setMode` (Task 2).
- Produces:
  - `MAX_CHARS = 500`, `type Message`, `historyFor(messages: Message[], question: string): { role: "user" | "assistant"; content: string }[]`, `applyEvent(m: Message, e: QueryEvent, p: Portfolio, autoRun = true): Message` — all in `components/query/conversation.ts`.
  - `useConversation(opts: { autoRun: boolean; onAction?: (a: UiAction) => void; onSettled?: (ranAction: boolean) => void }): { messages: Message[]; busy: boolean; submit: (q: string) => Promise<void>; clear: () => void }`.
  - `<MessageList messages onSuggestion? />` — with no `onSuggestion`, suggestions render as links (`actionToHref`), so it needs no router.
  - `<AskInline chips: string[]; name: string />` rendering `<section id="ask">`.

- [ ] **Step 1: Write the failing test `tests/conversation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { applyEvent, historyFor, type Message } from "@/components/query/conversation";
import { portfolio } from "@/core/content";

const blank: Message = { role: "assistant", content: "", pending: true };
const slug = portfolio.systems[0].slug;

describe("applyEvent", () => {
  it("accumulates text and metadata", () => {
    let m = applyEvent(blank, { type: "meta", mode: "local", sources: [] }, portfolio);
    m = applyEvent(m, { type: "text", text: "Hel" }, portfolio);
    m = applyEvent(m, { type: "text", text: "lo" }, portfolio);
    expect(m).toMatchObject({ content: "Hello", mode: "local", sources: [] });
  });

  it("records valid actions; drops invalid ones", () => {
    const m = applyEvent(blank, { type: "action", action: { type: "openSystem", slug } }, portfolio);
    expect(m.actions).toEqual([{ type: "openSystem", slug }]);
    expect(applyEvent(blank, { type: "action", action: { type: "openSystem", slug: "nope" } }, portfolio)).toEqual(blank);
  });

  it("without autoRun, actions become suggestions (the page never navigates on its own)", () => {
    const m = applyEvent(blank, { type: "action", action: { type: "openSystem", slug } }, portfolio, false);
    expect(m.actions).toBeUndefined();
    expect(m.suggestions).toEqual([{ type: "openSystem", slug }]);
  });

  it("keeps errors", () => {
    expect(applyEvent(blank, { type: "error", message: "rate limited" }, portfolio).error).toBe("rate limited");
  });
});

describe("historyFor", () => {
  it("drops errored turns, trims to 12 and starts with the user", () => {
    const msgs: Message[] = [
      { role: "assistant", content: "hi" },
      { role: "user", content: "q1" },
      { role: "assistant", content: "", error: "boom" },
      { role: "assistant", content: "a1" },
    ];
    expect(historyFor(msgs, "q2")).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
    const many: Message[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const h = historyFor(many, "last");
    expect(h.length).toBeLessThanOrEqual(12);
    expect(h[0].role).toBe("user");
    expect(h.at(-1)).toEqual({ role: "user", content: "last" });
  });
});
```

In `tests/front-page.test.tsx` replace `expect(html).toContain('id="ask-slot"');` with:
```tsx
    expect(html).toContain('id="ask"');
    for (const chip of askChips(portfolio)) expect(html).toContain(chip.replace(/'/g, "&#x27;"));
```
and add `import { askChips, flagships } from "@/core/front";` (replacing the `flagships`-only import).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/conversation.test.ts tests/front-page.test.tsx`
Expected: FAIL — module `conversation` missing; `id="ask"` absent.

- [ ] **Step 3: Create `components/query/conversation.ts`**

```ts
import { validateAction, type UiAction } from "@/core/actions";
import type { Source } from "@/core/query";
import type { Portfolio } from "@/core/schema";
import type { QueryEvent } from "@/server/query-handler";

export const MAX_CHARS = 500;

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  actions?: UiAction[];
  suggestions?: UiAction[];
  mode?: "ai" | "local";
  error?: string;
  pending?: boolean;
};

export type Turn = { role: "user" | "assistant"; content: string };

/** Conversation sent to /api/query: no failed turns, last 12, starting with the visitor. */
export function historyFor(messages: Message[], question: string): Turn[] {
  const history: Turn[] = [
    ...messages.filter((m) => m.content && !m.error).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
    { role: "user", content: question },
  ].slice(-12);
  while (history.length > 1 && history[0].role !== "user") history.shift();
  return history;
}

/** Folds one streamed event into the assistant message. With autoRun off, actions are offered as suggestions instead. */
export function applyEvent(m: Message, e: QueryEvent, p: Portfolio, autoRun = true): Message {
  switch (e.type) {
    case "meta":
      return { ...m, mode: e.mode, sources: e.sources };
    case "text":
      return { ...m, content: m.content + e.text };
    case "action":
    case "suggestion": {
      const a = validateAction(e.action, p);
      if (!a) return m;
      return e.type === "action" && autoRun
        ? { ...m, actions: [...(m.actions ?? []), a] }
        : { ...m, suggestions: [...(m.suggestions ?? []), a] };
    }
    case "error":
      return { ...m, error: e.message };
    default:
      return m;
  }
}
```

Run: `npx vitest run tests/conversation.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `components/query/useConversation.ts`** (the fetch/stream logic moved out of `QueryPanel.submit`)

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateAction, type UiAction } from "@/core/actions";
import { portfolio } from "@/core/content";
import type { QueryEvent } from "@/server/query-handler";
import { applyEvent, historyFor, MAX_CHARS, type Message } from "./conversation";
import { createLineDecoder } from "./stream";

export function useConversation(opts: { autoRun: boolean; onAction?: (a: UiAction) => void; onSettled?: (ranAction: boolean) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const optsRef = useRef(opts);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    optsRef.current = opts;
  });

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms));

  const submit = useCallback(async (raw: string) => {
    const question = raw.trim().slice(0, MAX_CHARS);
    if (!question || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const history = historyFor(messagesRef.current, question);
    setMessages((ms) => [...ms, { role: "user", content: question }, { role: "assistant", content: "", pending: true }]);
    const { autoRun, onAction } = optsRef.current;
    let ranAction = false;

    const onEvent = (e: QueryEvent) => {
      if (e.type === "action" || e.type === "suggestion") {
        const action = validateAction(e.action, portfolio);
        if (!action) {
          if (process.env.NODE_ENV !== "production") console.debug(`[kernel] dropped ${e.type}`, e.action);
          return;
        }
        if (e.type === "action" && autoRun) {
          ranAction = true;
          onAction?.(action);
        }
      }
      updateLast((m) => applyEvent(m, e, portfolio, autoRun));
    };

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        updateLast((m) => ({ ...m, error: data.error ?? "Something went wrong. Try again." }));
      } else {
        const reader = res.body.getReader();
        const textDecoder = new TextDecoder();
        const lines = createLineDecoder(onEvent);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lines.push(textDecoder.decode(value, { stream: true }));
        }
        lines.flush();
      }
    } catch {
      updateLast((m) => ({ ...m, error: "Network error — check your connection and try again." }));
    } finally {
      updateLast((m) => ({ ...m, pending: false }));
      busyRef.current = false;
      setBusy(false);
      optsRef.current.onSettled?.(ranAction);
    }
  }, []);

  const clear = useCallback(() => setMessages([]), []);
  return { messages, busy, submit, clear };
}
```

- [ ] **Step 5: Create `components/query/MessageList.tsx`** (the `<ol>` from `QueryPanel`, unchanged markup, suggestions as buttons or links)

```tsx
"use client";

import Link from "next/link";
import { actionToHref, describeAction, type UiAction } from "@/core/actions";
import { portfolio } from "@/core/content";
import { kernel } from "@/lib/store";
import type { Message } from "./conversation";
import { Markdown } from "./Markdown";

const suggestionLabel = (a: UiAction) =>
  describeAction(a, portfolio).replace(/^Opened/, "Open").replace(/^Highlighted/, "Highlight").replace(/^Went to/, "Go to").replace(/^Switched to/, "Switch to");
const suggestionClass = "rounded border border-accent/40 px-2 py-1 font-mono text-[11px] text-accent hover:bg-accent-soft";

export function MessageList({ messages, onSuggestion }: { messages: Message[]; onSuggestion?: (a: UiAction) => void }) {
  return (
    <ol className="space-y-5">
      {messages.map((m, i) => (
        <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
          {m.role === "user" ? (
            <p className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{m.content}</p>
          ) : (
            <div className="text-sm leading-relaxed text-muted">
              {m.content ? <Markdown text={m.content} /> : m.pending ? <p className="cursor-blink text-accent">▍</p> : null}
              {m.actions?.map((a, j) => (
                <p key={j} className="mt-2 font-mono text-[11px] text-accent">
                  ↳ {describeAction(a, portfolio)}
                </p>
              ))}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.suggestions.map((a, j) =>
                    onSuggestion ? (
                      <button key={j} type="button" onClick={() => onSuggestion(a)} className={suggestionClass}>
                        {suggestionLabel(a)}
                      </button>
                    ) : (
                      <Link
                        key={j}
                        href={actionToHref(a) ?? "/"}
                        onClick={() => a.type === "switchMode" && kernel.setMode(a.mode)}
                        className={suggestionClass}
                      >
                        {suggestionLabel(a)}
                      </Link>
                    ),
                  )}
                </div>
              )}
              {m.sources && m.sources.length > 0 && !m.pending && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">sources</span>
                  {m.sources.slice(0, 4).map((s) => (
                    <Link key={`${s.kind}:${s.id}`} href={s.href} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-text">
                      {s.title}
                    </Link>
                  ))}
                </div>
              )}
              {m.error && <p className="mt-2 text-sm text-[var(--k-model)]">{m.error}</p>}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 6: Refactor `components/query/QueryPanel.tsx` onto the hook**

- Remove: the local `MAX_CHARS` and `Message` declarations, the `messages`/`busy`/`busyRef`/`messagesRef` state, `updateLast`, and the whole `submit` `useCallback`; remove imports no longer used (`validateAction`, `describeAction`, `type UiAction`, `Source`, `Markdown`, `createLineDecoder`, `QueryEvent`, `Link` if unused).
- Add imports: `import { MAX_CHARS } from "./conversation";`, `import { MessageList } from "./MessageList";`, `import { useConversation } from "./useConversation";`.
- After `const returnFocus = …` add:
  ```ts
    const { messages, busy, submit, clear } = useConversation({
      autoRun: true,
      onAction: runAction,
      onSettled: (ranAction) => {
        if (ranAction && window.matchMedia("(max-width: 767px)").matches) kernel.closeQuery();
      },
    });
    const send = (q: string) => {
      if (busy || !q.trim()) return;
      setInput("");
      void submit(q);
    };
  ```
- Keep the scroll effect but only `scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });` inside `useEffect(..., [messages])`.
- Replace every `void submit(q)` / `void submit(input)` in JSX with `send(q)` / `send(input)`; the seeded-question effect keeps `void submit(seed)`.
- The "clear" button: `onClick={clear}`.
- Replace the whole `<ol className="space-y-5"> … </ol>` with `<MessageList messages={messages} onSuggestion={runAction} />`.

- [ ] **Step 7: Create `components/front/AskInline.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MAX_CHARS } from "@/components/query/conversation";
import { MessageList } from "@/components/query/MessageList";
import { useConversation } from "@/components/query/useConversation";
import { SectionLabel } from "@/components/ui/SectionLabel";

export function AskInline({ chips, name }: { chips: string[]; name: string }) {
  const { messages, busy, submit, clear } = useConversation({ autoRun: false });
  const [input, setInput] = useState("");
  const send = (q: string) => {
    if (busy || !q.trim()) return;
    setInput("");
    void submit(q);
  };
  const offline = [...messages].reverse().find((m) => m.role === "assistant")?.mode === "local";

  return (
    <section id="ask" aria-labelledby="ask-title" className="mt-20 scroll-mt-20 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <SectionLabel>Ask about me</SectionLabel>
        {offline && (
          <span className="rounded border border-dashed border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-faint" title="AI is unavailable — answering from local search">
            offline mode
          </span>
        )}
        {messages.length > 0 && (
          <button type="button" onClick={clear} disabled={busy} className="ml-auto font-mono text-[11px] text-muted hover:text-text">
            clear
          </button>
        )}
      </div>
      <h2 id="ask-title" className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        Ask anything — answers come only from {name}&apos;s real work.
      </h2>

      {messages.length > 0 && (
        <div className="mt-5" aria-live="polite">
          <MessageList messages={messages} />
        </div>
      )}

      {messages.length === 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {chips.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => send(q)} className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-border-strong hover:text-text">
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 focus-within:border-border-strong"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          maxLength={MAX_CHARS}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What has been built with agents?"
          aria-label="Ask about the work"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-contrast disabled:opacity-40">
          Ask
        </button>
      </form>
    </section>
  );
}
```

In `app/(gui)/page.tsx`: import `AskInline` and `askChips`; replace `<div id="ask-slot" />` with
```tsx
      <AskInline chips={askChips(portfolio)} name={identity.name.split(/\s+/)[0]} />
```

- [ ] **Step 8: Run tests and verify**

Run: `npx vitest run tests/conversation.test.ts tests/front-page.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: clean.

Browser (:3100, no `GEMINI_API_KEY`): on `/` click a chip → the answer appears inline with the "offline mode" badge, suggestions are links, the page does not navigate by itself; `clear` resets to chips. Press `/` → the Query panel still works exactly as before (answers, auto-run actions, suggestions as buttons, clear).

- [ ] **Step 9: Commit**

```bash
git add -A components app tests
git commit -m "feat(front): inline Ask about me; query panel and front page share one conversation hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Mode switching — pill, reboot flash, mode sync, shell handoff and console-ready Shell

**Files:**
- Create: `lib/mode.ts`, `components/shell/ModeSwitch.tsx`
- Modify: `core/boot.ts` (add `modeForPath`), `core/shell/fs.ts` (add `parseCwd`), `components/kernel/Shell.tsx`, `components/shell/Header.tsx`, `components/shell/Overlays.tsx`
- Test: `tests/mode.test.ts` (new)

**Interfaces:**
- Consumes: `kernel.setMode`, `kernel.setReboot`, `kernel.takeHandoff`, `kernelSnapshot`, `readBootPrefs` (Task 2); `Effect` `mode`/`exit` and `RuntimeEnv.surface` (Tasks 2, 4).
- Produces:
  - `modeForPath(pathname: string): Mode` in `core/boot.ts` — `"shell"` for `/shell` and below, else `"human"`.
  - `parseCwd(raw: string | null, root: DirNode): string[]` in `core/shell/fs.ts` — a stored cwd if it is still a directory, else `[]`.
  - `switchMode(mode: Mode, router: { push(href: string): void }, motion: boolean): Promise<void>` and `MODE_HOME: Record<Mode, string>` in `lib/mode.ts`.
  - `<ModeSwitch className? />` (radiogroup "human / shell").
  - `Shell` props `{ graph; initial; variant?: "page" | "console"; onExit?: () => void }`.
  - sessionStorage key `kernel:cwd` (JSON array of path segments).

- [ ] **Step 1: Write the failing test `tests/mode.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { modeForPath } from "@/core/boot";
import { portfolio } from "@/core/content";
import { buildFs, parseCwd } from "@/core/shell/fs";

describe("modeForPath", () => {
  it("maps routes to modes", () => {
    expect(modeForPath("/shell")).toBe("shell");
    expect(modeForPath("/shell/")).toBe("shell");
    for (const p of ["/", "/systems", "/systems/atlas", "/graph", "/shellfish"]) expect(modeForPath(p), p).toBe("human");
  });
});

describe("parseCwd", () => {
  const root = buildFs(portfolio);
  const slug = portfolio.systems[0].slug;

  it("restores a directory that still exists", () => {
    expect(parseCwd(JSON.stringify(["systems"]), root)).toEqual(["systems"]);
    expect(parseCwd(JSON.stringify(["systems", slug]), root)).toEqual(["systems", slug]);
  });

  it("parseCwd rejects unknown or malformed paths", () => {
    for (const raw of [null, "", "garbage", "{}", "[1]", JSON.stringify(["nope"]), JSON.stringify(["systems", ".."]), JSON.stringify(["systems/x"])]) {
      expect(parseCwd(raw, root), String(raw)).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mode.test.ts`
Expected: FAIL — `modeForPath` / `parseCwd` not exported.

- [ ] **Step 3: Implement the pure helpers**

Append to `core/boot.ts`:

```ts
export const modeForPath = (pathname: string): Mode => (pathname === "/shell" || pathname.startsWith("/shell/") ? "shell" : "human");
```

Append to `core/shell/fs.ts`:

```ts
/** A cwd saved in sessionStorage, if it is still a plain path to a directory; otherwise home. */
export function parseCwd(raw: string | null, root: DirNode): string[] {
  if (!raw) return [];
  try {
    const parts: unknown = JSON.parse(raw);
    if (!Array.isArray(parts) || !parts.every((s) => typeof s === "string" && s && s !== "." && s !== ".." && !s.includes("/"))) return [];
    return isDir(resolve(root, [], parts.join("/"))) ? (parts as string[]) : [];
  } catch {
    return [];
  }
}
```

Run: `npx vitest run tests/mode.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `lib/mode.ts`**

```ts
"use client";

import type { Mode } from "@/core/boot";
import { kernel } from "./store";

export const MODE_HOME: Record<Mode, string> = { human: "/", shell: "/shell" };
const FLASH: Record<Mode, string> = { human: "[ ok ] switching to the recruiter view…", shell: "[ ok ] switching to shell…" };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Saves the mode, plays a short reboot line (skipped without motion) and navigates to the mode's home. */
export async function switchMode(mode: Mode, router: { push(href: string): void }, motion: boolean) {
  kernel.setMode(mode);
  if (!motion) {
    router.push(MODE_HOME[mode]);
    return;
  }
  kernel.setReboot(FLASH[mode]);
  await sleep(400);
  router.push(MODE_HOME[mode]);
  await sleep(200);
  kernel.setReboot(null);
}
```

- [ ] **Step 5: Create `components/shell/ModeSwitch.tsx`**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { modeForPath, type Mode } from "@/core/boot";
import { switchMode } from "@/lib/mode";
import { useMotionAllowed } from "@/lib/use-motion-allowed";

const LABEL: Record<Mode, string> = { human: "human", shell: "shell" };

export function ModeSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const motion = useMotionAllowed();
  const current = modeForPath(pathname);
  return (
    <div role="radiogroup" aria-label="Interface" className={`inline-flex items-center rounded-full border border-border p-0.5 font-mono text-[11px] ${className}`}>
      {(["human", "shell"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={current === m}
          title={m === "human" ? "Recruiter view" : "Terminal"}
          onClick={() => current !== m && void switchMode(m, router, motion)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${current === m ? "bg-accent-soft text-accent" : "text-muted hover:text-text"}`}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${current === m ? "bg-accent" : "bg-faint"}`} />
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Header and Overlays**

`components/shell/Header.tsx`:
- import `ModeSwitch` from `./ModeSwitch`.
- remove the `>_ shell ⌘K` `<Link>` (the pill replaces it) and, if now unused, the `Kbd` import stays (used by "Ask").
- before `<ThemeToggle />` add `<ModeSwitch className="hidden sm:inline-flex" />`.
- in the mobile nav replace the `<div className="mt-2 flex gap-2 border-t border-border pt-3"> … </div>` block with:
  ```tsx
          <div className="mt-2 border-t border-border pt-3">
            <ModeSwitch />
          </div>
  ```

`components/shell/Overlays.tsx` — add mode sync and the reboot flash:

```tsx
// add imports
import { modeForPath } from "@/core/boot";
import { kernel, kernelSnapshot, readBootPrefs, useKernel } from "@/lib/store";

// inside Overlays(), after the existing keydown effect:
  // After the visitor has booted once, remember whichever mode they are using (so the next visit opens there).
  useEffect(() => {
    if (document.documentElement.dataset.boot || !readBootPrefs().menuSeen) return;
    const mode = modeForPath(pathname);
    if (kernelSnapshot().mode !== mode) kernel.setMode(mode);
  }, [pathname]);
  const reboot = useKernel((s) => s.reboot);

// return:
  return (
    <>
      <QueryPanel />
      {reboot && (
        <div role="status" className="fixed inset-0 z-[70] grid place-items-center bg-bg font-mono text-sm text-[var(--k-store)]">
          {reboot}
        </div>
      )}
    </>
  );
```

- [ ] **Step 7: `components/kernel/Shell.tsx` — variant, handoff, cwd, mode effects**

(a) Imports: add `import { buildFs, parseCwd, pathOf } from "@/core/shell/fs";` (replacing the `pathOf`-only import), `import { ModeSwitch } from "@/components/shell/ModeSwitch";`, `import { switchMode } from "@/lib/mode";`. Add `const CWD_KEY = "kernel:cwd";` next to `HISTORY_KEY`.

(b) Signature:
```tsx
export function Shell({
  graph,
  initial,
  variant = "page",
  onExit,
}: {
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  initial: OutputItem[];
  variant?: "page" | "console";
  onExit?: () => void;
}) {
```

(c) `envRef` and the env effect: `surface: variant` (instead of `"page"`), and add `variant` to the effect's dependency array.

(d) `perform`:
```ts
        case "mode":
          void switchMode(e.mode, router, motionRef.current);
          return;
        case "exit":
          if (onExit) onExit();
          else void switchMode("human", router, motionRef.current);
          return;
```
and add `onExit` to `perform`'s dependency array.

(e) In `run`, after `saveHistory(res.state.history);` add:
```ts
        try {
          window.sessionStorage.setItem(CWD_KEY, JSON.stringify(res.state.cwd));
        } catch {
          /* ignore */
        }
```

(f) Boot effect — replace from `stateRef.current = initialState(Date.now(), loadHistory());` through the `firstVisit` try/catch with:
```ts
    let savedCwd: string | null = null;
    try {
      savedCwd = window.sessionStorage.getItem(CWD_KEY);
    } catch {
      /* ignore */
    }
    const cwd0 = parseCwd(savedCwd, buildFs(portfolio));
    stateRef.current = { ...initialState(Date.now(), loadHistory()), cwd: cwd0 };
    setCwd(cwd0);
    const restored = stateRef.current.history.map((h) => h.command);
    const link = parseDeepLink(variant === "console" ? "" : window.location.search);
    // Boot lines handed over by the bootloader continue the transcript instead of replaying the boot animation.
    const handoff = variant === "page" ? kernel.takeHandoff() : null;
    if (handoff) {
      const handed: Row[] = handoff.map((item) => ({ id: ++idRef.current, kind: "item", item }));
      setRows((r) => [...handed, ...r]);
    }
    if (variant === "page") delete document.documentElement.dataset.boot; // the bootloader keeps the page covered until the shell is up
    let firstVisit = false;
    if (variant === "page") {
      try {
        firstVisit = !handoff && !window.sessionStorage.getItem(BOOT_KEY);
        window.sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        /* ignore */
      }
    }
```

(g) Top bar: replace
```tsx
        <Link href="/systems" className="ml-auto hover:text-text">
          gui ↗
        </Link>
```
with
```tsx
        {variant === "page" ? (
          <ModeSwitch className="ml-auto" />
        ) : (
          <>
            <span className="ml-auto hidden sm:inline">esc or ` to close</span>
            <button type="button" onClick={() => router.push("/shell")} className="hover:text-text" aria-label="Open the full shell">
              ⤢
            </button>
          </>
        )}
```
Remove the `Link` import if it is now unused.

(h) Root element: replace `className="fixed inset-0 z-30 flex flex-col bg-bg font-mono text-[13px] leading-[1.65] text-text"` with
```tsx
      className={`${variant === "page" ? "fixed inset-0 z-30" : "h-full"} flex flex-col bg-bg font-mono text-[13px] leading-[1.65] text-text`}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: clean.

Browser (:3100): on `/systems` the header pill shows `● human`; click `shell` → "[ ok ] switching to shell…" flashes ~0.4 s, then `/shell`. In the shell, the pill shows `● shell`; click `human` → back to `/`. In the shell: `cd systems`, reload → prompt is still `~/systems`; `exit` → recruiter view; `human` → recruiter view; `reboot` → `/?boot=1` (the menu arrives in Task 9; until then `/` renders normally). With reduced motion emulated: switches are instant (no flash).

- [ ] **Step 9: Commit**

```bash
git add -A core lib components tests
git commit -m "feat(modes): human/shell pill, reboot flash, mode sync, shell handoff + cwd restore, console-ready Shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: The `` ` `` drop-down console

**Files:**
- Create: `components/kernel/ConsoleDrawer.tsx`
- Modify: `components/kernel/keys.ts` (add `consoleKeyAction`), `components/shell/Overlays.tsx`, `app/globals.css`
- Test: `tests/console-keys.test.ts` (new)

**Interfaces:**
- Consumes: `Shell` with `variant="console"` and `onExit` (Task 7), `modeForPath` (Task 7), `layoutGraph`, `buildGraph`.
- Produces: `consoleKeyAction(k: { key: string; meta: boolean; ctrl: boolean; alt: boolean; editable: boolean; inConsole: boolean; pathname: string; open: boolean; booting: boolean }): "open" | "close" | null`; default-exported `ConsoleDrawer({ onClose })` rendering `#kernel-console`.

- [ ] **Step 1: Write the failing test `tests/console-keys.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { consoleKeyAction } from "@/components/kernel/keys";

const k = (patch: Partial<Parameters<typeof consoleKeyAction>[0]> = {}) =>
  consoleKeyAction({ key: "`", meta: false, ctrl: false, alt: false, editable: false, inConsole: false, pathname: "/", open: false, booting: false, ...patch });

describe("consoleKeyAction", () => {
  it("backtick opens the console on GUI pages", () => {
    expect(k()).toBe("open");
    expect(k({ pathname: "/systems/atlas" })).toBe("open");
  });

  it("console key ignores editable targets and modifiers", () => {
    expect(k({ editable: true })).toBeNull();
    expect(k({ meta: true })).toBeNull();
    expect(k({ ctrl: true })).toBeNull();
    expect(k({ alt: true })).toBeNull();
    expect(k({ key: "~" })).toBeNull();
  });

  it("closes with backtick (even from the console's own input) or Escape", () => {
    expect(k({ open: true })).toBe("close");
    expect(k({ open: true, editable: true, inConsole: true })).toBe("close");
    expect(k({ open: true, key: "Escape", editable: true, inConsole: true })).toBe("close");
    expect(k({ open: true, editable: true, inConsole: false })).toBeNull();
  });

  it("never acts in the full shell or while the bootloader is up", () => {
    expect(k({ pathname: "/shell" })).toBeNull();
    expect(k({ booting: true })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/console-keys.test.ts`
Expected: FAIL — `consoleKeyAction` is not exported.

- [ ] **Step 3: Implement `consoleKeyAction`** — append to `components/kernel/keys.ts`:

```ts
import { modeForPath } from "@/core/boot";

/** Quake-style console toggle: ` opens/closes it on GUI pages; Escape closes it. Never while typing elsewhere. */
export function consoleKeyAction(k: {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  editable: boolean;
  inConsole: boolean;
  pathname: string;
  open: boolean;
  booting: boolean;
}): "open" | "close" | null {
  if (k.booting || modeForPath(k.pathname) === "shell") return null;
  if (k.open && k.key === "Escape") return "close";
  if (k.key !== "`" || k.meta || k.ctrl || k.alt) return null;
  if (k.open) return k.editable && !k.inConsole ? null : "close";
  return k.editable ? null : "open";
}
```
(Place the `import` at the top of the file with the other imports.)

Run: `npx vitest run tests/console-keys.test.ts`
Expected: PASS.

- [ ] **Step 4: Create `components/kernel/ConsoleDrawer.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";
import { out, seg } from "@/core/shell/registry";
import { Shell } from "./Shell";

const INTRO = [
  out(
    seg("kernel console", "accent"),
    seg(" — try ", "faint"),
    seg("help", "accent", { run: "help" }),
    seg(" · ", "faint"),
    seg("exit", "accent", { run: "exit" }),
    seg(" closes · ", "faint"),
    seg("fullscreen", "accent", { run: "fullscreen" }),
    seg(" opens the full shell", "faint"),
  ),
];

/** Non-modal drop-down shell over GUI pages. Focus moves into it on open and back to the page on close. */
export default function ConsoleDrawer({ onClose }: { onClose: () => void }) {
  const graph = useMemo(() => layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 }), []);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.({ preventScroll: true });
  }, []);
  return (
    <div id="kernel-console" role="region" aria-label="Kernel console" className="console-drawer fixed inset-x-0 top-0 z-[45] h-[45vh] min-h-[280px] border-b border-border-strong shadow-2xl">
      <Shell graph={graph} initial={INTRO} variant="console" onExit={onClose} />
    </div>
  );
}
```

`app/globals.css` — append:

```css
/* Drop-down console (` on GUI pages); the global reduced-motion rule removes the slide. */
.console-drawer {
  animation: kernel-console-in 180ms ease-out;
}
@keyframes kernel-console-in {
  from {
    transform: translateY(-100%);
  }
}
```

- [ ] **Step 5: Wire it into `components/shell/Overlays.tsx`**

- imports: `import dynamic from "next/dynamic";`, `import { useRef, useState } from "react";` (merge with the existing `useEffect` import), `import { consoleKeyAction } from "@/components/kernel/keys";`
- module level: `const ConsoleDrawer = dynamic(() => import("@/components/kernel/ConsoleDrawer"), { ssr: false });`
- in the component:
  ```tsx
    const [consoleOpen, setConsoleOpen] = useState(false);
    const consoleOpenRef = useRef(false);
    useEffect(() => {
      consoleOpenRef.current = consoleOpen;
    }, [consoleOpen]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the console on navigation (e.g. `fullscreen`, `human`)
    useEffect(() => setConsoleOpen(false), [pathname]);
  ```
- at the very start of the existing `onKey` handler:
  ```ts
      const target = e.target as HTMLElement | null;
      const consoleAction = consoleKeyAction({
        key: e.key,
        meta: e.metaKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        editable: isTyping(e.target),
        inConsole: Boolean(target?.closest?.("#kernel-console")),
        pathname,
        open: consoleOpenRef.current,
        booting: Boolean(document.documentElement.dataset.boot),
      });
      if (consoleAction) {
        e.preventDefault();
        setConsoleOpen(consoleAction === "open");
        return;
      }
  ```
- in the returned fragment, before `<QueryPanel />`: `{consoleOpen && <ConsoleDrawer onClose={() => setConsoleOpen(false)} />}`

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: clean; the console chunk is not part of the `/` first-load JS (check the build output's First Load JS for `/` did not grow by the shell's size compared to Task 7's build).

Browser (:3100): on `/` press `` ` `` → the console slides down with focus in its prompt; `ls` works; `cd systems`, close with `` ` ``, open `/shell` (pill) → same history and `~/systems`; reopen the console on `/graph`, type `exit` → closes and focus returns to the page; `fullscreen` → `/shell`; typing `` ` `` in the Ask input types a backtick; on `/shell` `` ` `` does nothing special; Esc closes the console.

- [ ] **Step 7: Commit**

```bash
git add -A components app/globals.css tests
git commit -m "feat(console): Quake-style drop-down shell on every GUI page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: The bootloader — pre-paint cover, overlay, countdown, morph and handoff

**Files:**
- Create: `components/boot/BootOverlay.tsx`
- Modify: `app/layout.tsx` (inline `bootScript()`), `app/(gui)/layout.tsx` (mount the overlay), `app/globals.css`
- Test: `tests/boot-css.test.ts` (new)

**Interfaces:**
- Consumes: `bootLog`, `bootLogItems`, `bootScript`, `decideBoot`, `HYDRATION_WATCHDOG_MS`, `Mode` (Task 1); `kernel.setMode`, `kernel.handOff`, `readBootPrefs` (Task 2); the front page's `.vt-boot` / `--vt` hooks (Task 5); Shell clearing `data-boot` on mount (Task 7).
- Produces: `<BootOverlay />` (client; renders nothing unless `<html data-boot="on">` and `decideBoot(...).show`). `data-boot` lifecycle: `on` (pre-paint script) → `live` (overlay showing) → removed (booted human, or Shell mounted after booting shell).

**Why the overlay lives in `app/(gui)/layout.tsx`:** it uses `useRouter`, which throws outside the App Router (e.g. `renderToString` in `tests/front-page.test.tsx`). In the layout it still only activates on `/`, because only the pre-paint script on `/` sets `data-boot`.

- [ ] **Step 1: Write the failing test `tests/boot-css.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

describe("boot CSS contract", () => {
  it("covers the page before hydration and removes the cover after 1.5 s", () => {
    expect(css).toMatch(/:root\[data-boot="on"\] body::after\s*\{[^}]*position:\s*fixed[^}]*animation:\s*kernel-boot-watchdog 0s linear 1\.5s forwards/);
    expect(css).toMatch(/@keyframes kernel-boot-watchdog\s*\{\s*to\s*\{\s*visibility:\s*hidden/);
  });

  it("locks scrolling only while the overlay is live", () => {
    expect(css).toMatch(/:root\[data-boot="live"\] body\s*\{\s*overflow:\s*hidden/);
    expect(css).not.toMatch(/:root\[data-boot="on"\] body\s*\{\s*overflow/);
  });

  it("front-page morph names exist only when the boot overlay is gone", () => {
    expect(css).toMatch(/\.vt-boot\s*\{\s*view-transition-name:\s*var\(--vt\)/);
    expect(css).toMatch(/:root\[data-boot\] \.vt-boot\s*\{\s*view-transition-name:\s*none/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/boot-css.test.ts`
Expected: FAIL — rules missing.

- [ ] **Step 3: CSS** — append to `app/globals.css`:

```css
/*
 * Bootloader. The pre-paint script sets data-boot="on" on first visits: cover the page until the overlay hydrates
 * (it then sets "live"). If JS is slow the cover removes itself after 1.5 s and the page stays readable.
 */
:root[data-boot="on"] body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--bg);
  animation: kernel-boot-watchdog 0s linear 1.5s forwards;
}
@keyframes kernel-boot-watchdog {
  to {
    visibility: hidden;
  }
}
:root[data-boot="live"] body {
  overflow: hidden;
}

/* Boot morph: boot-log lines fly into the hero name and the system cards (names only once the overlay is gone). */
.vt-boot {
  view-transition-name: var(--vt);
  view-transition-class: boot;
}
:root[data-boot] .vt-boot {
  view-transition-name: none;
}
::view-transition-group(.boot) {
  animation-duration: 520ms;
  animation-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

Run: `npx vitest run tests/boot-css.test.ts`
Expected: PASS.

- [ ] **Step 4: Inline the pre-paint script** — `app/layout.tsx`:
- `import { bootScript } from "@/core/boot";`
- after the theme `<script>` in `<head>` add: `<script dangerouslySetInnerHTML={{ __html: bootScript() }} />`

- [ ] **Step 5: Create `components/boot/BootOverlay.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { bootLog, bootLogItems, decideBoot, HYDRATION_WATCHDOG_MS, type BootDecision, type Mode } from "@/core/boot";
import { portfolio } from "@/core/content";
import { kernel, readBootPrefs } from "@/lib/store";

const LINES = bootLog(portfolio);
const LINE_MS = 120;
const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "human", label: "Just show me the work", hint: "30-second read" },
  { mode: "shell", label: "Give me a shell", hint: "for engineers" },
];
/** Shared names with the recruiter page (.vt-boot) so these lines morph into the hero and the cards. */
const vt = (name: string) => ({ viewTransitionName: name, viewTransitionClass: "boot" }) as CSSProperties;

type Phase = "off" | "log" | "menu";

export function BootOverlay() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("off");
  const [decision, setDecision] = useState<BootDecision | null>(null);
  const [shown, setShown] = useState(0);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [reduced, setReduced] = useState(false);
  const done = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Decide once after hydration; the pre-paint script has already covered the page (data-boot="on").
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.boot !== "on") return;
    const q = new URLSearchParams(window.location.search);
    const d = decideBoot({
      ...readBootPrefs(),
      referrer: document.referrer,
      cmdParam: q.get("cmd"),
      modeParam: q.get("mode"),
      forceBoot: q.get("boot") === "1",
      isMobile: window.matchMedia("(pointer: coarse)").matches,
      lateHydration: performance.now() > HYDRATION_WATCHDOG_MS,
    });
    if (q.get("boot") === "1") window.history.replaceState(null, "", "/");
    if (!d.show) {
      delete root.dataset.boot;
      return;
    }
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time, client-only boot decision */
    setReduced(r);
    setDecision(d);
    setIndex(Math.max(0, OPTIONS.findIndex((o) => o.mode === d.preselect)));
    setLeft(d.countdownMs);
    setShown(r ? LINES.length : 0);
    setPhase(r ? "menu" : "log");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Swap the pre-paint cover for the overlay in the same frame the overlay first paints (no flash of the page).
  useLayoutEffect(() => {
    if (phase !== "off") document.documentElement.dataset.boot = "live";
  }, [phase]);

  const boot = useCallback(
    (mode: Mode) => {
      if (done.current) return;
      done.current = true;
      kernel.setMode(mode);
      const root = document.documentElement;
      if (mode === "shell") {
        // The shell shows these lines as its first transcript rows and clears data-boot once mounted.
        kernel.handOff(bootLogItems(LINES));
        router.push("/shell");
        return;
      }
      const finish = () => {
        flushSync(() => setPhase("off"));
        delete root.dataset.boot;
      };
      const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
      if (!reduced && typeof doc.startViewTransition === "function") doc.startViewTransition(finish);
      else finish();
    },
    [router, reduced],
  );

  // Boot log: one line every 120 ms, then the menu.
  useEffect(() => {
    if (phase !== "log") return;
    const t = setTimeout(() => (shown >= LINES.length ? setPhase("menu") : setShown((n) => n + 1)), LINE_MS);
    return () => clearTimeout(t);
  }, [phase, shown]);

  // Countdown (stopped by arrow keys or hovering the menu, like GRUB).
  useEffect(() => {
    if (phase !== "menu" || stopped || !decision) return;
    if (left <= 0) {
      boot(decision.preselect);
      return;
    }
    const t = setTimeout(() => setLeft((ms) => ms - 100), 100);
    return () => clearTimeout(t);
  }, [phase, stopped, left, decision, boot]);

  useEffect(() => {
    if (phase === "menu") listRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Keys and scroll: Enter boots the highlighted line, ` boots the shell, Esc / scroll boot the recruiter view.
  useEffect(() => {
    if (phase === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return; // let buttons handle their own Enter/Space
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setStopped(true);
        setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : OPTIONS.length - 1)) % OPTIONS.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        boot(OPTIONS[index].mode);
      } else if (e.key === "`") {
        e.preventDefault();
        boot("shell");
      } else if (e.key === "Escape") boot("human");
    };
    const onScroll = () => boot("human");
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
    };
  }, [phase, index, boot]);

  if (phase === "off" || !decision) return null;

  const preselected = OPTIONS.find((o) => o.mode === decision.preselect) ?? OPTIONS[0];
  const seconds = decision.countdownMs / 1000;
  const status = stopped
    ? "countdown stopped"
    : reduced
      ? `starts "${preselected.label}" in ${seconds} seconds`
      : `booting "${preselected.label}" in ${Math.max(1, Math.ceil(left / 1000))}…`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg font-mono text-[13px] leading-[1.7] text-text"
      onPointerDown={(e) => {
        if (phase === "menu" && !menuRef.current?.contains(e.target as Node)) boot("human");
      }}
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => boot("human")}
          className="sr-only rounded border border-border px-3 py-1.5 focus:not-sr-only focus:mb-6 focus:self-start"
        >
          Skip to the recruiter view
        </button>
        <p className="text-accent">KERNEL 1.0 (tty1)</p>
        <ol aria-label="Boot log">
          {LINES.slice(0, shown).map((l) => (
            <li key={l.id} className="break-words">
              <span className="text-[var(--k-store)]">[ ok ] </span>
              <span className="text-muted">{l.label}  </span>
              {l.id === "identity" ? (
                <span style={vt("kernel-name")}>{l.detail}</span>
              ) : l.id === "systems" ? (
                l.slugs.map((s, i) => (
                  <span key={s}>
                    {i > 0 && " "}
                    <span style={vt(`boot-system-${s}`)}>{s}</span>
                  </span>
                ))
              ) : (
                <span>{l.detail}</span>
              )}
            </li>
          ))}
        </ol>

        {phase === "menu" && (
          <div ref={menuRef} className="mt-8" onPointerEnter={() => setStopped(true)}>
            <p id="boot-question" className="text-text">
              Who&apos;s at the keyboard?
            </p>
            <div
              ref={listRef}
              role="listbox"
              tabIndex={0}
              aria-labelledby="boot-question"
              aria-activedescendant={`boot-option-${OPTIONS[index].mode}`}
              className="mt-3 rounded outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
            >
              {OPTIONS.map((o, i) => (
                <div
                  key={o.mode}
                  id={`boot-option-${o.mode}`}
                  role="option"
                  aria-selected={i === index}
                  onClick={() => boot(o.mode)}
                  onPointerEnter={() => setIndex(i)}
                  className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 rounded px-3 ${i === index ? "bg-accent-soft text-accent" : "text-muted hover:text-text"}`}
                >
                  <span aria-hidden className="w-3">
                    {i === index ? "▸" : ""}
                  </span>
                  <span className="flex-1">{o.label}</span>
                  <span className="text-faint">{o.mode === decision.preselect ? `recommended · ${o.hint}` : o.hint}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-faint">
              <span className="hidden sm:inline">↑↓ choose · enter boot · </span>
              {status}
            </p>
            <p aria-live="polite" className="sr-only">
              {`Choose an interface. "${preselected.label}" starts in ${seconds} seconds unless you choose.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount it** — `app/(gui)/layout.tsx`: `import { BootOverlay } from "@/components/boot/BootOverlay";` and render `<BootOverlay />` as the first child of the fragment (before `<Header />`).

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test && rm -rf .next && npm run build`
Expected: clean. (If TypeScript rejects `viewTransitionClass` in `CSSProperties`, the `as CSSProperties` cast in `vt()` already covers it — do not widen the type elsewhere.)

Browser (:3100, fresh profile or cleared localStorage for the origin):
1. Open `/` → boot lines stream (~0.5 s), then the menu with "Just show me the work" highlighted and "booting … in 3…" counting down; at 0 the boot lines morph into the hero name and the cards; page scrolls normally afterwards; `localStorage["kernel:mode"] === "human"`, `["kernel:bootmenu"] === "seen"`.
2. Reload `/` → no menu, recruiter page directly.
3. `/?boot=1` → menu again, URL becomes `/`; press ↓ → "countdown stopped", nothing boots by itself; Enter → `/shell` whose transcript starts with the same boot lines, then the welcome screen; reload `/` → immediately `/shell` (no flash of the recruiter page).
4. `/?boot=1`, hover the menu → countdown stops; click outside the menu → recruiter view; `/?boot=1`, scroll the wheel → recruiter view; `/?boot=1`, press `` ` `` → shell.
5. Referrer: from a page on another origin with `Referrer-Policy: unsafe-url`, or by temporarily calling `decideBoot` in the console — skip if not reproducible; covered by unit tests.
6. Reduced motion (DevTools emulation) + `/?boot=1` → full log and menu appear at once with "starts … in 3 seconds"; booting human switches instantly.
7. 390 px viewport (`(pointer: coarse)` via device emulation) + cleared storage → 2 s countdown, options are ≥ 44 px tall.
8. JavaScript disabled + cleared storage → the recruiter page is fully readable (the cover disappears after 1.5 s; no overlay).
9. Screen reader smoke (VoiceOver or accessibility tree): the listbox, its two options and the one-time announcement are present; Tab reaches "Skip to the recruiter view" first.

- [ ] **Step 8: Commit**

```bash
git add -A components/boot app tests
git commit -m "feat(boot): GRUB-style first-visit bootloader with countdown, morph into the recruiter view and shell handoff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Docs and end-to-end verification

**Files:**
- Modify: `README.md`, `core/shell/commands/info.ts` (only if `man kernel` / `help` text mentions `/` as the shell or the old recruiter toggle)
- Test: whole suite + browser pass

**Interfaces:**
- Consumes: everything above. Produces: nothing new.

- [ ] **Step 1: README** — under "The shell", add a "Boot modes" subsection:

```markdown
### Boot modes

First visit to `/` shows a bootloader: **Just show me the work** (recruiter view, preselected) or **Give me a shell**. It boots the preselected option after 3 s (2 s on touch devices); arrow keys or hovering stop the countdown. Visitors arriving from GitHub, Hacker News, dev.to, Lobsters or Stack Overflow get the shell preselected. Returning visitors go straight to their last mode.

- Switch any time: the `human · shell` pill in the header, `` ` `` on any page for a drop-down console, `exit` / `human` in the shell.
- Links: `/` (adaptive), `/?mode=human`, `/?mode=shell`, `/shell?cmd=run%20atlas`, `/?boot=1` (always show the bootloader — handy for demos).
- Old `/?cmd=…` links redirect to `/shell?cmd=…`; `/human` redirects to `/#human`.
```

Search `core/shell/commands/info.ts` for text that calls `/` the shell, mentions "recruiter mode" as a motion-free summary, or tells people to use `gui` to leave; update it to the new behaviour (`exit` → recruiter view, `` ` `` console). Run `npx vitest run tests/shell/info.test.ts` after any change.
Expected: PASS.

- [ ] **Step 2: Full check**

Run: `rm -rf .next && npm run check`
Expected: `tsc`, `eslint`, all Vitest files and `next build` pass; `/` and `/shell` are static.

- [ ] **Step 3: End-to-end browser pass** (production server on :3100, cleared storage, desktop then 390 px)

1. First visit → countdown → morph into the recruiter view.
2. Pill → shell (flash), pill → human (flash).
3. `` ` `` console: open, `cd systems`, `exit`; open again, `fullscreen` → `/shell` at `~/systems` with the console's history (↑).
4. In `/shell`: `reboot` → bootloader; pick shell → transcript continues from the boot lines.
5. `/?cmd=man%20kernel` → `/shell?cmd=man%20kernel` runs the manual.
6. `/human` → `/#human`.
7. Ask about me: chip → inline answer (offline badge without a key), suggestions are links, the page does not navigate by itself.
8. `/` with JavaScript disabled is fully readable.
9. No console errors or hydration warnings on `/`, `/shell`, `/systems`, `/graph` (check DevTools console after each).

- [ ] **Step 4: Commit**

```bash
git add README.md core/shell/commands/info.ts
git commit -m "docs: boot modes, switching and links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
