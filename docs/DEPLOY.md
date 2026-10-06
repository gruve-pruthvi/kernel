# Deploying Kernel

This guide puts the site online for free on [Vercel](https://vercel.com), the company behind Next.js. It takes about 15 minutes. Self-hosting is covered [at the end](#other-option-run-it-on-your-own-server).

## What you need

- The code on GitHub. It is already at `https://github.com/gruve-pruthvi/kernel`.
- A free Vercel account. Sign up with GitHub so Vercel can see your repositories.
- Optional, for AI answers: a free Gemini API key from <https://aistudio.google.com/apikey>.

---

## Step 1: Check the project builds

Run this on your computer from the project folder:

```bash
npm run check
```

It runs the type check, lint, tests and a production build. **Everything must pass.** If this fails, Vercel's build will fail the same way. If you changed anything, commit it and push it to GitHub.

> **Two GitHub accounts on this machine?** A push that fails with `403` means the wrong account is active. Switch, push, then switch back:
> ```bash
> gh auth switch --user gruve-pruthvi && git push && gh auth switch --user pruthvi-aifabrik
> ```

## Step 2: Import the project on Vercel

1. Go to <https://vercel.com/new>.
2. Find **kernel** in the list and click **Import**.

   If it isn't listed, click **Adjust GitHub App Permissions**, give Vercel access to the `gruve-pruthvi/kernel` repository, and return to the list.
3. Leave the build settings as they are. Vercel detects Next.js automatically.

## Step 3: Add the environment variables

On the same import screen, open **Environment Variables** and add:

| Name | Value | Needed? |
|---|---|---|
| `GEMINI_API_KEY` | Your Gemini key | Recommended. Without it, questions use local search instead of AI. |
| `NEXT_PUBLIC_SITE_URL` | The site's public address, e.g. `https://kernel-xyz.vercel.app` | Recommended. Used for share previews, the sitemap and canonical links. |
| `GEMINI_MODEL` | A Gemini model name | Optional. Defaults to `gemini-flash-latest`. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Your domain, e.g. `kernel-xyz.vercel.app` | Optional. Turns on [Plausible](https://plausible.io) analytics. |

You won't know the `.vercel.app` address before the first deploy, and that's fine. Leave `NEXT_PUBLIC_SITE_URL` empty for now: the site falls back to Vercel's production address on its own. You can set it properly in Step 5.

Click **Deploy** and wait about 1–2 minutes for the build to finish.

## Step 4: Check it works

Open your new `https://….vercel.app` address and go through this list:

| Visit | You should see |
|---|---|
| `/` | The boot menu, then the recruiter view |
| `/shell` | The terminal |
| `/shell?cmd=run%20atlas` | The shell runs `run atlas` by itself |
| `/?cmd=man%20kernel` | Redirects to `/shell` and shows the manual |
| `/systems` | The list of projects |
| `/api/status` | `{"ai":true}` (or `false` if you skipped the Gemini key) |
| `/opengraph-image` | The share-preview image |
| `/sitemap.xml` | A list of the site's pages |

Finally, ask a question in the shell, such as `ask which systems use RAG?`. With a key set, the status bar reads `ai:online`.

## Step 5: Set the final address (and a custom domain if you have one)

1. **Optional custom domain:** in Vercel go to **Project → Settings → Domains**, add the domain, and follow the DNS instructions Vercel shows.
2. In **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` to the final address, either the custom domain or the `.vercel.app` one.
3. Go to **Deployments**, open the latest one, click **⋯ → Redeploy**, and wait for it to finish.

> **Why redeploy?** Variables starting with `NEXT_PUBLIC_` are baked into the site when it's built. After changing any variable, redeploy or the change won't show up.

---

## Updating the site later

Push to the `main` branch. Vercel rebuilds and publishes the site automatically, so there are no extra steps.

Pushes to other branches get their own **preview** address, which is handy for checking a change before merging it.

## Troubleshooting

| Problem | Fix |
|---|---|
| The build fails on Vercel | Run `npm run check` locally. It shows the same error, and invalid content is the usual cause. |
| Answers say "offline mode" | `GEMINI_API_KEY` is missing or wrong. Fix it in Settings → Environment Variables, then redeploy. |
| Share previews show `localhost` | Set `NEXT_PUBLIC_SITE_URL`, then redeploy. |
| `git push` returns `403` | The wrong GitHub account is active. See the note in Step 1. |
| The boot menu shows on every visit | That's intended. Use `/?mode=human` or `/?mode=shell` for links that skip it. |

## Keep in mind

- **The repository is public.** Anyone can read the code and the content in it, including `public/resume.pdf`. If you'd rather keep it private, go to GitHub → **Settings → General → Danger Zone → Change visibility**. Vercel deploys private repositories just as well.
- **Never commit `.env.local`.** It is already in `.gitignore`. Keys belong only in Vercel's Environment Variables screen.
- The free Gemini tier has usage limits. If they're reached, questions fall back to local search answers instead of failing.

---

## Other option: run it on your own server

The site runs on any machine with Node.js 20 or newer:

```bash
npm ci
npm run build
GEMINI_API_KEY=… NEXT_PUBLIC_SITE_URL=https://your-domain npm start   # serves on port 3000
```

Set `NEXT_PUBLIC_SITE_URL` before `npm run build` too, because it's baked in at build time. Put a reverse proxy such as Nginx or Caddy in front for HTTPS.
