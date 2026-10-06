# Kernel

An interactive developer portfolio: inspectable **Systems** (architecture, decisions, simulated requests), a skill **Graph**, a git-style **Trace**, an AI **Query** that answers from portfolio data and drives the UI — with two front doors chosen at boot: a fast **recruiter view** at `/` and the **Kernel shell** at `/shell`.

## Boot modes

Every load of `/` shows a bootloader: **Just show me the work** (recruiter view, preselected) or **Give me a shell**. It boots the preselected option after 3 s (2 s on touch devices); arrow keys or moving the pointer over the menu stop the countdown. Visitors arriving from GitHub, Hacker News, dev.to, Lobsters or Stack Overflow get the shell preselected. Returning visitors get their last mode preselected.

- Switch any time: the `human · shell` pill in the header, `` ` `` on any page for a drop-down console, `exit` / `human` in the shell.
- Links: `/` (adaptive), `/?mode=human`, `/?mode=shell`, `/shell?cmd=run%20atlas`, `/?boot=1` (always show the bootloader — handy for demos).
- Old `/?cmd=…` links redirect to `/shell?cmd=…`; `/human` redirects to `/#human`.

## The shell

The shell at `/shell` is **Kernel**, over a virtual filesystem generated from `content/`:

```
~/systems/<name>/   README.md · architecture · decisions.md · tradeoffs.md · impact.txt · stack.txt · links.txt
~/skills/           <capability>.md · graph
~/stack/            <technology>.txt
~/README.md · about.md · career.log · contact.txt · resume.pdf
```

Try `ls`, `cd systems/atlas`, `cat decisions.md`, `run atlas`, `grep -i rag . | head -n 5`, `find . -name *.md`, `man kernel`, `history`, or ask anything in plain English. Everything underlined is clickable; the recruiter view is one `exit` away (`gui <page>` opens a specific page).

Engineering introspection: `git log [system] [--oneline]`, `git show <hash>`, `git branch`, `diff atlas relay`, `status`, `ps`, `top`, `env`, `benchmark <system>` (prints only measurements you add as `benchmarks` in a system's content), `graph --depth 2 atlas`. Ask with `ask <question>` or just type it — answers are followed by a clickable tree of related systems. `open atlas --full` jumps to the visual case study.

**Share a demo:** any command can be a link — `https://<your-site>/shell?cmd=run%20atlas` or `/shell?cmd=man%20atlas` (up to 5 commands separated by `;`).

Shortcuts: Tab completes (press again for a menu; Tab/Shift+Tab cycle), → accepts the grey history/completion suggestion, ↑/↓ history, Ctrl+R search, Ctrl+A/E/U/W editing, Ctrl+C cancel, Ctrl+L clear, Esc closes the side pane.

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
   `/`, `/shell`, `/?cmd=man%20kernel` (should redirect to `/shell`), `/shell?cmd=run%20atlas`, `/systems`, `/opengraph-image`, `/sitemap.xml`, and ask a question in the shell (status bar should read `ai:online`).
6. Optional: add a custom domain in Vercel → Domains, then update `NEXT_PUBLIC_SITE_URL`.

## Analytics (optional)

Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to load [Plausible](https://plausible.io). No cookies, nothing personal: page views plus a `command` event whose only property is the command name (e.g. `grep`, `ask`) — never arguments or questions.

## Project structure

```
content/   portfolio data (the only place facts live)
core/      pure TypeScript: schemas, selectors, graph, search, actions, query, rate limit; core/shell = the shell engine
server/    AI query handler (Gemini streaming + local fallback)
app/       routes: / systems systems/[slug] graph trace human connect api/query
components/ UI
tests/     Vitest unit tests
docs/      design spec and implementation plan
```

## Keyboard

`/` ask (visual pages) · `` ` `` drop-down console · `⌘K` / `Ctrl+K` full shell · `Esc` close
