# Kernel Shell v1 — Filesystem, Navigation & Discovery

**Date:** 2026-10-05
**Status:** Draft for review
**Builds on:** `docs/superpowers/specs/2026-10-05-kernel-design.md` (branch `feat/kernel`). Prototype reference: branch `spike/shell` (throwaway — ideas reused, code rewritten with tests).

---

## 1. Intent

Kernel becomes a **portfolio operating system**: the home page is a full-screen shell over a virtual filesystem generated from the portfolio content. Every command is a view over that one source of truth. Visual pages remain as `gui` mode for recruiters and search engines.

> Don't build 30 terminal commands. Build one portfolio operating system that happens to expose 30 useful commands.

### Roadmap (each milestone gets its own spec → plan → build → review)

| Milestone | Scope |
|---|---|
| **v1 (this spec)** | Shell engine, filesystem, navigation, discovery, man/help, history, deep links, GUI handoff |
| v2 — engineering introspection | `git log/show/diff`, `diff <a> <b>`, `simulate` (alias `run`), `ps`/`top`/`env`/`status` from real runtime state, `benchmark` from real content only, `graph --depth` |
| v3 — AI + visual handoff | `ask` as structured, actionable results; live Gemini streaming; animated terminal → graph → case-study handoff |

### Success criteria

1. Home (`/`) is a full-screen shell; first meaningful output (neofetch + hint) renders server-side, so it is visible without JavaScript and indexable.
2. Every command in §5 works, has a `man` page, rejects unknown flags with usage, and is unit-tested in `core/shell/`.
3. Pipes work for text commands: `grep -i rag . | head -n 5`.
4. `/?cmd=<command>` executes a command (or `;`-separated list) on load; a recruiter can be sent a link straight to a demo.
5. Shell editing feels native: caret movement, Home/End, Ctrl+A/E/U/W, ↑/↓ history, Ctrl+R reverse search, `!!`, `!N`, Tab completion with ghost text, Ctrl+C, Ctrl+L.
6. Everything is clickable as well as typeable: directories, files, suggestions, man cross-references.
7. Mobile: usable with an on-screen key row (Tab, ↑, `cd ..`, `ls`, `help`); no horizontal page scroll at 360px.
8. Accessible: output is a polite live region, all interactive segments are real buttons/links, reduced motion removes typing delays and animations.
9. **No fabricated data.** Nothing displays metrics, telemetry or history that isn't in `content/`.

### Out of scope (v1)

v2/v3 features above; multi-pane tmux splits; user-writable files; themes beyond dark/light.

---

## 2. Architecture

```
content/  ──▶ core/shell/fs.ts (virtual filesystem, pure)
                   │
core/shell/ ── parser · registry · commands/* · completion · history · runtime
                   │   (pure TS, no React; returns Output + Effects)
                   ▼
components/shell/  Shell (renders transcript, input, effects)  ·  ViewPane  ·  Reader (less)
                   │
app/(shell)/page.tsx  — home, full-screen      app/(gui)/…  — existing visual pages (header/footer layout)
```

Rules:
- `core/shell/` is pure and synchronous: `execute(line, state) → { output, effects, state }`. No timers, no fetch, no DOM.
- Commands never touch the UI; they emit **effects** that the Shell component performs.
- Animated or networked work (simulation playback, AI answers) is an effect, not a command implementation detail.
- `core/command.ts` (old ⌘K terminal) and `components/command/Terminal.tsx` are removed; on GUI pages ⌘K navigates to `/`.

### Route structure

- `app/layout.tsx` — `<html>`, `<body>`, fonts, theme/boot script, Query overlay keyboard shortcuts.
- `app/(shell)/page.tsx` — the shell (no header/footer).
- `app/(gui)/layout.tsx` — header, recruiter summary, footer; contains `systems/`, `graph/`, `trace/`, `human/`, `connect/` (moved, URLs unchanged).
- `app/not-found.tsx` — unchanged.

---

## 3. Output & effects model (`core/shell/types.ts`)

```ts
type Tone = "text" | "muted" | "faint" | "accent" | "error" | "ok" | "dir" | "view" | "link" | "warn" | "heading" | "match";
type Seg = { text: string; tone?: Tone; run?: string; href?: string };   // run = command executed on click
type Line = Seg[];
type Block = { kind: "neofetch" } | { kind: "table"; head: string[]; rows: Seg[][] };  // rich blocks
type OutputItem = { line: Line } | { block: Block };

type Effect =
  | { type: "openView"; view: { type: "architecture"; slug: string } | { type: "graph"; focus: string[] } | { type: "reader"; path: string } }
  | { type: "closeView" }
  | { type: "navigate"; href: string }           // internal GUI page
  | { type: "download"; href: string }
  | { type: "simulate"; slug: string }           // UI plays the content simulation
  | { type: "ask"; question: string }            // UI calls /api/query (v1: existing behaviour)
  | { type: "clear" }
  | { type: "recruiter"; on: boolean };

type ShellState = { cwd: string[]; prevCwd: string[]; history: HistoryEntry[]; env: Record<string, string> };
type HistoryEntry = { command: string; at: number };   // epoch ms
type Result = { output: OutputItem[]; effects: Effect[]; state: ShellState; exitCode: 0 | 1 };
```

Piping: each stage receives `stdin: string[]` (plain text of the previous stage's lines). Non-final stages' effects are discarded. Commands that don't read stdin ignore it.

---

## 4. Virtual filesystem (`core/shell/fs.ts`)

Generated from `content/` at module load (memoised per portfolio object).

```
~/
├── README.md              identity, tagline, summary, how to explore
├── about.md               human.about, principles, interests
├── contact.txt            email, links, availability
├── resume.pdf             link → identity.links.resume (if set)
├── career.log             experience as branches + commits
├── systems/
│   └── <slug>/            kind "system" (a directory that is also a system)
│       ├── README.md      header, tagline, summary, problem, context, role, responsibilities
│       ├── architecture   view → architecture pane
│       ├── decisions.md   each decision with options (● chosen / ○ rejected) and rationale
│       ├── tradeoffs.md   challenges + trade-offs (only if present)
│       ├── impact.txt     impact metrics (only if present)
│       ├── stack.txt      technologies + capabilities (each a link to its file)
│       └── links.txt      repo/demo/writeup (only if present)
├── skills/
│   ├── <capability>.md    description, technologies, systems using it
│   └── graph              view → graph pane
└── stack/
    └── <technology>.txt   category, systems using it, capabilities using it
```

Node kinds: `dir`, `system` (dir), `file` (lines of text), `view`, `link`. Files carry plain text; markdown-ish lines (`# `, `## `, `- `, `● `, `○ `, `→ `) get tones at render time via one shared `styleLine()`.

API: `buildFs(p)`, `resolve(fs, cwd, path) → node | undefined`, `normalise(cwd, path) → string[]` (supports `~`, `/`, `.`, `..`, trailing `/`), `pathOf(parts)`, `walk(node)`, `nodeText(node) → string[]`.

---

## 5. Commands (v1)

Every command: `name`, `aliases?`, `summary`, `usage`, `flags` (declared; unknown → `error: unknown flag --x` + usage, exit 1), `man` (NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO with clickable cross-refs), `run(args, flags, stdin, state, fs) → Result`.

| Command | Behaviour |
|---|---|
| `ls [-l] [path…]` | List directory; dirs `dir/` (click → `cd`), views `name*` (click → `open`), links `name@`, files (click → `cat`). `-l`: kind, line count, name. |
| `cd [path]` | Change dir; no arg → `~`; `cd -` → previous. Errors: no such directory / not a directory. |
| `pwd` | Print cwd. |
| `tree [-L n] [path]` | Box-drawing tree, depth-limited. |
| `cat <file…>` | Print files; with no file and stdin, echo stdin. Dir → error + `ls` suggestion. View → behaves like `open`. Link → clickable link. |
| `less <file>` | Effect `openView reader` — scrollable reader in the side pane; also prints a one-line notice. |
| `head [-n N] [file]` / `tail [-n N] [file]` | First/last N (default 10) lines of file or stdin. |
| `grep [-i] [-n] [-l] [-v] <pattern> [path…]` | Search files (dirs searched recursively); default path `.`; with stdin and no path, filters stdin. Pattern is a JS regex; invalid regex → literal match. Output `path:line:text` with matches toned `match`; `-l` paths only; `-v` invert. Paths clickable. |
| `wc [-l] [file]` | Line/word counts of file or stdin. |
| `find [path] [-name GLOB] [-type f\|d\|view\|system]` | Recursive listing filtered by glob (`*`, `?`) and kind. |
| `which <name>` | Command → `name: shell builtin`; system/capability/technology → its path. |
| `whereis <term>` | All paths whose name or content mention the term (case-insensitive), grouped. |
| `man <topic>` | Command manual; `man <system>` → system manual page generated from content; `man kernel` → overview. Unknown → `No manual entry for x` + nearest. |
| `help [topic]` | Grouped command list; topics `navigation`, `search`, `shortcuts`, `links`. |
| `history [--session]` | Numbered history (persisted, max 200); `--session` adds `HH:MM` and limits to this visit. |
| `whoami` | Neofetch block (identity, counts derived from content, colour swatches). |
| `id` | `uid=<handle> groups=<capability ids>` derived from content. |
| `open <target>` | System slug → architecture pane; `graph`/`skills/graph` → graph pane; `resume` → download; `contact`/`trace`/`systems`/`human` → GUI page; any view path → its pane; file → reader. |
| `resume` | Recruiter summary in the terminal (role, location, availability, top 3 systems with first impact metric, core stack, contact) + `export resume.pdf` hint. |
| `export resume.pdf` | Download effect for `identity.links.resume`; otherwise error. |
| `run <system>` | Effect `simulate` (kept from prototype; becomes `simulate` alias in v2). In a system dir, defaults to it. |
| `graph [node…]` | Graph pane focused on resolved nodes (unknown ids ignored; none resolved → error). |
| `git log` | Career commits, one line each (v2 extends). |
| `gui [page]` | Navigate to a GUI page (default `systems`). |
| `recruiter` | Recruiter mode on + navigate to `/systems`. |
| `clear` | Effect `clear`. |
| `echo <text…>` | Print text. |
| `sudo hire` / `exit` | Easter eggs (no fabricated data). |
| *anything else* | One unknown word → `command not found` + nearest + "or ask in plain English". Multiple words or ending in `?` → effect `ask`. |

### Parser (`core/shell/parser.ts`)

- Quotes (`"`/`'`), escaped spaces, `--flag`, `--flag=value`, `-n 5`, combined short flags (`-in`), `;` command lists, `|` pipelines.
- History expansion before parsing: `!!` → last command, `!N` → entry N; unknown → `event not found`.
- Returns `Pipeline[]` (list) of `Stage[]`; syntax errors (`| |`, trailing `|`) → error line.

### Completion (`core/shell/complete.ts`)

`complete(input, cursor, state, fs) → { replacement: string; candidates: string[] }` — commands at position 0, then command-aware: paths (cd → dirs only), system slugs (`run`, `open`, `man`), graph node ids, man topics, help topics, flags after `-`. Ghost text = remainder of first candidate when caret is at end.

**Terminal-style completion UX (zsh/fish):**
- **Autosuggestion (fish):** grey ghost text shows the most recent history entry that starts with the current input; otherwise the first completion candidate. → / End accepts.
- **Tab:** one candidate → complete; several → extend to the common prefix; if nothing to extend, open a **completion menu** under the prompt listing every candidate with a one-line description (command summary, system tagline, capability/technology name, file kind, flag description).
- **Menu:** Tab / ↓ next, Shift+Tab / ↑ previous (the input previews the selection), Enter accepts without running, Esc closes, typing dismisses, click selects.

---

## 6. Shell UI (`components/shell/`)

- **Layout:** title bar (traffic lights, `kernel — <cwd>`, `gui ↗`, theme toggle) · transcript + prompt · optional side pane (≥ md: right 46%; < md: bottom 42%) · status bar (`kernel` · `0:shell` / `1:view` · cwd · `ai:<ready|offline|online>` · clock).
- **Server render:** `app/(shell)/page.tsx` renders the initial transcript (neofetch + hint line) as HTML; the client hydrates the same transcript (deterministic: no clock in SSR, clock fills in after mount).
- **Boot:** on the first visit per browser session (`sessionStorage` flag `kernel:booted`), five boot-log lines animate in *above* the already-rendered neofetch (≈1s total, any key skips); later visits, deep links and reduced motion skip it. Content is never hidden waiting for the boot.
- **Input:** hidden native `<input>` drives a rendered line with caret block and ghost text; readOnly while an effect is running; Ctrl+C cancels running effects.
- **Keyboard:** Enter, Tab (complete / list), →/End accepts ghost, ←/→ caret, Home/End, Ctrl+A/E/U/W/L/C, ↑/↓, Ctrl+R (reverse-i-search prompt: type to search, Enter run, Esc cancel), Esc closes pane. ⌘K/Ctrl+K focuses the shell.
- **Typing effect:** output lines appear with a short stagger (≤ 20ms/line, capped at 400ms per command); disabled under reduced motion.
- **Pane:** architecture (reuses `ArchitectureDiagram`, sized to fit), graph (positioned graph from server), reader (`less` — rendered file with headings, scrollable, `q`/Esc closes).
- **Simulation playback:** plays `simulation.steps` with progress bars (`━`/`─`), lights active node in the pane, prints completion with real elapsed time and "(simulated walkthrough)".
- **Ask:** existing `/api/query` NDJSON stream rendered inline (`▸ …`), actions open panes, sources line. (v3 upgrades.)
- **Mobile key row:** `Tab` `↑` `cd ..` `ls` `help` buttons above the keyboard on touch devices.
- **Deep links:** `?cmd=` read on mount; commands echoed then executed in order (max 5, each ≤ 200 chars); URL is not rewritten on later commands. A `share` hint: `history` entries are clickable to copy `/?cmd=<entry>`.
- **Persistence:** history in `localStorage` (`kernel:history`, try/catch); session start time in memory.

---

## 7. GUI mode

Existing pages unchanged in behaviour and URL; moved under `app/(gui)/` with a shared layout. Header gains a `>_ shell` link to `/`. ⌘K on GUI pages navigates to `/`. Query panel (`/`) stays on GUI pages. Old `Terminal` overlay and `core/command.ts` removed with their tests; their useful behaviours (suggestion, easter eggs) exist in the new shell.

---

## 8. Error handling

| Case | Behaviour |
|---|---|
| Unknown command (single word) | `kernel: command not found: x` · nearest (Levenshtein ≤ 2) clickable · "or ask in plain English" |
| Unknown / missing flag value | `<cmd>: unknown flag --x` / `<cmd>: -n needs a number` + usage; exit 1 |
| Path errors | grep/coreutils-style messages (`cat: x: No such file`) |
| Pipe syntax errors | `kernel: syntax error near '|'` |
| Bad regex in grep | Falls back to literal search |
| History expansion miss | `kernel: !42: event not found` |
| Deep link too long / too many | Extra commands dropped with a faint notice |
| Effect failure (network in ask) | Error line; shell stays usable |
| `localStorage` unavailable | History in memory only |

---

## 9. Testing

Vitest, `tests/shell/*.test.ts`:
- fs: tree shape from content; optional files appear only when data exists; resolve/normalise edge cases (`..` above root, trailing slash, `~/x`, `/x`).
- parser: quotes, flags, combined short flags, pipes, `;`, `!!`/`!N`, syntax errors.
- every command: happy path, unknown flag, missing args, path errors; `grep` regex/literal/-i/-n/-l/-v/stdin; `find` glob/type; `head`/`tail` stdin; pipelines end-to-end.
- man: every registered command has a man page with all sections; `man <system>` generated.
- completion: commands, paths, dirs-only for cd, slugs, flags, ghost.
- no-fabrication check: every number printed by `whoami`/`resume`/`id` is derived from content (test by mutating content counts).
- deep-link parsing: limits, encoding, `;` lists.
- SSR: the shell page's initial transcript renders to HTML containing identity name and system names (render test).

Verification before completion: `npm test`, `npm run lint`, `npm run build`, HTTP checks for `/`, `/?cmd=ls%20systems`, all GUI routes; headless-browser pass at 1440px and 390px (typing, Tab, Ctrl+R, pipes, pane, deep link, reduced motion).

---

## 10. Deployment

Unchanged: Vercel free tier, optional `GEMINI_API_KEY`. README gains a "Shell" section (commands, deep links, how files map to content).
