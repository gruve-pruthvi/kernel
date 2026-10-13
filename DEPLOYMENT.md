# Deployment record

This file records how Kernel was deployed to Vercel on 2026-10-12, what was checked first, and how to run the site from now on. For a step-by-step guide to deploying from scratch, see [docs/DEPLOY.md](docs/DEPLOY.md).

## At a glance

| | |
|---|---|
| **Live site** | <https://kernel-hazel.vercel.app> |
| **Host** | Vercel, project `kernel` (team scope `skynet-unleashed`) |
| **Source** | <https://github.com/gruve-pruthvi/kernel>, branch `main` |
| **Auto-deploy** | Connected. A push to `main` updates the live site, and a push to any other branch gets a preview address. The connection is confirmed by the next push. |
| **Node.js** | 24.x on Vercel. The project requires 22 or newer. |
| **AI answers** | Off: no `GEMINI_API_KEY` is set yet, so questions use the local search. |
| **Content** | Still the sample content. |

## How it fits together

```
you ── git push ──▶ GitHub (gruve-pruthvi/kernel)
                       │  the Vercel GitHub App notifies Vercel of the push
                       ▼
                    Vercel build:  npm ci  →  next build
                       │
                       ▼
        ┌─────────────────────────────────────────────┐
        │ Static pages (/, /shell, /systems, …)        │ ← served from Vercel's
        │ prebuilt HTML, share images, sitemap         │   servers worldwide
        ├─────────────────────────────────────────────┤
        │ /api/query   streams answers (Gemini or      │ ← Node functions,
        │              local search), 30 s max         │   run on demand
        │ /api/status  {"ai": true|false}              │
        └─────────────────────────────────────────────┘
```

Almost the whole site is built ahead of time. Only the two API routes run code when someone visits.

---

## 1. Checks before deploying

The site was developed on macOS, while Vercel builds on Linux. These checks looked for anything that works on the Mac but would break on Vercel.

| Check | How | Result |
|---|---|---|
| Production build | `npm run build` | Passed. 23 routes: 21 prebuilt, 2 run on demand (`/api/query`, `/api/status`). |
| Build from a fresh copy | `git clone` into an empty folder, then `npm ci` and `npm run build` with no environment variables, the way Vercel does it | Passed with no warnings. Nothing the build needs exists only on the Mac, and `package-lock.json` matches `package.json`. |
| Linux binaries in the lockfile | Searched `package-lock.json` for the `linux-x64` builds of `@next/swc`, `lightningcss` and `@tailwindcss/oxide` | All present. A lockfile made on a Mac without them causes the well-known Vercel error `Cannot find module '../lightningcss.linux-x64-gnu.node'`. |
| Upper/lower case in imports | A script checked every `import` path against the exact file names in git | No mismatches. macOS ignores case (`Shell.tsx` = `shell.tsx`); Linux doesn't. |
| Secrets in git | Searched for Google and OpenAI key patterns and filled-in `GEMINI_API_KEY=` lines | None. Only `.env.example` is tracked, and `.env*` and `.vercel` are in `.gitignore`. |
| Node.js version | Read the `engines` field of every package in the lockfile | **Problem:** `ai` and `@ai-sdk/*` need Node 22 or newer, but the docs said 20 and `package.json` had no `engines` field. Fixed in step 2. |
| Server code | Read `app/api/*`, `server/query-handler.ts` and `lib/site.ts` | Fine. The request time limit is `maxDuration = 30`, inside the free plan's limit. No server code reads local files, and no route forces the Edge runtime. |
| Site address | `lib/site.ts` | Uses `NEXT_PUBLIC_SITE_URL` if it's set, else Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, else `http://localhost:3000`. On Vercel it needs no setting. |
| Type check, lint, tests | `npm run check` | All passed: 49 test files, 328 tests. |

## 2. The fix: Node 22

Commit `b6ecec5`:

- `package.json` now has `"engines": { "node": ">=22" }`. Vercel reads this when choosing the Node version.
- README.md and docs/DEPLOY.md now say "Node.js 22 or newer" instead of 20.

`package-lock.json` was left unchanged. npm doesn't need the `engines` field in the lockfile, and regenerating it would have added unrelated entries. A test `npm ci --dry-run` passed.

## 3. Deploying

The Vercel CLI isn't installed on this machine, so it was run with `npx`.

1. **Log in:** `npx vercel login`. The terminal printed a one-time code, the owner approved it in the browser, and the CLI saved a login token on this machine. It logged in as `gruve-pruthvi`.
2. **Deploy:** `npx vercel deploy --prod --yes`. This:
   - created the Vercel project `kernel` and wrote the link to `.vercel/`, which git ignores;
   - uploaded the source;
   - had Vercel run `npm ci` and `next build` on its servers;
   - published the build at <https://kernel-hazel.vercel.app>.

No environment variables were set. This was intentional: without `GEMINI_API_KEY` the site uses local search for answers, and the site address comes from `VERCEL_PROJECT_PRODUCTION_URL`.

## 4. Checking the live site

Each address was requested with `curl`:

| Address | Result |
|---|---|
| `/`, `/shell`, `/shell?cmd=run%20atlas`, `/systems`, `/systems/atlas`, `/graph` | 200 |
| `/?cmd=man%20kernel` | 307 redirect to `/shell?cmd=man%20kernel` |
| `/api/status` | `{"ai":false}` |
| `POST /api/query` "which systems use RAG?" | Streams back an answer from local search (`"mode":"local"`) |
| `/opengraph-image` | 200, a PNG |
| `/sitemap.xml`, `/robots.txt` | Links use `https://kernel-hazel.vercel.app`, not `localhost` |
| `/resume.pdf`, `/icon.svg` | 200 |

The production address is public; Vercel's login wall only covers preview deployments. These checks were server-side only. The parts that run in the browser (boot menu, terminal, tour) haven't been checked on the live site.

## 5. Connecting GitHub for auto-deploys

1. `npx vercel git connect --yes` failed at first with `Failed to connect gruve-pruthvi/kernel to project`. GitHub only shows a repo to an outside service after that service's GitHub App is installed.
2. The owner installed the Vercel GitHub App at <https://github.com/apps/vercel/installations/new> on the `gruve-pruthvi` account, with access to the `kernel` repository only.
3. Running `npx vercel git connect --yes` again returned `Connected`.

From now on GitHub notifies Vercel of every push. The first push after this confirms the connection works.

---

## Day-to-day use

### Update the site

```bash
npm run check          # the same checks Vercel's build will hit
git add … && git commit -m "…"
gh auth switch --user gruve-pruthvi
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push
gh auth switch --user pruthvi-aifabrik
```

Vercel builds the push and publishes it in about a minute. This machine has two GitHub accounts, and git reads its login from the macOS Keychain, so a plain `git push` fails with `403`.

### Environment variables

| Name | When it takes effect | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Each request, but only after a redeploy | Turns on AI answers. Free key from <https://aistudio.google.com/apikey>. |
| `GEMINI_MODEL` | Each request, after a redeploy | Optional model override. Default `gemini-flash-latest`. |
| `NEXT_PUBLIC_SITE_URL` | **When the site is built** | The address used in share images, the sitemap and canonical links. Only needed for a custom domain. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | **When the site is built** | Turns on Plausible analytics. |

```bash
npx vercel env add GEMINI_API_KEY production   # asks for the value; keeps it out of shell history
npx vercel env ls                              # list what's set
npx vercel deploy --prod                       # redeploy so the change takes effect
```

Variables starting with `NEXT_PUBLIC_` are written into the site when it's built, so changing one always needs a redeploy.

### Useful CLI commands

| Command | Does |
|---|---|
| `npx vercel ls` | List recent deployments |
| `npx vercel inspect <deployment-url>` | Build details and status of one deployment |
| `npx vercel logs <deployment-url>` | Runtime logs, e.g. `[kernel] query model error:` from `/api/query` |
| `npx vercel rollback` | Put the previous production deployment back |
| `npx vercel promote <deployment-url>` | Make a specific deployment the production one |
| `npx vercel deploy --prod` | Deploy this folder directly, without going through GitHub |

## Known limits

- **The question limit is approximate.** `/api/query` allows 10 questions a minute and 60 a day per visitor, but the counts are kept in each function instance's memory (`core/ratelimit.ts`). Vercel can run several instances and restart them, so the limit applies per instance and resets on a restart. That's fine for a portfolio. A strict limit would need shared storage such as Upstash Redis.
- **The build downloads fonts.** `next/font/google` fetches Inter and JetBrains Mono during the build. That's fine on Vercel, but a build with no internet access would fail.
- **Other hosts:**
  - **Netlify:** works with its Next.js support.
  - **Cloudflare:** needs the OpenNext adapter.
  - **GitHub Pages and other static-only hosts:** won't work, because the site needs `/api/query` and the `/?cmd=` redirect.
  - **Your own server:** see docs/DEPLOY.md, and set `NEXT_PUBLIC_SITE_URL` before `npm run build`.
- **The repository is public.** Everything in `content/` and `public/resume.pdf` can be read on GitHub.

## Still to do

1. **Real content:** replace the samples in `content/` and `public/resume.pdf`, set `placeholder: false`, run `npm run check`, then push. The push redeploys the site.
2. **Gemini key:** `npx vercel env add GEMINI_API_KEY production`, then `npx vercel deploy --prod`. Afterwards `/api/status` should return `{"ai":true}`.
3. **Optional custom domain:** Vercel → Project → Settings → Domains. Then set `NEXT_PUBLIC_SITE_URL` to the domain and redeploy.
4. **Check the live site in a browser:** the boot menu, terminal and tour haven't been tested on it yet.
