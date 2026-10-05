# Kernel — Design Spec

**Date:** 2026-10-05
**Status:** Draft for review
**Source material:** ChatGPT conversation "Creative Developer Portfolios" (Kernel Product Foundation, Experience & Design, Feature Systems, Technical Architecture, Build Playbook).

---

## 1. Intent

Kernel is a developer portfolio that demonstrates *how its owner engineers* rather than listing claims. Visitors inspect real systems (architecture, decisions, trade-offs, impact), traverse a graph linking technologies to the work that used them, read the career as a commit history, and can interrogate everything through an AI (**Query**) or a terminal (**Command**). A **Recruiter Mode** guarantees that creativity never blocks someone with 45 seconds.

**Success criteria**

1. A recruiter reaches role, top 3 systems, stack, resume and contact within one click from any page.
2. An engineer can open any System and inspect its architecture node-by-node and step through a simulated request.
3. Query answers questions from portfolio data only, and visibly drives the UI (highlights graph nodes, opens systems).
4. Command supports the documented command set with autocomplete and history.
5. All views read from one content source; adding a System means adding one content file, no component changes.
6. Deploys to Vercel's free tier with one optional environment variable (`GEMINI_API_KEY`); the site is fully usable without it.
7. Lighthouse-level hygiene: responsive to 360px, keyboard-navigable, respects `prefers-reduced-motion`.

**Decisions already made by the owner**

- Name: **Kernel**. No personal name in product branding.
- Content: **placeholders** now, owner replaces them later.
- AI provider: **Google Gemini** (free tier).
- Scope: **P0 + P1**. P2 deferred.

---

## 2. Scope

### In scope

| Priority | Feature |
|---|---|
| P0 | Home, Systems index, System detail, interactive Architecture, Graph, Trace, Human, Connect, responsive layout, structured content model |
| P1 | Query (Gemini + UI actions + local fallback), Command (⌘K terminal), Engineering Decisions, Capability evidence, System Simulation, Recruiter Mode, graph-driven navigation |

### Out of scope (P2, later)

Developer Mode, Lab experiments, `/source` self-inspection, sound, analytics, CMS, database, authentication.

---

## 3. Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router), TypeScript strict | Static pages + one serverless route in one Vercel deploy |
| Styling | Tailwind CSS v4 + CSS custom-property tokens | Tokens drive both themes; utilities keep components small |
| Motion | `motion` (Framer Motion) | Page/element transitions; honours reduced motion |
| Graph layout | `d3-force` rendered to custom SVG | Small bundle, full visual control (React Flow is heavier and opinionated) |
| Architecture diagrams | Custom SVG from content-defined nodes/edges with explicit coordinates | Deterministic, authorable layouts |
| Validation | Zod | Content schemas + API input + AI action validation |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/google`) | Streaming + tool calling, provider-swappable |
| Tests | Vitest | Core logic tests |
| Deploy | Vercel Hobby (free) | Zero-config Next.js |

Model is configurable: `GEMINI_MODEL` env var, default `gemini-2.5-flash`.

---

## 4. Architecture

```
content/  (data only, Zod-validated)
   │
core/     (pure TS: content loading, graph, search, command, query context, actions)
   │
app/ + components/  (presentation)
   │
app/api/query/route.ts  (server: Gemini streaming, rate limit, fallback)
```

Rules:

- `content/` contains no React and no logic.
- `core/` contains no React and is fully unit-testable.
- Components never import from `content/` directly; they use `core/` selectors.
- Only `app/api/query` touches secrets.

### Repository layout

```
kernel/
├── app/
│   ├── layout.tsx            # shell: header, mode toggle, Query + Command overlays
│   ├── page.tsx              # Home
│   ├── systems/page.tsx
│   ├── systems/[slug]/page.tsx
│   ├── graph/page.tsx
│   ├── trace/page.tsx
│   ├── human/page.tsx
│   ├── connect/page.tsx
│   ├── not-found.tsx
│   └── api/query/route.ts
├── components/
│   ├── shell/       # Header, Footer, ModeToggle, ThemeToggle, BootSequence
│   ├── systems/     # SystemCard, SystemHeader, Decisions, TradeOffs, Impact
│   ├── architecture/# ArchitectureDiagram, NodeInspector, SimulationRunner
│   ├── graph/       # SkillGraph, GraphList (mobile)
│   ├── trace/       # CommitLog
│   ├── query/       # QueryPanel, QueryMessage
│   ├── command/     # Terminal
│   ├── recruiter/   # RecruiterView
│   └── ui/          # Button, Tag, Panel, Kbd, SectionLabel
├── content/
│   ├── identity.ts
│   ├── experience.ts
│   ├── technologies.ts
│   ├── capabilities.ts
│   └── systems/<slug>.ts     # one file per System, registered in systems/index.ts
├── core/
│   ├── schema.ts      # Zod schemas + inferred types
│   ├── content.ts     # validated loaders + selectors
│   ├── graph.ts       # buildGraph(), neighbours()
│   ├── search.ts      # searchPortfolio() — token/field-weighted local index
│   ├── command.ts     # parseCommand(), runCommand() → output + actions
│   ├── actions.ts     # UiAction schema + types
│   └── query.ts       # buildContext(), systemPrompt(), localAnswer()
├── lib/               # client stores (mode, theme, query/command open state, action bus)
├── tests/
└── docs/
```

---

## 5. Content model

All schemas live in `core/schema.ts`. Fields marked `?` are optional; UI hides absent sections.

**Identity**: `name`, `role`, `tagline`, `summary`, `location?`, `availability?`, `links { email, github?, linkedin?, resume? }`, `principles[] { title, body }`, `human { about, interests[] }`.

**Technology**: `id`, `name`, `category` (`ai` | `backend` | `frontend` | `cloud` | `data` | `devops` | `language`).

**Capability**: `id`, `name`, `description`, `technologies[]` (ids).

**Experience** (rendered as Trace): `id`, `organisation`, `role`, `start`, `end?`, `summary`, `commits[] { hash, message, date, body?, systems?[] }`, `branch` (label).

**System**:

```
id, slug, number (presentation only), name, tagline, featured: boolean,
category, period?, status ('production'|'prototype'|'archived'),
summary, problem, context?, role, responsibilities[],
technologies[] (ids), capabilities[] (ids),
architecture {
  nodes[] { id, label, kind ('client'|'service'|'agent'|'model'|'store'|'queue'|'external'), x, y, description, tech?[] }
  edges[] { from, to, label? }
},
decisions[] { title, context, options[], choice, rationale, status ('accepted'|'revisited') },
challenges[]?, tradeOffs[] { gained, cost }?,
impact[] { label, value, note? }?,
simulation? { prompt, steps[] { nodeId, title, detail, durationMs } },
links? { repo?, demo?, writeup? },
placeholder: boolean
```

Integrity checks (run at load, enforced in tests):

- Every referenced technology/capability id exists.
- Every architecture edge and simulation step references an existing node.
- Slugs and numbers are unique.

Placeholder policy: each placeholder file sets `placeholder: true`, uses obviously fictional names (e.g. "Atlas RAG Platform"), and the UI shows a small "sample content" tag on placeholder Systems in development builds only. The README lists every file to replace.

---

## 6. Experience

### Global shell

- Header: `KERNEL` wordmark · `SYSTEMS  GRAPH  TRACE  HUMAN  CONNECT` · Ask (`/`) · Command (`⌘K`) · Recruiter toggle · theme toggle.
- Mobile: header collapses to a menu; Ask and Command remain reachable.

### Home `/`

1. **Boot sequence** (first visit only, ~1.6s, any key/click skips, never shown in Recruiter Mode or with reduced motion), stored in `localStorage` (wrapped in try/catch).
2. **Hero**: role, one-line thesis, two CTAs: *Explore systems* and *Ask Kernel*.
3. Faint animated graph in the hero background (static under reduced motion).
4. **Featured Systems**: 3 cards: number, name, tagline, key technologies, one impact metric.
5. Entry strip into Graph, Trace, Human.

### Systems `/systems`

Featured first, then others. Filter by technology and capability (chips); filter state reflected in URL query (`?tech=langgraph`) so Query/Command can deep-link.

### System detail `/systems/[slug]`

Sections in order: header (`SYSTEM / 001`, name, tagline, status, period, role) → Problem & context → **Architecture** → **Run simulation** → Decisions → Challenges & trade-offs → Impact → technologies/capabilities (each links to Graph) → related Systems.

**Architecture diagram**: SVG from content coordinates, scales to container; on narrow screens horizontally scrollable. Hover/focus a node: highlight node and its edges, show description. Click/Enter: pin the inspector panel (description, technologies). Animated particles travel along edges when motion allowed.

**Simulation**: shows the simulation prompt, then steps through `steps[]`, lighting the active node and appending a log line per step (`[RETRIEVAL] Searching 2,413 chunks…`). Controls: Run, Pause, Step, Reset. Labelled "Simulated walkthrough".

### Graph `/graph`

Nodes: Systems, Technologies, Capabilities (distinct shapes/colours). Edges from System→Technology and System→Capability, Capability→Technology. Force layout computed client-side, then settled. Click a node to focus: neighbours stay lit, rest dim; side panel lists related items with links. `?focus=<id>` URL param selects a node (used by Query/Command). Below `md` width, the graph renders as a grouped, filterable list instead.

### Trace `/trace`

Git-log presentation: each Experience is a branch; commits listed newest-first with hash, message, date, optional body and links to Systems. A compact branch line visual on desktop.

### Human `/human` and Connect `/connect`

Human: about, principles ("How I think"), interests. Connect: email (copy button), links, resume download, availability.

### Recruiter Mode

Toggle in header; persisted in `localStorage`. When on: boot and background motion disabled, and any page shows a top **Recruiter summary** (role, location/availability, top 3 Systems with one impact metric each, core stack, Resume + Contact buttons) above normal content. Command `recruiter` toggles it.

---

## 7. Query (AI)

### Client

Overlay panel opened by `/`, the Ask button, or `ask "<q>"`. Streams responses, shows suggested prompts, keeps conversation in memory for the session (not persisted). Shows sources (System/Technology chips) used for the answer. Executes UI actions the response carries.

### UI actions (`core/actions.ts`)

```
navigate        { path }                       // must be an internal route
openSystem      { slug }
highlightGraph  { ids[] }                      // navigates to /graph?focus=…
filterSystems   { tech?, capability? }         // navigates to /systems?tech=…
toggleRecruiter { on }
```

Every action is Zod-validated on the client before execution; ids/slugs must exist in content. Invalid actions are dropped silently (logged in dev).

### Server `/api/query` (POST)

Input: `{ messages: { role, content }[] }`, validated: max 12 messages, max 500 chars per user message.

Flow:

1. Rate limit: per-IP sliding window (10 req/min, 60/day) in memory. Best-effort on serverless (per instance); documented as such.
2. Retrieve: `searchPortfolio()` over the latest user message picks the top relevant entities; `buildContext()` serialises identity + those entities (+ a compact index of all System names/ids/tech) into the prompt.
3. Call Gemini via AI SDK `streamText` with the system prompt and tools mirroring the UI actions. Tool calls are returned to the client as structured parts; the server executes nothing.
4. System prompt rules: answer only from provided context; say when information isn't present; third person about the owner; concise; never invent metrics; prefer calling a UI action when the user asks to "show"/"open".

Fallback (no key, provider error, or quota): server returns a non-streamed `localAnswer()`: a templated answer built from search results ("Here's what I found related to *X*: …") plus suggested actions. Response is marked `mode: "local"` and the panel shows a subtle "offline mode" indicator.

---

## 8. Command (⌘K)

Overlay terminal. Parser in `core/command.ts` (pure): tokenises, supports quoted args and `--flags`. `runCommand()` returns `{ lines: OutputLine[], actions: UiAction[] }`.

| Command | Behaviour |
|---|---|
| `help` | list commands |
| `whoami` | identity summary |
| `systems [--tech <id>] [--cap <id>]` | list systems, optional filter |
| `inspect <slug>` | system summary + ASCII architecture chain; action `openSystem` with `--open` |
| `graph [<id>]` | navigate to graph, focusing id |
| `trace` | recent commits; navigate to /trace |
| `stack [--<category>]` | technologies grouped |
| `ask "<question>"` | hands off to Query |
| `recruiter [on\|off]` | toggle mode |
| `resume`, `contact` | links / navigate |
| `clear` | clear screen |
| `sudo hire` | Easter egg → contact |
| `rm -rf *` | Easter egg: "Permission denied. Nice try." |

Tab autocompletes commands and slugs/ids; ↑/↓ history (session only); unknown commands suggest the nearest match (Levenshtein ≤ 2).

---

## 9. Visual system

- Tokens on `:root` (dark default) and `[data-theme="light"]`: `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent` (single accent, warm amber `#E8A23B` dark / adjusted for light), `--accent-soft`, plus node-kind colours derived from a small muted palette.
- Type: Inter (UI/body) + JetBrains Mono (labels, terminal, system numbers) via `next/font`.
- Background: subtle 32px grid at very low contrast.
- Surfaces: 1px borders, small radii (6–10px), restrained blur only on overlays.
- Motion: 150–300ms, ease-out; page fade/slide 8px; all non-essential motion disabled under reduced motion or Recruiter Mode.
- Focus rings always visible (accent outline).

---

## 10. Error handling

| Case | Behaviour |
|---|---|
| Invalid content | Build/test fails with a precise Zod path message |
| Unknown system slug | `notFound()` → themed 404 with Command hint |
| Query: no key / quota / provider error | Local fallback answer, "offline mode" badge |
| Query: rate limited | 429 with friendly message; panel shows retry hint |
| Query: invalid input | 400; client prevents over-length input |
| Invalid AI action | Dropped client-side |
| `localStorage` unavailable | Defaults used; no errors |
| JS disabled | Content pages still render (static); overlays unavailable |

---

## 11. Testing

Vitest unit tests for `core/`:

- schema + integrity checks pass on shipped content, and fail on crafted bad content
- `buildGraph` node/edge counts and neighbour lookup
- `searchPortfolio` ranks an exact system name first
- `parseCommand` (quotes, flags), `runCommand` for each command incl. unknown → suggestion
- action validation rejects unknown slugs and external URLs
- `localAnswer` returns sources and actions
- `/api/query` handler: validation (400), fallback path without key, rate limit (429)

Verification before completion: `npm run lint`, `npm test`, `npm run build`, then run the production server and smoke-test every route + Query fallback via HTTP.

---

## 12. Deployment

- `README.md`: run locally, edit content (list of placeholder files), env vars, deploy.
- Vercel: import GitHub repo → framework auto-detected → add `GEMINI_API_KEY` (from Google AI Studio, free) → deploy. Optional `GEMINI_MODEL`.
- `.env.example` committed; `.env.local` git-ignored.
- No database, no paid services.
