# Putting in your real content

Everything visitors see comes from six places: five TypeScript files in `content/` and your résumé. This guide covers what each field does, where it shows up on the site, what good content looks like, and how to get it live.

> **Short version:** edit `content/`, replace `public/resume.pdf`, check it with `npm run dev`, then commit and push. Vercel rebuilds the site by itself in about a minute.

---

## How content flows through the site

```
content/*.ts ──▶ validated when the site is built (core/schema.ts + core/content.ts)
                  │  a typo or an unknown id → the build fails and names the exact field
                  ▼
   ┌──────────────┬──────────────────┬───────────────────┬──────────────────────┐
   │ Recruiter    │ Project pages    │ The shell         │ The AI (ask …)       │
   │ view at /    │ /systems/<slug>  │ ls, cat, run,     │ answers ONLY from    │
   │              │ + share images   │ git log, diff …   │ this content         │
   └──────────────┴──────────────────┴───────────────────┴──────────────────────┘
```

The same facts appear in four places, so you write each fact once. The AI can't know anything that isn't in these files, which means good content is also what makes good AI answers.

## Who you're writing for

| Visitor | How long they look | What they see first | What they need from you |
|---|---|---|---|
| **Recruiter** | ~30 seconds | The recruiter view: name, role, tagline, 3 headline numbers, 3 flagship projects, experience | A clear role and seniority, believable results, and an easy way to contact you |
| **Hiring manager / engineer** | 3–10 minutes | A project page, or `run <project>`, `cat decisions.md`, `git log` in the shell | How you think: the problem, the architecture, the trade-offs, what you'd do differently |
| **Someone you sent a link to** | Varies | The share-preview image in Slack or LinkedIn | Name, role, tagline, and a project that can be demoed |

Write for the 30-second reader in the short fields (`tagline`, `impact`, commit messages) and for the 10-minute reader in the long ones (`decisions`, `tradeOffs`, `challenges`).

---

## ⚠️ Read this before you start

These things are tied to the sample content and **will break or look wrong** when you replace it:

1. **About 110 tests use the sample projects.** Many files under `tests/` refer to `atlas`, `relay`, `beacon`, `ledger`, `Your Name` and `example-labs`. Two tests in `tests/content.test.ts` will also fail:
   - "marks every system as placeholder": it expects `placeholder: true` everywhere;
   - "has exactly three featured systems": it expects exactly 3 systems with `featured: true`.

   **What it means:** `npm test` and `npm run check` will fail after you swap the content, even if the content is fine. **The live site isn't affected**, because Vercel only runs `next build`, and that still validates the content strictly. Until the tests are changed to use their own sample data, check your content with:
   ```bash
   npx tsc --noEmit && npm run build
   ```
   The proper fix is to make the tests use a fixed copy of the sample data instead of `content/`. That's an engineering task; ask for it as one.

2. **The shell's help pages use the sample names in their examples.** For example, `man ls` shows `ls -l systems/atlas` and `man diff` shows `diff atlas relay`. Once `atlas` is gone, these examples fail when a visitor tries them. They're in `core/shell/commands/*.ts` (the `examples:` lines) and in `git show 7f3b`, which uses a sample commit hash. Update them to use your project slugs.

3. **README.md and DEPLOYMENT.md mention `run atlas`** as an example. Update those too, or leave them, since they're developer docs.

4. **The repository is public.** Everything in `content/` and `public/resume.pdf` can be read on GitHub. Leave out your phone number, home address, and anything covered by an NDA (see [Confidential work](#confidential-work)).

---

## 1. `content/identity.ts`: who you are

This is the most visible file: it's the top of the recruiter view, the share image, the shell's welcome message and `whoami`/`about.md`.

| Field | Required | Where it shows | What I expect |
|---|---|---|---|
| `name` | ✅ | Hero, share image, page titles. The first word is used in the "Ask" suggestions ("What is *Pruthvi*'s strongest project?") | Your name as you want recruiters to search for it |
| `role` | ✅ | Hero, share image, the site's description | A searchable job title plus your focus. Use `·` to separate the two |
| `tagline` | ✅ | Hero, share image, the description in link previews | **One sentence**, under ~90 characters, saying what you build and for whom |
| `summary` | ✅ | Recruiter view, `about.md`, the AI's knowledge | 2–3 sentences: what you do, your strongest area, what you're looking for |
| `location` | | Hero, shell | City and country, plus "remote OK" if that's true |
| `availability` | | Hero badge, shell welcome | Short and specific: "Open to senior AI-engineering roles · from Jan 2027" |
| `links.email` | ✅ | Contact page, hero | An address you check |
| `links.github`, `links.linkedin` | | Contact page, hero | Full URLs |
| `links.resume` | | "Download résumé" buttons | Keep it as `/resume.pdf` |
| `principles[]` | ✅ (can be empty) | "How I think" section, the AI's knowledge | 3–4 items: `title` (≤ 5 words) and `body` (1–2 sentences) |
| `human.about` | ✅ | "How I think" section, the shell | 2–3 sentences about you outside work |
| `human.interests[]` | ✅ (can be empty) | "How I think" section | 4–6 short items |
| `placeholder` | ✅ | Hides the "SAMPLE" tag during local development | Set to `false` |

**Making it count:**
- **`tagline` is your headline.** It appears in every link preview. Name the kind of system and an outcome, not adjectives.
  - ❌ "Passionate engineer who loves building innovative AI solutions."
  - ✅ "I build retrieval and agent systems that answer from your data, and say when they can't."
- **`role` should match the job titles you want.** If you want "AI Engineer" or "ML Platform Engineer" roles, use those words; recruiters search for titles.
- **`summary` should end with what you want next.** The AI uses it to answer "What kind of role is X looking for?", which is one of the three suggested questions on the recruiter view.
- **`principles` are where you stand out.** Make them opinions someone could disagree with, each backed by something you did: "Complexity must be earned: Atlas started as one prompt and only got a router once evals showed it was needed." Generic values ("I value teamwork") add nothing.
- **Keep `human` short and specific.** "Restores old film cameras" is memorable; "Likes travel" isn't.

---

## 2. `content/technologies.ts`: your stack

```ts
{ id: "langgraph", name: "LangGraph", category: "ai" }
```

| Field | Rules |
|---|---|
| `id` | lowercase-kebab-case, unique. Projects, capabilities and diagrams refer to the tech by this id. |
| `name` | How it's displayed |
| `category` | One of `ai`, `backend`, `frontend`, `cloud`, `data`, `devops`, `language`. The recruiter view groups the stack by category. |

**What I expect:** 12–25 technologies you could be interviewed on. Every technology should be used by at least one project or capability; one that nothing uses floats alone in the graph and suggests you've only touched it.

**Making it count:** depth beats breadth. A short list where each item links to real projects in `/graph` is more convincing than 40 logos. Use specific names ("Azure OpenAI", "pgvector") rather than generic ones ("Cloud", "Databases").

---

## 3. `content/capabilities.ts`: what you can do

```ts
{ id: "rag", name: "Retrieval-Augmented Generation", description: "…", technologies: ["langchain", "weaviate"] }
```

| Field | Rules |
|---|---|
| `id` | kebab-case, unique. Projects refer to it. |
| `name` | A skill area a hiring manager would put in a job description |
| `description` | One sentence on *how* you do it, not what it is |
| `technologies` | ids from `technologies.ts`. An unknown id fails the build. |

**What I expect:** 4–7 capabilities, each shown by at least 2 projects. These are the hubs of the `/graph` page and what `which <capability>` uses in the shell.

**Making it count:** write the description as your approach.
- ❌ "Building RAG applications."
- ✅ "Grounding answers in private data with hybrid retrieval, re-ranking and a citation check that refuses rather than guesses."

---

## 4. `content/systems/*.ts`: your projects (the most important part)

Each project is one file. Register it in `content/systems/index.ts`:

```ts
import { atlas } from "./atlas";   // ← one import per file
export const systems = [atlas, …];
```

To remove a sample, delete its file **and** its line in `index.ts`.

### What the recruiter view picks

- **Flagships:** the first 3 projects with `featured: true`, ordered by `number`.
- **The three headline numbers** under the hero: the **first `impact` entry** of each flagship.
- **The share-preview image:** shows `run <slug>` for the first project that has a `simulation`.

So: mark your 3 best projects `featured: true`, give them `number` 1–3, and put the most impressive number **first** in each one's `impact` list.

### Fields

| Field | Required | Where it shows | What I expect |
|---|---|---|---|
| `id`, `slug` | ✅ | URL `/systems/<slug>`, the shell folder `~/systems/<slug>`, `run <slug>` | Short, lowercase, unique, ideally one word (`atlas`). Visitors will type it. |
| `number` | ✅ | Sort order, `SYS-01` labels | Unique. 1 = your best. |
| `name` | ✅ | Everywhere | The project's real or code name |
| `tagline` | ✅ | Cards, project page, the fallback when there's no `impact` | One line: what it does and for whom |
| `featured` | ✅ | Recruiter-view flagships | `true` on exactly your top 3 |
| `category` | ✅ | Card label, grouping on `/systems` | e.g. `"AI · Retrieval"`, `"Platform · Infra"` |
| `period` | | Project page, shell | `"2024 — 2025"` |
| `status` | ✅ | Badge | `production`, `prototype` or `archived`. "production" counts for a lot; don't overstate it. |
| `summary` | ✅ | Top of the project page | 2 sentences: what it does and the result |
| `problem` | ✅ | "Problem" section | The pain before it existed, in concrete terms |
| `context` | | Under the problem | Team, users, scale, constraints |
| `role` | ✅ | Project page | **Your** part: "Lead engineer: retrieval, orchestration, evaluation" |
| `responsibilities[]` | ✅ | Project page | 3–5 bullets, each starting with a verb you did |
| `technologies[]` | ✅ | Tags, `/graph` | ids from `technologies.ts` |
| `capabilities[]` | ✅ | `/graph`, `which` | ids from `capabilities.ts` |
| `architecture.nodes[]` | ✅ (≥ 1) | The interactive diagram, the simulation | See [Architecture diagram](#the-architecture-diagram) |
| `architecture.edges[]` | ✅ | Arrows in the diagram | `{ from, to, label? }`; node ids must exist |
| `decisions[]` | ✅ (can be empty) | "Decisions" section, `cat decisions.md`, `explain` | See [Decisions](#decisions-the-strongest-signal) |
| `challenges[]` | | "Challenges" section | 2–4 real problems you hit |
| `tradeOffs[]` | | "Trade-offs" section | `{ gained, cost }` pairs |
| `impact[]` | | Cards, headline numbers, project page, project share image | `{ label, value, note? }`; see [Numbers](#numbers-impact-and-benchmarks) |
| `simulation` | | `run <slug>`, the share image, the tour's last step | See [Simulation](#the-simulation-run-slug) |
| `benchmarks[]` | | `benchmark <slug>` in the shell | Measured numbers with their source |
| `links` | | Buttons on the project page | `repo`, `demo`, `writeup` URLs, only if they're public |
| `placeholder` | ✅ | "SAMPLE" tag during local development | `false` once it's real |

### The architecture diagram

```ts
{ id: "router", label: "Query Router", kind: "agent", x: 46, y: 50, description: "Classifies intent and picks a retrieval strategy.", tech: ["langgraph"] }
```

- `kind` is one of: `client`, `service`, `agent`, `model`, `store`, `queue`, `external`. Each kind gets its own style.
- `x`, `y` are **percentages (0–100)** of the diagram's width and height. Lay it out left to right: client at `x≈4`, then services, then stores and models at `x≈90`. Spread nodes vertically between `y≈14` and `y≈88`.
- `description` shows when a visitor clicks the node. Say what it does **and why it exists**.
- `tech` ties a node to the technology graph.

**Making it count:** 5–9 nodes is the sweet spot. Show the parts that carry your decisions (the router, the verifier, the cache, the queue), not every microservice. Label edges with verbs (`"search"`, `"miss"`, `"verify"`) so the diagram reads like a sentence.

### Decisions (the strongest signal)

```ts
{
  title: "Hybrid retrieval over pure vector search",
  context: "Contract questions hinge on exact terms that embeddings blur.",
  options: ["Vector only", "BM25 only", "Hybrid with reciprocal rank fusion"],
  choice: "Hybrid with reciprocal rank fusion",
  rationale: "Keyword recall for exact terms, semantic recall for paraphrases; fusion needed no extra model.",
  status: "accepted",          // or "revisited"
}
```

This is what separates senior engineers in a portfolio. Aim for **2–3 decisions per flagship**.
- `options` should include real alternatives you rejected, not straw men.
- `rationale` should mention a constraint: latency, cost, team size, data shape, deadline.
- **Use `status: "revisited"`** for a call you later changed, and say why in the rationale. Admitting you changed course, with a reason, reads as maturity.

### Numbers: `impact` and `benchmarks`

| | `impact` | `benchmarks` |
|---|---|---|
| Purpose | Business or user outcome | Technical measurement |
| Example | `{ label: "faster answers", value: "-72%", note: "median, 6 weeks after launch" }` | `{ metric: "p95 latency", value: "820", unit: "ms", context: "10k-doc corpus", measuredAt: "2025-05", source: "Grafana" }` |
| Shown | Cards, the 3 headline numbers, project page, share image | `benchmark <slug>` in the shell |

**Rules:**
- **Only real numbers.** The site promises "Kernel never estimates or invents numbers" (`man benchmark`). An engineer who asks how you measured something in an interview needs an answer.
- `value` is the big text, so keep it short: `"-72%"`, `"40k+"`, `"3×"`, `"$18k/mo"`.
- `label` reads after the number: "-72% **faster answers**". Lowercase, 2–3 words.
- Use `note` for the honest qualifier (baseline, time window, sample size).
- **Put the most impressive `impact` entry first**, because the recruiter view only shows the first.
- **No number?** Leave `impact` out. The card falls back to the `tagline`, which is better than a vague number.

### The simulation (`run <slug>`)

```ts
simulation: {
  prompt: "What are the termination clauses in the 2023 vendor contracts?",
  steps: [
    { nodeId: "ui", title: "REQUEST", detail: "Question received", durationMs: 700 },
    …
  ],
}
```

- Each step lights up one node in the diagram (`nodeId` must exist), with a short caption.
- `durationMs` can be at most 10,000 per step. Keep the **whole run at 6–9 seconds** (8–10 steps of 600–1100 ms).
- `detail` should feel like a real trace: ids, counts, scores, cache hit or miss ("6 chunks · scores 0.94, 0.91 …").

**Making it count:** this is the site's "wow" moment. It's the tour's last step and appears on the share image, so give **your #1 project** a simulation. Pick a `prompt` a real user would ask, and show the clever path, such as a cache miss followed by verification, rather than the happy path only.

### Confidential work

Most good work is under NDA. You can still show it:
- Give it a code name (`name: "Atlas"`) and describe the client generically ("a legal and finance team at a mid-size firm").
- Round or index the numbers ("~40k documents", "-70% time-to-answer") and say so in `note`.
- Draw your own architecture rather than the company's real one, at the level you'd discuss in an interview.
- Leave out `links.repo` for private code. A `writeup` link to a blog post works well instead.

### How many projects?

**3–5.** Three strong flagships beat eight thin ones. A fourth or fifth non-featured project (a side project, an open-source contribution) shows range.

---

## 5. `content/experience.ts`: your career, shown as git history

Each job is a **branch** and each achievement is a **commit**. This feeds `/trace`, `git log` / `git branch` / `git show` in the shell, and the experience timeline on the recruiter view.

```ts
{
  id: "acme",                      // kebab-case, unique
  organisation: "Acme Corp",
  role: "Senior Software Engineer — AI Platform",
  start: "2024-06",                // YYYY-MM
  end: "2025-09",                  // leave out for your current job
  summary: "One sentence on the team and your scope.",
  branch: "feat/ai-platform",      // shown in git branch
  commits: [
    { hash: "7f3b2d1", message: "feat: ship Atlas document search to 400 analysts", date: "2025-03",
      body: "Hybrid retrieval, graph orchestration, citation checks.", systems: ["atlas"] },
  ],
}
```

| Field | Rules |
|---|---|
| `start`, `end` | `YYYY-MM`. List jobs newest first. |
| `branch` | Fun but readable: `feat/ai-platform`, `fix/legacy-billing`, `chore/internship` |
| `commits[].hash` | Any 7 characters of lowercase hex (`0-9a-f`), unique within the job. They're labels, not real git hashes. |
| `commits[].message` | Use the conventional-commit style: `feat:`, `perf:`, `fix:`, `refactor:`, `chore:` |
| `commits[].date` | `YYYY-MM`. List newest first within the job. |
| `commits[].systems` | Project slugs. This links the commit to the project pages. An unknown slug fails the build. |

**Making it count:**
- **The first commit of each job is its headline on the recruiter view.** Put the biggest achievement first.
- Write messages as outcomes with a number: `perf: cut retrieval p95 from 2.1s to 820ms`, rather than `feat: worked on search`.
- 3–5 commits per job. Use `fix:` for a production incident you resolved; it's a great interview story.
- Link commits to projects with `systems: [...]` wherever you can. A connected story (job → commit → project → decision) is the site's main idea.

---

## 6. `public/resume.pdf`

- Replace the file and keep the **exact name** `resume.pdf`, since the buttons and `open resume` link to `/resume.pdf`.
- Export a text-based PDF (not a scanned image) so it's searchable and screen readers can read it. Keep it under ~1 MB.
- The PDF is downloaded as-is. The site doesn't read it, so **the AI doesn't know what's only in the PDF.** Anything important must also be in `content/`.
- **Remove your phone number and street address**, because the repo is public. Email and LinkedIn are enough.
- Make the résumé and the site agree on job titles, dates and numbers. Recruiters check.

---

## Getting it live

### 1. Edit and preview

```bash
npm run dev          # http://localhost:3000; the page reloads on save
```

Check these in the browser:

| Page | Look for |
|---|---|
| `/` (pick "Just show me the work") | Hero, the 3 headline numbers, 3 flagships, timeline, stack |
| `/systems/<slug>` for each project | The diagram's layout (no overlapping nodes), decisions, numbers |
| `/shell` | `ls systems`, `run <your #1 slug>`, `cat systems/<slug>/decisions.md`, `git log`, `tour` |
| `/graph` | Every technology connects to something |
| `/trace` | Jobs and commits in the right order |
| `/opengraph-image` and `/systems/<slug>/opengraph-image-…` | Share images: name, tagline and numbers fit without being cut off |

If the content is invalid, the dev page shows an error naming the field, for example `systems.atlas.architecture.edges[3]: unknown node "ghost"`.

### 2. Check that it builds

```bash
npx tsc --noEmit && npm run build
```

(`npm run check` also runs the tests, which fail until they're changed to use their own sample data. See [Read this before you start](#️-read-this-before-you-start).)

### 3. Commit and push

```bash
git add content public/resume.pdf
git commit -m "content: real profile, projects and experience"

gh auth switch --user gruve-pruthvi
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
gh auth switch --user pruthvi-aifabrik
```

Vercel picks up the push and the live site updates in about a minute. Watch it with `npx vercel ls`.

### 4. Check the live site

Go through the same pages on <https://kernel-hazel.vercel.app>. Then paste the link into a LinkedIn or Slack message draft to see the share preview. LinkedIn caches previews; use its Post Inspector to refresh one.

---

## Final checklist

**Content**
- [ ] No sample text left: search for `Sample`, `sample metric`, `Your Name`, `example.com`, `your-handle`
- [ ] `placeholder: false` in `identity.ts` and every project
- [ ] Exactly 3 projects have `featured: true`, numbered 1–3
- [ ] Every flagship has its best `impact` entry first, and each number has an honest `note`
- [ ] Your #1 project has a `simulation` that runs in 6–9 seconds
- [ ] Each flagship has 2–3 `decisions`, including at least one rejected alternative that's actually plausible
- [ ] The first commit in each job is the headline achievement
- [ ] Every technology is used by something; every `systems:` slug exists

**Impression**
- [ ] `tagline` fits on one line and names what you build
- [ ] `role` uses the job title you're applying for
- [ ] `summary` ends with what you're looking for
- [ ] Ask the AI the three suggested questions and check the answers are good (needs the Gemini key, the next launch step)

**Safety**
- [ ] No phone number, home address or confidential client names, in the content or the PDF
- [ ] Every number can be explained in an interview

**Tidy-up**
- [ ] Shell help examples (`examples:` in `core/shell/commands/*.ts`) use your slugs, not `atlas`/`relay`
- [ ] README.md and DEPLOYMENT.md examples updated (optional)
