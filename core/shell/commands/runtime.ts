import { buildGraph } from "../../graph";
import { indexSize } from "../../search";
import { isDir, pathOf, walk } from "../fs";
import { blank, out, seg, type Command, type Ctx } from "../registry";
import type { Tone } from "../types";
import { hhmm } from "../util";

export const KERNEL_VERSION = "1.0";

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function counts(ctx: Ctx) {
  const entries = walk(ctx.fs, []).slice(1);
  const g = buildGraph(ctx.p);
  return {
    dirs: entries.filter((e) => isDir(e.node)).length,
    files: entries.filter((e) => !isDir(e.node)).length,
    nodes: g.nodes.length,
    edges: g.edges.length,
    docs: indexSize(ctx.p),
  };
}

const AI_STATE: Record<Ctx["env"]["ai"], { state: string; tone: Tone; detail: string }> = {
  online: { state: "ONLINE", tone: "ok", detail: "gemini configured" },
  offline: { state: "OFFLINE", tone: "warn", detail: "no key — local search answers" },
  unknown: { state: "UNKNOWN", tone: "faint", detail: "not checked yet" },
};

const status: Command = {
  name: "status",
  group: "info",
  summary: "kernel subsystem status",
  usage: "status",
  description: ["Shows each Kernel subsystem and what it has loaded — all from real runtime state."],
  examples: ["status"],
  seeAlso: ["ps", "top", "env"],
  run(_args, _flags, ctx) {
    const c = counts(ctx);
    const ai = AI_STATE[ctx.env.ai];
    const rows: [string, string, Tone, string][] = [
      ["portfolio", "READY", "ok", `${ctx.p.systems.length} systems · ${ctx.p.capabilities.length} capabilities · ${ctx.p.technologies.length} technologies`],
      ["filesystem", "READY", "ok", `${c.dirs} directories · ${c.files} files`],
      ["graph", "READY", "ok", `${c.nodes} nodes · ${c.edges} edges`],
      ["search", "READY", "ok", `${c.docs} documents indexed`],
      ["query", ai.state, ai.tone, ai.detail],
      ["session", "READY", "ok", `up ${formatDuration(ctx.now - ctx.state.sessionStart)} · ${ctx.state.stats.commands} commands`],
    ];
    return {
      output: [
        out(seg("KERNEL STATUS", "heading")),
        blank(),
        ...rows.map(([name, state, tone, detail]) => out(seg(name.padEnd(12)), seg(state.padEnd(10), tone), seg(detail, "muted"))),
      ],
    };
  },
};

const ps: Command = {
  name: "ps",
  group: "info",
  summary: "kernel modules as processes",
  usage: "ps",
  description: ["Lists Kernel's modules and what each holds. PIDs are stable indexes; there is no CPU or memory column because there is nothing real to show."],
  examples: ["ps"],
  seeAlso: ["status", "top"],
  run(_args, _flags, ctx) {
    const c = counts(ctx);
    const ai = ctx.env.ai;
    const rows: [string, string, string][] = [
      ["shell", "running", `${ctx.commands.length} commands`],
      ["fs", "running", `${c.dirs} dirs, ${c.files} files`],
      ["graph", "running", `${c.nodes} nodes`],
      ["search", "running", `${c.docs} docs`],
      ["query", ai, ai === "online" ? "gemini" : ai === "offline" ? "local search" : "—"],
      ["renderer", ctx.env.pane ? "running" : "idle", ctx.env.pane ? `pane: ${ctx.env.pane}` : "no pane"],
    ];
    return {
      output: [
        out(seg("  PID  NAME        STATE     DETAIL", "heading")),
        ...rows.map(([name, state, detail], i) =>
          out(seg(`  ${String(i + 1).padStart(3)}  `, "faint"), seg(name.padEnd(12), "accent"), seg(state.padEnd(10), state === "offline" ? "warn" : "ok"), seg(detail, "muted")),
        ),
      ],
    };
  },
};

const top: Command = {
  name: "top",
  group: "info",
  summary: "this session at a glance",
  usage: "top",
  description: ["A snapshot of this session: uptime, commands run, simulations played and your most-used commands."],
  examples: ["top"],
  seeAlso: ["history", "status"],
  run(_args, _flags, ctx) {
    const session = ctx.state.history.filter((h) => h.at >= ctx.state.sessionStart);
    const freq = new Map<string, number>();
    for (const h of session) {
      const name = h.command.trim().split(/\s+/)[0]?.toLowerCase();
      if (name) freq.set(name, (freq.get(name) ?? 0) + 1);
    }
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    return {
      output: [
        out(seg(`kernel — up ${formatDuration(ctx.now - ctx.state.sessionStart)}`, "accent"), seg(` · session started ${hhmm(ctx.state.sessionStart)}`, "faint")),
        out(seg("commands    ", "faint"), seg(`${session.length} this session · history ${ctx.state.history.length}`)),
        out(seg("simulations ", "faint"), seg(String(ctx.state.stats.simulations))),
        out(seg("pane        ", "faint"), seg(ctx.env.pane ?? "none")),
        blank(),
        out(seg("TOP COMMANDS (this session)", "faint")),
        ...(ranked.length
          ? ranked.map(([name, n]) => out(seg(`  ${name.padEnd(10)}`, "accent", { run: name }), seg("█".repeat(Math.min(n, 20)), "accent"), seg(` ${n}`, "muted")))
          : [out(seg("  (none yet)", "faint"))]),
      ],
    };
  },
};

const env: Command = {
  name: "env",
  group: "info",
  summary: "public kernel configuration",
  usage: "env",
  description: ["Prints Kernel's public configuration. Secrets are never part of the environment shown here."],
  examples: ["env", "env | grep AI"],
  seeAlso: ["status"],
  run(_args, _flags, ctx) {
    const vars: [string, string][] = [
      ["KERNEL_VERSION", KERNEL_VERSION],
      ["CWD", pathOf(ctx.state.cwd)],
      ["THEME", ctx.env.theme],
      ["MOTION", ctx.env.motion],
      ["MODE", ctx.env.mode],
      ["SURFACE", ctx.env.surface],
      ["AI", ctx.env.ai],
      ["HISTSIZE", String(ctx.state.history.length)],
      ["SESSION_START", hhmm(ctx.state.sessionStart)],
    ];
    return { output: vars.map(([k, v]) => out(seg(k, "accent"), seg("=", "faint"), seg(v))) };
  },
};

export const runtimeCommands = [status, ps, top, env];
