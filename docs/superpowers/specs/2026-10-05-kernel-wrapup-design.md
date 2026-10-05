# Kernel Wrap-up — Fixes, Polish, v2 Introspection, v3 AI Handoff

**Date:** 2026-10-05
**Status:** Draft for review
**Builds on:** `2026-10-05-kernel-design.md`, `2026-10-05-kernel-shell-v1-design.md` (merged on `main`). Branch: `feat/wrapup`.
**Out of scope:** real portfolio content (owner supplies it), publishing (no remote is created; deploy is prepared, not executed).

All rules from the earlier specs still hold: `core/` stays pure and tested, components read data through `core/content`, **no fabricated data**, every animation respects reduced motion and Recruiter Mode, every command has a complete `man` page and tests.

---

## Part A — Deferred fixes and cleanup

Each fix ships with a unit test that fails first (UI-only fixes get a pure helper that is unit-tested, plus a browser check).

### A1. Shell engine
| # | Defect | Required behaviour |
|---|---|---|
| A1.1 | `expandHistory` toggles single-quote state on apostrophes inside double quotes | Track `"` and `'` quoting exactly like the lexer: `echo "it's" '!!'` keeps `'!!'` literal; `echo "don't" !!` expands |
| A1.2 | Non-final pipeline stages mutate shell state (`cd x \| cat`) | Only the final stage's `state` patch applies (bash subshell semantics); history still records the line |
| A1.3 | Typos with arguments go to the AI (`cta README.md`, `grpe rag .`) | If the first word is within Levenshtein ≤ 2 of a command **and** any argument looks like a path/flag/glob (`/`, `.`, `-`, `*`), show *command not found* + clickable suggestion instead of asking |
| A1.4 | `cd ""` sets `prevCwd` | Empty target is treated as no-op (no state change) |
| A1.5 | Deep-link limits | Each `;`-separated command ≤ 200 chars (longer ones truncated with notice); ≤ 5 commands; the 5-pipeline cap applies **only** to deep links, not typed input |

### A2. Shell UI
| # | Defect | Required behaviour |
|---|---|---|
| A2.1 | Live region re-announces every simulation frame / AI chunk | Transcript `role="log"` contains only settled rows; in-progress rows (progress bars, streaming text) render in an `aria-hidden` live slot and are committed to the log once complete |
| A2.2 | Completion menu not exposed to assistive tech | Input gets `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; options get ids |
| A2.3 | `gui ↗` is a button | Becomes a `<Link href="/systems">` |
| A2.4 | ⌘K doesn't refocus the shell when focus is elsewhere on `/` | Global ⌘K on `/` focuses the shell input |
| A2.5 | Ctrl+C during AI answer discards streamed text | Keep the partial text and append `^C` |
| A2.6 | Mobile key row ignores busy | While busy, all keys are disabled and a `^C` key appears (the only way to cancel on touch devices) |

### A3. First-build leftovers
| # | Defect | Required behaviour |
|---|---|---|
| A3.1 | Rate-limit key trusts first `x-forwarded-for`; `hits.clear()` wipes all clients at 10k keys | Prefer `x-real-ip`, then the **last** `x-forwarded-for` hop; evict the oldest key (Map insertion order) instead of clearing |
| A3.2 | Clients can forge long assistant history | Assistant messages capped at 1 500 chars; at most 6 assistant turns accepted |
| A3.3 | Tool input spread lets input override `type` | `{ ...input, type: toolName }` |
| A3.4 | Provider error after partial text gives no fallback | Emit the error line **and** the local answer's suggestions |
| A3.5 | "offline mode" badge sticks for the session | Badge reflects the most recent assistant message only |
| A3.6 | Overlay motion ignores reduced motion / recruiter | Wrap overlays in `MotionConfig reducedMotion="user"` and disable slide in recruiter mode; add `.animate-fade-up` and `.cursor-blink` to the recruiter kill list |
| A3.7 | Dropped AI actions silent in dev | `console.debug("[kernel] dropped action", raw)` when `NODE_ENV !== "production"` |
| A3.8 | `themeColor` follows OS, not site theme | Theme script also updates `<meta name="theme-color">`; theme toggle updates it too |
| A3.9 | Duplicate commit hashes / experience ids unchecked | `checkIntegrity` reports `experience: duplicate id` and `experience.<id>.commits: duplicate hash` |

Also from the first review: Query dialog focus handling — `aria-modal="true"`, focus moves into the panel on open and returns to the previously focused element on close.

### A4. Cleanup
Delete branches `feat/kernel` (identical to `main`) and `spike/shell` (prototype) — local only.

---

## Part B — Share card and polish

| Item | Implementation |
|---|---|
| Open Graph / Twitter image | `app/opengraph-image.tsx` and `app/twitter-image.tsx` using `ImageResponse` (`next/og`), 1200×630, rendered from content: shell-style window, handle `@kernel`, name, role, tagline, `N systems · M capabilities`, a `$ run <first system>` prompt line. No fonts fetched at build time beyond what `next/og` bundles. |
| Per-system share image | `app/(gui)/systems/[slug]/opengraph-image.tsx`: system number, name, tagline, first impact metric if present (from content only). |
| Metadata | `metadataBase` from `NEXT_PUBLIC_SITE_URL` (fallback `http://localhost:3000`); `openGraph`/`twitter` titles and descriptions from identity. |
| `sitemap.xml` | `app/sitemap.ts`: `/`, GUI routes, every `/systems/<slug>`. |
| `robots.txt` | `app/robots.ts`: allow all, sitemap link; disallow `/api/`. |
| Apple touch icon | `app/apple-icon.tsx` (180×180, generated, matches `icon.svg`). |
| Analytics hook | `components/shell/Analytics.tsx`: renders Plausible's script **only** when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set; exposes `track(event, props)` used by the shell to record `command` events with the **command name only** (never arguments, never questions). No cookies, nothing personal. Documented in README and `.env.example`. |

---

## Part C — v2: engineering introspection

All output derives from content or real runtime state. Each command is a registered `core/shell` command with man page and tests.

### C1. Content model addition
`System.benchmarks?: { metric: string; value: string; unit?: string; context?: string; measuredAt?: string /* YYYY-MM */; source?: string }[]` — optional; Zod-validated; **placeholder content ships without benchmarks**.

### C2. Commands
| Command | Behaviour |
|---|---|
| `git log [system] [--oneline]` | Default: multi-line entries (`commit <hash>`, `Branch:`, `Org:`, `Date:`, indented message/body). `--oneline`: current one-line format. `[system]` filters to commits referencing that slug; unknown slug → error with suggestion. |
| `git show <hash>` | Full commit: hash, branch, org, role, date, message, body, linked systems (clickable `open`), and the systems' technologies. Unknown/ambiguous hash prefix (≥ 4 chars) → error. |
| `git branch` | Experience branches newest first, `*` on the current (no `end`) role, with period. |
| `diff <a> <b>` | Side-by-side system comparison: header row, status, period, category, components (counts), decisions (counts), then technologies and capabilities as `  shared`, `- only in a`, `+ only in b`. Errors for missing args/unknown systems/same system. |
| `status` | Kernel subsystem table: `portfolio` (N systems, M capabilities, T technologies), `filesystem` (dirs/files counted from `buildFs`), `graph` (nodes/edges), `search` (index documents), `query` (`online` / `offline (no key)` / `unknown` from `/api/status`), `session` (uptime, commands run). States are `READY` / `ONLINE` / `OFFLINE` / `UNKNOWN`. |
| `ps` | Kernel modules as processes: `PID` = stable 1-based index, `NAME`, `STATE`, `DETAIL` (real counts); no CPU/memory columns. |
| `top` | Session snapshot: uptime, commands run this session, history size, most-used commands (from this session's history), current pane, simulations run. Static snapshot (no fake live refresh). |
| `env` | Public configuration: `KERNEL_VERSION`, `CWD`, `THEME`, `MOTION` (`full`/`reduced`), `RECRUITER`, `AI` (`online`/`offline`/`unknown`), `HISTSIZE`, `SESSION_START`. Never secrets. |
| `benchmark <system>` | Table of the system's `benchmarks`; none → `benchmark: <name> has no published measurements` (exit 1). Never computes or estimates. |
| `graph --depth N [node…]` | Focus expands N hops (1–3) from the resolved nodes. |

### C3. Runtime state plumbing
`execute(input, state, p, now, opts)` gains `opts.env: RuntimeEnv` — `{ theme, motion, recruiter, ai: "online" | "offline" | "unknown", pane: string | null }` supplied by the Shell UI. `ShellState` gains `stats: { commands: number; simulations: number }` (incremented by `execute` / the `simulate` effect). `GET /api/status` returns `{ ai: boolean }` (whether a key is configured; never the key) with `cache-control: no-store`.

---

## Part D — v3: AI and visual handoff

### D1. `ask` command and results tree
- `ask <question…>` is a registered command (same effect as plain English). `man ask` documents it.
- New pure `core/shell/explain.ts`: `explain(p, question) → ExplainNode[]` — top systems from `searchPortfolio`, each with up to 3 matching children drawn from that system's content: components (`node.label` / description match → `open <slug>`), decisions (`title`/`choice` match → `man <slug>`), technologies (→ `graph <id>`), impact lines (→ `cat ~/systems/<slug>/impact.txt`). Only content that actually matches the question's tokens; never invented.
- After an answer finishes, the Shell renders the tree below it (`├──`/`└──`, every leaf clickable) when `explain` returns at least one system. Works identically with or without a Gemini key.

### D2. Typed-out streaming
AI text appears with a typewriter effect: a client-side buffer drains at ~60 chars/s (speeding up when the buffer exceeds 200 chars so output never lags the network by more than ~1 s). Reduced motion / recruiter → text appears as received. Ctrl+C stops the stream and flushes nothing further (A2.5 keeps what's shown).

### D3. Animated handoff
- Pane changes (open/close/switch view) use `document.startViewTransition` when available (feature-detected; fallback is an instant swap). Transition names: `kernel-pane`, plus `kernel-node-<slug>` on the graph node and the architecture diagram's frame so a system node in the graph morphs into its architecture.
- `open <system> --full` navigates to `/systems/<slug>` (the visual case study) with a view transition; the case-study header carries the matching `view-transition-name` so the system name morphs.
- All transitions disabled under reduced motion and Recruiter Mode (CSS `::view-transition-*` animations set to none).
- Follow `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` for the App Router integration.

---

## Part E — Deploy preparation (no publishing)

- README "Deploy" section rewritten as a checklist: content replaced → `npm test && npm run build` → `gh repo create <name> --private --source . --push` → Vercel import → env vars (`GEMINI_API_KEY`, optional `GEMINI_MODEL`, `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) → redeploy → smoke test URLs (`/`, `/?cmd=man%20kernel`, `/systems`, `/opengraph-image`).
- `.env.example` lists all variables with comments.
- `npm run check` script = `tsc --noEmit && eslint && vitest run && next build`.

---

## Testing

- Unit (Vitest): every A1 item; A2 helpers (live-slot policy, combobox props builder, mobile-key enablement); A3.1–A3.4, A3.9; analytics `track` sanitiser (drops arguments); all C2 commands (happy, errors, man completeness, no-fabrication mutations); `/api/status` handler; `explain` (matches only real content, empty for unrelated questions); typewriter drain-rate function; deep-link per-command limits.
- Render: OG image routes return `image/png` 1200×630 in `next build` output; sitemap contains every system.
- Browser (Playwright, 1440 and 390, dark/light, reduced motion): ⌘K refocus, completion menu a11y attributes, Ctrl+C keeps partial answer, results tree clickable, typewriter visible (and absent with reduced motion), graph→architecture morph and `open atlas --full` transition in Chromium, OG image visually correct, no console errors.

## Success criteria

1. All findings in Part A resolved with tests; full suite, lint, typecheck and build green.
2. Share previews render from content; sitemap/robots valid.
3. Every v2/v3 command works, has a complete man page, and prints nothing that isn't in content or real runtime state.
4. README deploy checklist is complete; nothing has been published.
