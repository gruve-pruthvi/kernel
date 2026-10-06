import { formatMonth, formatPeriod } from "../../format";
import type { Portfolio } from "../../schema";
import { blank, fail, out, seg, type Command } from "../registry";
import type { OutputItem } from "../types";
import { nearest } from "../util";

const GIT_USAGE = "git log [system] [--oneline] · git show <hash> · git branch";

type Entry = Portfolio["experience"][number]["commits"][number] & { branch: string; org: string; role: string };

function entries(p: Portfolio): Entry[] {
  return p.experience
    .flatMap((e) => e.commits.map((c) => ({ ...c, branch: e.branch, org: e.organisation, role: e.role })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function logEntry(c: Entry): OutputItem[] {
  return [
    out(seg("commit ", "warn"), seg(c.hash, "warn", { run: `git show ${c.hash}` }), seg(` (${c.branch})`, "dir")),
    out(seg("Org:    ", "faint"), seg(`${c.role} @ ${c.org}`)),
    out(seg("Date:   ", "faint"), seg(formatMonth(c.date))),
    blank(),
    out(`    ${c.message}`),
    ...(c.body ? [out(seg(`    ${c.body}`, "muted"))] : []),
    blank(),
  ];
}

const git: Command = {
  name: "git",
  group: "actions",
  summary: "career history as commits",
  usage: GIT_USAGE,
  description: [
    "Documented career milestones as git history. `git log` lists them (filter by system), `git show` prints one, `git branch` lists roles.",
    "Only documented milestones appear — nothing is generated.",
  ],
  flags: { oneline: { describe: "one line per commit" } },
  examples: ["git log", "git log atlas --oneline", "git show 7f3b", "git branch"],
  seeAlso: ["diff", "cat"],
  run(args, flags, ctx) {
    const [sub, target] = args;
    const all = entries(ctx.p);
    if (sub === "log") {
      if (target && !ctx.p.systems.some((s) => s.slug === target)) {
        const near = nearest(target, ctx.p.systems.map((s) => s.slug));
        return fail(`git log: no system "${target}"`, near ? [seg("did you mean ", "faint"), seg(`git log ${near}`, "accent", { run: `git log ${near}` })] : undefined);
      }
      const list = target ? all.filter((c) => c.systems?.includes(target)) : all;
      if (list.length === 0) return { output: [out(seg("no commits yet", "faint"))] };
      if (flags.oneline) {
        return {
          output: list.map((c) =>
            out(seg("* ", "accent"), seg(c.hash, "warn", { run: `git show ${c.hash}` }), seg(` (${c.branch}) `, "dir"), seg(c.message), seg(`  ${c.org}, ${formatMonth(c.date)}`, "faint")),
          ),
        };
      }
      const output = list.flatMap(logEntry);
      output.pop();
      return { output };
    }
    if (sub === "show") {
      if (!target) return fail("git show: missing revision", `usage: ${GIT_USAGE}`);
      const prefix = target.toLowerCase();
      if (prefix.length < 4) return fail("git show: hash prefix too short (use at least 4 characters)");
      const matches = all.filter((c) => c.hash.startsWith(prefix));
      if (matches.length === 0) return fail(`git show: unknown revision ${target}`);
      if (matches.length > 1) return fail(`git show: ${target} is ambiguous (${matches.map((m) => m.hash).join(", ")})`);
      const c = matches[0];
      const systems = (c.systems ?? []).map((slug) => ctx.p.systems.find((s) => s.slug === slug)).filter((s) => s !== undefined);
      const tech = (id: string) => ctx.p.technologies.find((t) => t.id === id)?.name ?? id;
      const output = logEntry(c);
      if (systems.length) {
        output.push(out(seg("Systems:", "faint")));
        for (const s of systems) {
          output.push(out(seg("  "), seg(s.name, "accent", { run: `open ${s.slug}` }), seg(`  ${s.technologies.map(tech).join(", ")}`, "muted")));
        }
      } else output.pop();
      return { output };
    }
    if (sub === "branch") {
      if (ctx.p.experience.length === 0) return { output: [out(seg("no branches yet", "faint"))] };
      return {
        output: [...ctx.p.experience]
          .sort((a, b) => b.start.localeCompare(a.start))
          .map((e) =>
            out(
              seg(e.end ? "  " : "* ", "accent"),
              seg(e.branch, e.end ? "dir" : "ok"),
              seg(`  ${formatPeriod(e.start, e.end)} · ${e.role} @ ${e.organisation}`, "faint"),
            ),
          ),
      };
    }
    return fail(`git: '${sub ?? ""}' is not available here`, `usage: ${GIT_USAGE}`);
  },
};

const diff: Command = {
  name: "diff",
  group: "search",
  summary: "compare two systems side by side",
  usage: "diff <system> <system>",
  description: ["Compares status, period, size and stack of two systems: = shared, - only in the first, + only in the second."],
  examples: ["diff atlas relay", "diff beacon ledger"],
  seeAlso: ["man", "graph", "git"],
  run(args, _flags, ctx) {
    if (args.length !== 2) return fail("diff: need two systems", `usage: ${this.usage}`);
    const [aSlug, bSlug] = args.map((x) => x.toLowerCase());
    if (aSlug === bSlug) return fail("diff: compare two different systems");
    const a = ctx.p.systems.find((s) => s.slug === aSlug);
    const b = ctx.p.systems.find((s) => s.slug === bSlug);
    if (!a) return fail(`diff: no system "${aSlug}"`);
    if (!b) return fail(`diff: no system "${bSlug}"`);
    const name = (kind: "technologies" | "capabilities", id: string) =>
      (kind === "technologies" ? ctx.p.technologies : ctx.p.capabilities).find((x) => x.id === id)?.name ?? id;
    const row = (label: string, va: string, vb: string) =>
      out(seg(label.padEnd(14), "faint"), seg(va.padEnd(22), va === vb ? "text" : "warn"), seg(vb, va === vb ? "text" : "warn"));
    const sets = (kind: "technologies" | "capabilities") => {
      const shared = a[kind].filter((x) => b[kind].includes(x)).map((x) => name(kind, x));
      const onlyA = a[kind].filter((x) => !b[kind].includes(x)).map((x) => name(kind, x));
      const onlyB = b[kind].filter((x) => !a[kind].includes(x)).map((x) => name(kind, x));
      return [
        out(seg(kind, "faint")),
        out(seg("  = ", "faint"), seg(shared.join(", ") || "—"), seg("   shared", "faint")),
        out(seg("  - ", "error"), seg(onlyA.join(", ") || "—"), seg(`   only ${a.slug}`, "faint")),
        out(seg("  + ", "ok"), seg(onlyB.join(", ") || "—"), seg(`   only ${b.slug}`, "faint")),
      ];
    };
    return {
      output: [
        out(seg("".padEnd(14)), seg(a.name.padEnd(22), "accent", { run: `open ${a.slug}` }), seg(b.name, "accent", { run: `open ${b.slug}` })),
        row("status", a.status, b.status),
        row("period", a.period ?? "—", b.period ?? "—"),
        row("category", a.category, b.category),
        row("components", String(a.architecture.nodes.length), String(b.architecture.nodes.length)),
        row("decisions", String(a.decisions.length), String(b.decisions.length)),
        row("simulation", a.simulation ? "yes" : "no", b.simulation ? "yes" : "no"),
        blank(),
        ...sets("technologies"),
        blank(),
        ...sets("capabilities"),
      ],
    };
  },
};

const benchmark: Command = {
  name: "benchmark",
  group: "info",
  summary: "published measurements for a system",
  usage: "benchmark <system>",
  description: ["Prints the measurements recorded in the system's content (`benchmarks`). Kernel never estimates or invents numbers."],
  examples: ["benchmark atlas"],
  seeAlso: ["man", "diff"],
  run(args, _flags, ctx) {
    const slug = args[0]?.toLowerCase();
    if (!slug) return fail("benchmark: missing system", `usage: ${this.usage}`);
    const s = ctx.p.systems.find((x) => x.slug === slug);
    if (!s) return fail(`benchmark: no system "${slug}"`);
    if (!s.benchmarks?.length) return fail(`benchmark: ${s.name} has no published measurements`, `add them to content/systems/${s.slug}.ts → benchmarks`);
    return {
      output: [
        out(seg("METRIC".padEnd(28), "faint"), seg("VALUE".padEnd(16), "faint"), seg("CONTEXT", "faint")),
        ...s.benchmarks.map((m) =>
          out(
            seg(m.metric.padEnd(28)),
            seg(`${m.value}${m.unit ? ` ${m.unit}` : ""}`.padEnd(16), "accent"),
            seg([m.context, m.measuredAt && formatMonth(m.measuredAt), m.source].filter(Boolean).join(" · "), "muted"),
          ),
        ),
      ],
    };
  },
};

export const introspectCommands = [git, diff, benchmark];
