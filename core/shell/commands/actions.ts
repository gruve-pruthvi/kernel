import { buildGraph, neighbours, resolveFocus } from "../../graph";
import { normalise, resolve } from "../fs";
import { fail, out, seg, type Command } from "../registry";
import { nearest } from "../util";

export const GUI_PAGES = ["systems", "graph", "trace", "human", "connect"] as const;
const PAGE_ALIASES: Record<string, string> = { contact: "connect", career: "trace", about: "human" };

const open: Command = {
  name: "open",
  group: "actions",
  summary: "open something in the side pane or the visual site",
  usage: "open <system | graph | resume | page | path>",
  description: [
    "Opens a system's architecture, the skill graph or a file in the side pane; a page (trace, human, contact) in the visual site; or downloads the resume.",
  ],
  flags: { full: { describe: "for a system, open the full visual case study instead of the side pane" } },
  examples: ["open atlas", "open atlas --full", "open graph", "open resume", "open trace"],
  seeAlso: ["less", "gui", "graph"],
  run(args, flags, ctx) {
    const target = args[0];
    if (!target) return fail("open: missing target", `usage: ${this.usage}`);
    const t = target.toLowerCase().replace(/\/+$/, "");
    if (ctx.p.systems.some((s) => s.slug === t)) {
      return flags.full
        ? { effects: [{ type: "navigate", href: `/systems/${t}` }] }
        : { effects: [{ type: "openView", view: { type: "architecture", slug: t } }] };
    }
    if (t === "graph") return { effects: [{ type: "openView", view: { type: "graph", focus: [] } }] };
    if (t === "resume" || t === "resume.pdf") {
      const href = ctx.p.identity.links.resume;
      return href ? { effects: [{ type: "download", href }] } : fail("open: no resume published");
    }
    const page = PAGE_ALIASES[t] ?? t;
    const isPage = (GUI_PAGES as readonly string[]).includes(page) && page !== "graph";
    const local = resolve(ctx.fs, ctx.state.cwd, target);
    // A page name wins unless the user is inside a directory where that name is a real entry.
    if (isPage && (!local || ctx.state.cwd.length === 0)) return { effects: [{ type: "navigate", href: `/${page}` }] };
    const node = local;
    if (!node) return fail(`open: cannot find "${target}"`);
    if (node.kind === "view") return { effects: [{ type: "openView", view: node.view }] };
    if (node.kind === "link") return { effects: [{ type: "download", href: node.href }] };
    if (node.kind === "file") return { effects: [{ type: "openView", view: { type: "reader", path: normalise(ctx.state.cwd, target) } }] };
    return fail(`open: ${target} is a directory`, [seg("try ", "faint"), seg(`cd ${target}`, "accent", { run: `cd ${target}` })]);
  },
};

const runCmd: Command = {
  name: "run",
  aliases: ["simulate"],
  group: "actions",
  summary: "stream a simulated request through a system",
  usage: "run [system]",
  description: [
    "Plays a system's documented request walkthrough step by step, lighting up each component in the architecture pane.",
    "Inside ~/systems/<name>, `run` uses that system. This is a simulation of documented behaviour, not live infrastructure.",
  ],
  examples: ["run atlas", "cd systems/relay; run"],
  seeAlso: ["open", "man"],
  run(args, _flags, ctx) {
    const cwd = ctx.state.cwd;
    const slug = (args[0] ?? (cwd[0] === "systems" ? cwd[1] : undefined))?.toLowerCase().replace(/\/+$/, "");
    const runnable = ctx.p.systems.filter((s) => s.simulation);
    if (!slug) {
      return fail("run: which system?", runnable.flatMap((s, i) => [...(i ? [seg("  ")] : []), seg(`run ${s.slug}`, "accent", { run: `run ${s.slug}` })]));
    }
    const system = ctx.p.systems.find((s) => s.slug === slug);
    if (!system) {
      const near = nearest(slug, ctx.p.systems.map((s) => s.slug));
      return fail(`run: no system "${slug}"`, near ? [seg("did you mean ", "faint"), seg(`run ${near}`, "accent", { run: `run ${near}` })] : "try ls ~/systems");
    }
    if (!system.simulation) return fail(`run: ${system.name} has no simulation yet`, [seg("try ", "faint"), seg(`open ${slug}`, "accent", { run: `open ${slug}` })]);
    return { effects: [{ type: "simulate", slug }] };
  },
};

const graph: Command = {
  name: "graph",
  group: "actions",
  summary: "show the skill graph, optionally focused",
  usage: "graph [--depth n] [node…]",
  description: [
    "Opens the engineering graph in the side pane, focused on systems, capabilities or technologies by id or name.",
    "--depth expands the focus by that many hops (1–3).",
  ],
  flags: { depth: { value: true, placeholder: "n", describe: "also highlight neighbours up to n hops away (1–3)" } },
  examples: ["graph", "graph langgraph", "graph --depth 2 atlas"],
  seeAlso: ["open", "which"],
  run(args, flags, ctx) {
    const g = buildGraph(ctx.p);
    let focus = resolveFocus(g, args.join(","));
    if (args.length && focus.length === 0) return fail(`graph: nothing matches "${args.join(" ")}"`);
    if (flags.depth !== undefined) {
      const depth = Number(flags.depth);
      if (![1, 2, 3].includes(depth)) return fail("graph: --depth must be 1, 2 or 3");
      if (focus.length === 0) return fail("graph: --depth needs a node");
      const seen = new Set(focus);
      let frontier = [...focus];
      for (let i = 0; i < depth; i++) {
        frontier = frontier.flatMap((id) => [...neighbours(g, id)]).filter((id) => !seen.has(id));
        frontier.forEach((id) => seen.add(id));
      }
      focus = [...seen];
    }
    return { effects: [{ type: "openView", view: { type: "graph", focus } }] };
  },
};

const gui: Command = {
  name: "gui",
  group: "actions",
  summary: "switch to the visual site",
  usage: "gui [systems | graph | trace | human | connect]",
  description: ["Opens a page of the visual (non-terminal) site. Type `>_ shell` there, or press ⌘K, to come back."],
  examples: ["gui", "gui trace"],
  seeAlso: ["open", "recruiter"],
  run(args) {
    const page = PAGE_ALIASES[args[0]?.toLowerCase() ?? ""] ?? args[0]?.toLowerCase() ?? "systems";
    if (!(GUI_PAGES as readonly string[]).includes(page)) return fail(`gui: no page ${args[0]}`, `pages: ${GUI_PAGES.join(", ")}`);
    return { effects: [{ type: "navigate", href: `/${page}` }] };
  },
};

const recruiter: Command = {
  name: "recruiter",
  group: "actions",
  summary: "one-screen summary in the visual site",
  usage: "recruiter",
  description: ["Turns on recruiter mode (a fast, motion-free summary) and opens the visual site."],
  examples: ["recruiter"],
  seeAlso: ["resume", "gui"],
  run() {
    return { effects: [{ type: "recruiter", on: true }, { type: "navigate", href: "/systems" }] };
  },
};

const clear: Command = {
  name: "clear",
  group: "actions",
  summary: "clear the screen",
  usage: "clear",
  description: ["Clears the transcript. Ctrl+L does the same."],
  examples: ["clear"],
  seeAlso: ["history"],
  run() {
    return { effects: [{ type: "clear" }] };
  },
};

const sudo: Command = {
  name: "sudo",
  group: "actions",
  summary: "elevated privileges (one use only)",
  usage: "sudo hire",
  description: ["There is exactly one privileged operation."],
  examples: ["sudo hire"],
  seeAlso: ["resume"],
  run(args, _flags, ctx) {
    if (args[0] !== "hire") return fail("sudo: permission denied — only `sudo hire` is allowed");
    const email = ctx.p.identity.links.email;
    return {
      output: [
        out(seg("[sudo] checking requirements…", "faint")),
        out(seg("  ✓ ", "ok"), seg(`${ctx.p.systems.length} systems documented`)),
        out(seg("  ✓ ", "ok"), seg(`${ctx.p.capabilities.length} capabilities with evidence`)),
        out(seg("candidate approved → ", "accent"), seg(email, "link", { href: `mailto:${email}` })),
      ],
    };
  },
};

const exit: Command = {
  name: "exit",
  aliases: ["logout"],
  group: "actions",
  summary: "leave the shell",
  usage: "exit",
  description: ["There is no exit — but there is a visual site."],
  examples: ["exit"],
  seeAlso: ["gui"],
  run() {
    return { output: [out(seg("logout? there's no escape — try ", "faint"), seg("gui", "accent", { run: "gui" }))] };
  },
};

export const actionCommands = [open, runCmd, graph, gui, recruiter, clear, sudo, exit];
