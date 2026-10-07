# Kernel shell: guided tour and hint bar — design

**Date:** 2026-10-07
**Status:** approved in conversation; awaiting written-spec review

## Problem

People who open the shell (`/shell`) do not know what to type. The welcome banner has one faint line of clickable commands, which is easy to miss. After the first command, nothing suggests what to do next. This includes the site's owner.

## Goals

1. A first-time visitor can learn the shell's three core moves in about **20 seconds**. The moves are: type a command, click something, run a demo or ask a question.
2. At every prompt, the visitor can see 2–3 sensible next commands.
3. Experienced visitors are not slowed down. Nothing starts on its own and nothing blocks typing.

## Non-goals

- A tutorial for every command. `man` and `help` already cover that.
- Analytics for the tour. The existing command analytics already records the command name `tour`.
- Changes to the recruiter view, the bootloader or the AI.

## Experience

### The offer

On a **first visit** to `/shell`, one line is added to the transcript under the welcome banner:

```
new here?  ▸ take the 20-second tour   or just start typing
```

- Clicking it, or typing `tour`, starts the tour. It is an ordinary clickable transcript line (`run: "tour"`), and it stays in the scrollback like any other output.
- "First visit" means three things are all true:
  - the `kernel:tour` key in browser storage is unset;
  - the shell is the full page (`variant === "page"`), not the drop-down console;
  - the page was not opened with `?cmd=` commands.
- The offer is added on the client after the boot animation, because the welcome banner is prerendered and cannot read browser storage.
- The welcome banner's existing `try  ls · cd … · run … · man kernel · help` line is **removed**, because the hint bar replaces it. The "or just ask" line and the "systems:" line stay.

### The tour (3 steps)

While the tour runs, a box sits directly above the prompt line, inside the scrolling area so it moves with the prompt:

```
┌ tour 1/3 ━━━━━──────────                                          ✕ ┐
│ Projects live in folders. Look around:   ▸ ls systems                │
└──────────────────────────────────────────────────────────────────────┘
```

| Step | Text | Suggested command | Done when (after a command finishes) |
|---|---|---|---|
| 1 | "Projects live in folders. Look around:" | `ls systems` | The command name is `ls` or `tree`, **or** the current folder is now `~/systems` or inside it |
| 2 | "Click a project to step inside (or type it):" | `cd systems/<first system>`, or `cd <first system>` when already in `~/systems` | The current folder is inside `~/systems/<slug>` |
| 3 | "Now watch it work — or just ask in plain English:" | `run <slug of the project you are in>`; with no runnable project, a sample question | A `simulate` or `ask` effect was produced |

Behaviour:
- **Clicking the suggestion** types it into the prompt at about 25 ms per character, capped at 0.3 s, then runs it through the normal command path, so it lands in history. With reduced motion it is inserted instantly. Clicking while a command is running does nothing.
- **Any qualifying command completes a step**, whether typed, clicked in the transcript or chosen from the hint bar. Commands that do not qualify leave the step as it is.
- **Completing a step that has not been reached yet also counts**, and the tour advances past it. For example, `cd ~/systems/atlas` during step 1 finishes steps 1 and 2.
- **After step 3**, the box closes and one line is appended to the transcript: `✓ tour done — the bar above the prompt always shows what to try next`. `kernel:tour` is set to `done`.
- **Skipping:** `tour skip`, plain `skip` while the tour is active, the ✕ button, or Esc each end the tour and set `kernel:tour` to `skipped`.
  - If a side panel is open, Esc closes the panel first, as it does today. The next Esc ends the tour.
  - Plain `skip` is handled by the UI only while the tour is active. At other times it is an unknown command, as today.
- **`tour`** restarts the tour at step 1 at any time, even after `done` or `skipped`. In the drop-down console, `tour` prints `the tour runs in the full shell — opening /shell` and navigates there with the tour starting.
  - The tour is passed to `/shell` through `?cmd=tour`, so it reuses deep links.
  - A deep-linked `tour` command starts the tour as normal.

### The hint bar (every visit)

The hint bar is a slim row of 2–3 clickable commands between the scrolling transcript and the mobile key row or status bar. It shows in the full shell and the drop-down console. It is hidden while the tour box is up, while a command is running, and while the completion menu is open.

| Context (checked in this order) | Hints |
|---|---|
| Last command produced an `ask` effect | `open <slug>` for up to 2 systems named in the answer's sources; otherwise `ls systems` |
| Last command produced a `simulate` effect for `<slug>` | `cat decisions.md` (in that system's folder, else `cat ~/systems/<slug>/decisions.md`), `diff <slug> <another slug>` |
| Inside `~/systems/<slug>` | `cat README.md`, `run <slug>` (if it has a simulation), `cd ..` |
| In `~/systems` | `cd <first slug>`, `cd <second slug>` |
| Anywhere else (home, skills, stack) | `ls systems`, `cat about.md`, `ask what have you built?` |

- Each hint is shown as `▸ <command>`. Clicking one behaves exactly like clicking a tour suggestion: the command is typed in, then run.
- A hint is only offered if it refers to something real. Every path is checked against the file tree and every slug against the portfolio, so the bar never offers a dead command.
- At least 1 and at most 3 hints are shown. If a context yields none, the fallback row (`ls systems`, …) is used.
- On phones the row scrolls sideways, matching the existing mobile key row.

## Architecture

### `core/shell/guide.ts` (new, pure)

This file imports no React or `next`, and the same input always gives the same output.

```ts
export const TOUR_KEY = "kernel:tour";            // "done" | "skipped"
export type TourStatus = "done" | "skipped" | null;

export interface StepEvent {
  command: string;        // the raw line that ran
  cwd: string[];          // current folder after the command
  effects: Effect[];      // effects the command produced
}

export interface TourStep { text: string; command: string }

/** The step's text and suggested command for the visitor's current state; null after the last step. */
export function tourStep(step: number, cwd: string[], p: Portfolio): TourStep | null;

/** The step index after an event. Never goes backwards; returns TOUR_LENGTH when finished. */
export function advanceTour(step: number, ev: StepEvent): number;

export const TOUR_LENGTH = 3;

export function shouldOfferTour(o: { status: TourStatus; variant: "page" | "console"; deepLinked: boolean }): boolean;

export interface HintContext { cwd: string[]; last?: StepEvent; sources?: string[] }   // sources = system slugs from the last AI answer
/** 1–3 commands, every one runnable as written. */
export function hints(ctx: HintContext, p: Portfolio): string[];
```

- `advanceTour` checks steps in order from the current step. It keeps advancing while the next step's condition also holds, which is how one command can finish several steps.
- `hints` resolves paths with the existing `buildFs` and `resolve` from `core/shell/fs.ts`.
- **Effect gap:** the `ask` effect carries only the question, but the AI answer's sources arrive later through the query stream (`meta.sources`). The UI therefore passes `sources` separately: the ids of the stream's `meta.sources` entries whose `kind` is `"system"`. Until they arrive, the bar uses the fallback for the ask context.

### Commands

`tour` is added to `core/shell/commands/info.ts`, the same group as `help` and `man`.

- `tour` emits a new effect, `{ type: "tour"; action: "start" }`.
- `tour skip` emits `{ type: "tour"; action: "skip" }`.
- `tour <anything else>` prints its usage as an error (exit code 1), using the existing error helper in `core/shell/registry.ts`.
- It has a full manual entry (summary, usage, description, examples, seeAlso), as the "every command has a complete manual" test requires.
- The `Effect` union in `core/shell/types.ts` gains the `tour` variant.

### UI

- **`components/kernel/TourCard.tsx`** (new) shows the box. It takes `step`, `total`, `text`, `command`, `onRun` and `onSkip` props. It is not a dialog: it does not trap focus, and focus stays on the prompt. Its text sits in an `aria-live="polite"` region, so screen readers announce each new step.
- **`components/kernel/HintBar.tsx`** (new) shows the row. It takes `hints`, `onRun` and `disabled` props. Each hint is a `<button>` that keeps focus on the prompt (`onPointerDown` prevents default, as the mobile keys already do).
- **`components/kernel/Shell.tsx`** changes:
  - New state: `tourStep: number | null` (null means no tour is running) and `lastEvent: StepEvent | undefined`.
  - After each `run()` completes, it builds a `StepEvent` from the command, the state after the command, and the `effects` from the result. It then updates `lastEvent` and, if a tour is running, advances it with `advanceTour`.
  - It handles the `tour` effect. In the full shell, `start` sets the step to 0 and `skip` ends the tour. In the console, `start` navigates to `/shell?cmd=tour`.
  - `typeAndRun(command)` types the command into the prompt and then calls `run`, as described in the tour behaviour above. Tour and hint clicks use it; clicks on transcript links keep running immediately, as today.
  - It intercepts plain `skip` while the tour is active.
  - Esc ends the tour when no side panel is open.
  - The offer line is added after the boot sequence when `shouldOfferTour` is true.
- **Storage:** `kernel:tour` lives in `localStorage`. Every read and write is wrapped in try/catch; if storage fails, the tour is treated as never seen and the offer simply shows again.

## Error handling and edge cases

- **Minimal portfolio:**
  - **No runnable system:** step 3 suggests a question, and the hint bar drops `run`.
  - **Only one system:** hints with `diff` are dropped.
  - **No systems at all:** the tour's steps 1–2 point at `~/skills` instead, and step 3 is a question. This case is unlikely, but it must not crash.
- **Command errors:** a command that fails leaves the tour step unchanged. The hint bar uses the context after the command, which has not moved.
- **Ctrl+C** during a typed-in suggestion cancels it in the same way as any other running command.
- **Navigating away** (`exit`, `gui`) mid-tour ends the tour without marking it `done` or `skipped`. The next visit offers it again if `kernel:tour` is still unset.

## Testing

- **`tests/shell/guide.test.ts`** (new):
  - The completion matrix for every step, including `ls -la`, `tree`, `cd systems`, `cd ~/systems/atlas` (skips step 2), a clicked `cd`, `run atlas`, a plain question, and non-qualifying commands.
  - `advanceTour` never goes backwards.
  - `tourStep` text and command in each folder.
  - `hints` for each context row.
  - Every hint is runnable: each hint is passed through `execute` against the sample portfolio and must exit with code 0.
  - `shouldOfferTour` truth table.
  - A minimal portfolio with one system, no simulation and no experience.
- **`tests/shell/info.test.ts`** (existing): the `tour` manual is complete; `tour`, `tour skip` and `tour nope` behave as specified.
- **`tests/shell/ssr.test.tsx`** (existing): the welcome no longer contains the `try` line.
- **Full suite plus `npm run check`.**
- **Browser check (Playwright on a production build):**
  - first visit: offer, then 3 steps by clicking, then done, with `kernel:tour = done`;
  - reload: no offer;
  - `tour`: restart;
  - Esc: skip;
  - hints change as the visitor moves between home, a project and a demo;
  - drop-down console: hint bar shows, and `tour` opens `/shell`;
  - a phone-width viewport.

## Success criteria

1. A new visitor who clicks the offer and then each suggestion finishes the tour in under 20 seconds, counting the demo's own run time as not part of the tour.
2. The hint bar never shows a command that fails when run against the shipped content.
3. A visitor who ignores the offer never sees the tour box, and typing is never delayed.
4. `npm run check` passes.
