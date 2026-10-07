# Kernel

An interactive developer portfolio with two ways in:

- **The recruiter view** (`/`): a fast, normal web page showing projects, experience and skills.
- **The shell** (`/shell`): a terminal you can explore with commands like `ls`, `cat` and `run atlas`.

Visitors can also ask questions in plain English. An AI (Google Gemini) answers using only the portfolio's own content.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

The AI is optional. Without a key, questions get answers from a local search instead. To turn the AI on:

```bash
cp .env.example .env.local
# then put your free key from https://aistudio.google.com/apikey into GEMINI_API_KEY
```

## How visitors use it

Opening `/` shows a short boot menu with two options:

| Option | What it opens |
|---|---|
| **Just show me the work** | The recruiter view (preselected for most visitors) |
| **Give me a shell** | The terminal |

The preselected option starts by itself after 3 seconds (2 seconds on phones), and moving the mouse over the menu stops the countdown. A returning visitor gets the mode they used last time preselected. Visitors coming from GitHub or Hacker News get the shell preselected.

There are several ways to switch modes later:

- the `human · shell` switch in the header;
- the `` ` `` key on any page, which opens a drop-down console;
- typing `exit` in the shell.

### Handy links

| Link | Does |
|---|---|
| `/?mode=human` | Opens the recruiter view directly |
| `/?mode=shell` | Opens the shell directly |
| `/shell?cmd=run%20atlas` | Opens the shell and runs a command (up to 5 commands, separated by `;`) |
| `/?boot=1` | Always shows the boot menu (good for demos) |

### Shell cheat sheet

| Try | To |
|---|---|
| `ls`, `cd systems/atlas`, `cat decisions.md` | Browse projects like folders |
| `run atlas` | Watch a simulated request go through a system |
| `git log`, `diff atlas relay`, `graph atlas` | Look at history, compare systems, see skill links |
| `ask <question>` (or just type the question) | Ask the AI |
| `tour` | A 20-second guided tour (offered on your first visit) |
| `man kernel`, `help` | See every command |

Tab autocompletes, ↑/↓ scrolls through history, and Ctrl+L clears the screen. The bar above the prompt always suggests what to try next.

## Put in your own content

Everything on the site comes from the `content/` folder. Right now it holds **sample** data.

| File | What goes in it |
|---|---|
| `content/identity.ts` | Name, role, tagline, summary, links |
| `content/technologies.ts` | Your tech stack |
| `content/capabilities.ts` | What you can do |
| `content/experience.ts` | Jobs and milestones |
| `content/systems/*.ts` | One file per project (also add it to `content/systems/index.ts`) |
| `public/resume.pdf` | Your résumé |

Once an item holds real content, set `placeholder: false` on it. Then run `npm test`. If something is wrong, the test names the exact field, for example `systems.atlas.architecture.edges[3]: unknown node "ghost"`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the site locally |
| `npm test` | Run the tests |
| `npm run lint` | Check code style |
| `npm run build` | Build for production (fails if the content is invalid) |
| `npm run check` | All of the above: run it before deploying |

## Deploy

See **[docs/DEPLOY.md](docs/DEPLOY.md)**. It walks through a free Vercel deploy step by step.

## Project layout

```
content/     your portfolio data (the only place facts live)
app/         pages and API routes
components/  UI pieces
core/        pure logic: shell engine, search, graph, boot decisions
server/      the AI question handler
tests/       unit tests
docs/        deploy guide, design specs and plans
```

Built with Next.js 16, TypeScript, Tailwind CSS 4 and the Vercel AI SDK (Gemini).
