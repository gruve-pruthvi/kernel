# Kernel

An interactive developer portfolio: inspectable **Systems** (architecture, decisions, simulated requests), a skill **Graph**, a git-style **Trace**, an AI **Query** that answers from portfolio data and drives the UI, a **⌘K Command** terminal, and a **Recruiter Mode** one-screen summary.

Built with Next.js 16, TypeScript, Tailwind CSS 4, Motion, d3-force, Zod and the Vercel AI SDK (Gemini).

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Without `GEMINI_API_KEY`, Query still works in **offline mode** (local search answers).

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit tests (content integrity, graph, search, command, query API) |
| `npm run lint` | ESLint |
| `npm run build` | production build (fails on invalid content) |

## Make it yours — replace the placeholder content

Everything shown on the site comes from `content/`. Files currently holding **sample** data (marked `// PLACEHOLDER` and `placeholder: true`):

| File | What to put there |
|---|---|
| `content/identity.ts` | name, role, tagline, summary, links, principles, about |
| `content/technologies.ts` | your stack (`id`, `name`, `category`) |
| `content/capabilities.ts` | what you can do, grouped by technologies |
| `content/experience.ts` | roles as branches, milestones as commits (7-char hex hashes, `YYYY-MM` dates) |
| `content/systems/*.ts` | one file per project — register it in `content/systems/index.ts` |
| `public/resume.pdf` | your resume |

Set `placeholder: false` on each item once it's real (the dev-only "sample content" tag disappears).

**Architecture diagrams:** each node has `x` and `y` from 0–100 (left→right, top→bottom). **Simulations** are optional; each step lights up a node by `nodeId`.

Run `npm test` after editing — it pinpoints any broken reference, e.g. `systems.atlas.architecture.edges[3]: unknown node "ghost"`.

## Deploy free on Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo (framework: Next.js is auto-detected).
3. Add environment variable `GEMINI_API_KEY` — free key from [Google AI Studio](https://aistudio.google.com/apikey). Optional: `GEMINI_MODEL` (default `gemini-flash-latest`).
4. Deploy. Every push to `main` redeploys.

The Hobby plan is free; the site is static except `/api/query`. Query is rate-limited per IP (10/min, 60/day, best-effort in memory).

## Project structure

```
content/   portfolio data (the only place facts live)
core/      pure TypeScript: schemas, selectors, graph, search, actions, command, query, rate limit
server/    AI query handler (Gemini streaming + local fallback)
app/       routes: / systems systems/[slug] graph trace human connect api/query
components/ UI
tests/     Vitest unit tests
docs/      design spec and implementation plan
```

## Keyboard

`/` ask · `⌘K` / `Ctrl+K` command · `Esc` close
