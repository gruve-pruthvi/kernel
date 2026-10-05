<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Kernel project rules

- Spec: `docs/superpowers/specs/2026-10-05-kernel-design.md`. Plan: `docs/superpowers/plans/2026-10-05-kernel.md`.
- Facts live only in `content/`. Never invent portfolio facts or metrics in code or prompts.
- `core/` is pure TypeScript (no React, no `next/*`) and must stay covered by `tests/`.
- Components read data through `core/content` selectors, never directly from `content/`.
- Use design tokens (`bg-surface`, `text-muted`, `text-accent`, …); do not add new colours.
- Every animation must respect reduced motion and Recruiter Mode (`useMotionAllowed`, `.motion-optional`).
- Run `npm test && npm run lint && npm run build` before committing.
