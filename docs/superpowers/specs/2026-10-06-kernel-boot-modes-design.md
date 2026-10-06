# Kernel Boot Modes — Design

**Date:** 2026-10-06 · **Status:** approved in conversation, pending written review
**Builds on:** `2026-10-05-kernel-design.md`, `…-kernel-shell-v1-design.md`, `…-kernel-wrapup-design.md`

## 1. Intent

Kernel serves two audiences:

- **Recruiters / hiring managers** — must grasp who the engineer is in ~30 s without understanding shells, filesystems or graphs, and should come away impressed.
- **Developers** — want the terminal (`Kernel` shell) as it exists today.

A first-visit **bootloader** (GRUB-style menu with countdown) is the signature moment. It recommends a mode, never forces one, defaults to Recruiter, and the visitor can switch modes at any time with one click or one keystroke.

**Success criteria**

1. A recruiter who does nothing reaches the readable Recruiter page in ≤ 3.6 s on desktop (≤ 2.6 s mobile); any click/scroll/Enter gets them there immediately.
2. Returning visitors never see the menu; they land in their last mode with no flash of the wrong mode.
3. Mode switching is available everywhere: header pill, `` ` `` console, shell commands, URLs.
4. Crawlers, share previews and no-JS visitors get the full server-rendered Recruiter page.
5. No fabricated data: every number and line shown comes from `content/` or real runtime state.

## 2. Decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | First visit shows a bootloader with countdown (option A). |
| D2 | Recruiter page is the GUI **front door**; existing GUI pages (`/systems`, `/graph`, `/trace`, `/connect`) remain as the depth layer it links into. |
| D3 | Routing option 1: Recruiter page at `/`, shell moves to `/shell`, bootloader is a client overlay on `/`. |
| D4 | "Recruiter" no longer means "motion off". Motion follows only `prefers-reduced-motion` and the shell `motion` command. |
| D5 | Countdown 3 s desktop / 2 s mobile; "Ask about me" is on the front page. |

## 3. Architecture

### 3.1 Routes

| Route | Content |
|---|---|
| `/` | Recruiter page (server-rendered). First visit: boot overlay on top. |
| `/shell` | The Kernel shell (moved from `/`), unchanged behaviour. |
| `/systems`, `/systems/[slug]`, `/graph`, `/trace`, `/connect` | Unchanged depth pages. |
| `/human` | Permanent redirect (308) to `/#human`; its content moves into the front door. |
| `/?cmd=…` | `next.config` redirect (`has: [{ type: "query", key: "cmd" }]`) to `/shell?cmd=…`, so `/` stays static. |

`app/(shell)/page.tsx` moves to `app/(shell)/shell/page.tsx`; the Recruiter page becomes `app/(gui)/page.tsx` so it shares the GUI layout. Sitemap, robots and share images updated accordingly.

### 3.2 Mode state

- Store field `recruiter: boolean` → `mode: "human" | "shell"`; persisted at `localStorage["kernel:mode"]`. Flag `kernel:booted = "1"` once a mode has been booted.
- Migration: existing `kernel:recruiter` key is removed on load; it does not set mode.
- `data-recruiter` attribute and its CSS (motion suppression) are deleted. `useMotionAllowed` depends only on reduced motion + the `motion` setting.
- `RuntimeEnv.recruiter` → `RuntimeEnv.mode`; `env` command prints `MODE`.

### 3.3 Pre-paint script (`app/layout.tsx`)

Extends the existing theme script. On `/` only:
- URL has `mode=` or `cmd=` → no overlay (server/`core/boot` handles it).
- `?boot=1` → overlay.
- `kernel:booted` set and `kernel:mode === "shell"` → `location.replace("/shell")` before paint.
- `kernel:booted` set and mode `human` → nothing.
- Otherwise → `document.documentElement.dataset.boot = "on"`.
All storage access in try/catch; on failure behave as first visit.

### 3.4 `core/boot.ts` (pure, no React/Next imports)

```ts
interface BootSignals {
  storedMode: "human" | "shell" | null;
  booted: boolean;
  referrer: string;          // document.referrer, may be ""
  cmdParam: string | null;
  modeParam: string | null;
  forceBoot: boolean;        // ?boot=1
  isMobile: boolean;
}
interface BootDecision {
  show: boolean;             // render the menu?
  preselect: "human" | "shell";
  countdownMs: number;       // 3000 desktop, 2000 mobile
  target: "human" | "shell"; // where to go if not showing
}
function decideBoot(s: BootSignals): BootDecision;
function bootLog(p: Portfolio): BootLine[];  // real-content boot lines
```

Preselect rules (first match wins): `modeParam` valid → it; `cmdParam` → shell; referrer host in {github.com, news.ycombinator.com, dev.to, lobste.rs, stackoverflow.com} → shell; referrer linkedin.com / mail → human; mobile → human; default human. Signals only change preselection; countdown still runs.

`bootLog` produces 3–5 lines, e.g. `[ ok ] identity  <handle> · <role>`, `[ ok ] mount /systems  <slugs>`, `[ ok ] index  <n> capabilities · <n> technologies`, `[ ok ] link  graph <n> nodes / <n> edges`. Lines with zero-count sources are omitted; an empty portfolio still yields the identity line.

## 4. Boot sequence

Rendered by a client `BootOverlay` component on `/` when `data-boot="on"`.

1. **0–0.6 s** — boot log lines stream in (fast typewriter, reusing `createTypewriter`).
2. **0.6 s** — menu fades in:
   ```
   Who's at the keyboard?
   ▸ Just show me the work      recommended · 30-second read
     Give me a shell            for engineers
   ↑↓ choose · enter boot · booting "show me the work" in 3…
   ```
3. Countdown ends → boot preselected mode.

**Interaction rules**
- Enter / click a line → boot that line. Click outside the menu or scroll → boot human. `` ` `` → boot shell.
- Arrow keys or pointer hover over the menu **stop** the countdown (label: "countdown stopped").
- Menu is a `listbox` with `aria-activedescendant`; countdown announced once via a polite live region; a "Skip" button is the first Tab stop.
- Mobile: 2 s countdown, ≥ 44 px targets.

**Booting human:** view-transition morph — the identity boot line shares `view-transition-name: kernel-name` with the hero `<h1>`; each `mount` slug shares `system-card-<slug>` with its card. Overlay dissolves (~500 ms). Sets `kernel:mode=human`, `kernel:booted=1`.

**Booting shell:** navigate to `/shell` inside a transition; the boot lines are handed to the shell (via store) and rendered as the first transcript rows, followed by the normal welcome. Sets `kernel:mode=shell`, `kernel:booted=1`.

**Reduced motion:** no streaming, no morph, static label "Starts recruiter view in 3 seconds"; behaviour otherwise identical.

**Hydration watchdog:** CSS hides the overlay automatically 1.5 s after paint unless the client has marked it live (`data-boot="live"`), so a slow/failed JS load never leaves a black screen.

## 5. Recruiter page (`/`)

Server component; client islands only for Ask, the console trigger and the boot overlay.

1. **Header** — name mark, mode pill `● human ○ shell`, theme toggle, faint `` press ` for a shell `` hint (desktop).
2. **Hero** — name, role, location, availability badge, one-line pitch (`identity.tagline`); CTAs **Contact**, **Résumé ↓**, secondary *Ask about me* (scrolls/focuses Ask).
3. **Proof strip** — up to 3 stats: first `impact` entry of each featured system. Hidden if none.
4. **Flagship systems** — 3 featured systems; card shows outcome (first impact or tagline), stack chips, *Case study →* `/systems/<slug>`. Hover/focus reveals a miniature `ArchitectureDiagram` (static, no animation under reduced motion).
5. **Ask about me** — input + chips (*Fit for a senior backend role?*, *Strongest project?*, *How does he work in a team?*). Uses `/api/query`, typewriter streaming, offline fallback labelled "offline mode". Action links resolve to front-door anchors or depth pages.
6. **Experience** — compact timeline (role, org, dates, one impact line); *Full history →* `/trace`.
7. **Stack** — grouped technology chips; *See how it connects →* `/graph`.
8. **How I think** (`id="human"`) — principles + interests (content of the old `/human`).
9. **Footer** — email, GitHub, LinkedIn, résumé, "Curious how this was built? press `` ` `` or type 'shell'".

Removed: `RecruiterSummary` banner, `RecruiterToggle` header button.

## 6. Switching

- **Mode pill** in GUI and shell headers (in the mobile menu on small screens). Switching saves `kernel:mode` and plays a 0.4 s reboot (one log line + morph); instant under reduced motion.
- **`` ` `` console** on all GUI pages: lazy-loaded compact `Shell` sliding down to ~45 vh; non-modal panel with focus containment, closes on Esc / `` ` `` / `exit`; ⤢ or `fullscreen` → `/shell`. Shares history and cwd with `/shell` through the store. Never opens when focus is in an editable field.
- **Shell commands** (each with full manual: summary, usage, description, examples, seeAlso):
  - `exit` — in the console: close it; on `/shell`: switch to human.
  - `human` — switch to human (`recruiter` kept as alias).
  - `reboot` — replay the bootloader (`/?boot=1`).
  - `fullscreen` — console only: go to `/shell`.
- **AI tool** `toggleRecruiter(on)` → `switchMode(mode)`.
- **History:** each mode is its own URL; back/forward work; navigation updates `kernel:mode`.

## 7. Error handling & edge cases

- Blocked storage → menu each visit, otherwise fully functional.
- `?mode=` invalid value → ignored.
- Empty or minimal portfolio → proof strip / systems / experience sections render empty states or are omitted; `bootLog` never throws.
- Ask: rate limit and offline modes as existing `/api/query`.
- No layout shift from the overlay (fixed position, outside flow).

## 8. Testing

- `tests/boot.test.ts` — `decideBoot` preselect + skip rules for every signal, countdown per device, `?boot=1`; `bootLog` for full and empty portfolios.
- Store — mode persistence, legacy `kernel:recruiter` removal, storage failure.
- Shell — new commands pass "every command has a complete manual"; `exit`/`human`/`reboot`/`fullscreen` produce the right actions; `switchMode` action parsing in the query handler.
- Routing — `/?cmd=` → `/shell?cmd=`, `/human` → `/#human`, sitemap entries.
- Browser verification — first visit countdown + morph, countdown stop, return-visit skip (both modes), console open/share history/close, pill switch, reduced motion, 390 px viewport, JS disabled.
- `npm run check` green.

## 9. Out of scope

Real content, Gemini key, deployment (tracked separately); analytics on mode choice (could be added later via the existing command-name-only analytics).
