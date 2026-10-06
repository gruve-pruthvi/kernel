import { getRelatedSystemsFrom } from "./related";
import { deepLinkFor } from "../deeplink";
import { isDir, resolve } from "../fs";
import { blank, fail, fromLine, out, seg, type Command, type Ctx, type Group } from "../registry";
import type { OutputItem, Seg } from "../types";
import { hhmm, nearest } from "../util";
import { handleOf } from "../welcome";

const INDENT = "       ";
const h = (title: string) => out(seg(title, "heading"));
const body = (content: string | Seg[]) => (typeof content === "string" ? out(INDENT + content) : fromLine([seg(INDENT), ...content]));
const links = (names: string[], prefix: string) =>
  names.flatMap((n, i) => [...(i ? [seg(", ", "faint")] : []), seg(n, "link", { run: `${prefix}${n}` })]);

function commandPage(c: Command): OutputItem[] {
  const flags = Object.entries(c.flags ?? {});
  return [
    out(seg(`${c.name.toUpperCase()}(1)`, "accent"), seg("    Kernel Manual", "faint")),
    blank(),
    h("NAME"),
    body(`${c.name} — ${c.summary}`),
    blank(),
    h("SYNOPSIS"),
    body(c.usage),
    blank(),
    h("DESCRIPTION"),
    ...c.description.map((d) => body(d)),
    ...(flags.length
      ? [
          blank(),
          h("OPTIONS"),
          ...flags.map(([name, d]) =>
            body([
              seg(`${d.short ? `-${d.short}, ` : ""}${d.singleDash ? "-" : "--"}${name}${d.value ? ` <${d.placeholder ?? "value"}>` : ""}`, "accent"),
              seg(`   ${d.describe}`, "muted"),
            ]),
          ),
        ]
      : []),
    blank(),
    h("EXAMPLES"),
    ...c.examples.map((e) => body([seg(e, "accent", { run: e })])),
    blank(),
    h("SEE ALSO"),
    body(links(c.seeAlso, "man ")),
  ];
}

function systemPage(ctx: Ctx, slug: string): OutputItem[] {
  const s = ctx.p.systems.find((x) => x.slug === slug)!;
  const tech = (id: string) => ctx.p.technologies.find((t) => t.id === id)?.name ?? id;
  const dir = resolve(ctx.fs, [], `systems/${slug}`);
  const files = isDir(dir) ? dir.children.map((c) => c.name) : [];
  const related = getRelatedSystemsFrom(ctx.p, slug);
  const synopsis = [`cd ~/systems/${slug}`, ...(s.simulation ? [`run ${slug}`] : []), `open ${slug}`, `less ~/systems/${slug}/README.md`];
  return [
    out(seg(`${slug.toUpperCase()}(7)`, "accent"), seg("    Kernel Systems Manual", "faint")),
    blank(),
    h("NAME"),
    body(`${slug} — ${s.tagline}`),
    blank(),
    h("SYNOPSIS"),
    ...synopsis.map((cmd) => body([seg(cmd, "accent", { run: cmd })])),
    blank(),
    h("DESCRIPTION"),
    body(s.summary),
    body(s.problem),
    blank(),
    h("ROLE"),
    body(s.role),
    blank(),
    h("STACK"),
    body(s.technologies.map(tech).join(", ")),
    blank(),
    h("FILES"),
    ...files.map((f) => body([seg(`~/systems/${slug}/${f}`, "text", { run: f === "architecture" ? `open ${slug}` : `cat ~/systems/${slug}/${f}` })])),
    blank(),
    h("SEE ALSO"),
    body(related.length ? links(related, "man ") : [seg("man kernel", "link", { run: "man kernel" })]),
  ];
}

const GROUP_ORDER: Group[] = ["navigation", "files", "search", "info", "actions"];

function kernelPage(ctx: Ctx): OutputItem[] {
  return [
    out(seg("KERNEL(1)", "accent"), seg("    Kernel Manual", "faint")),
    blank(),
    h("NAME"),
    body("kernel — a portfolio operating system"),
    blank(),
    h("DESCRIPTION"),
    body("Every system, skill, technology and role is a file in this filesystem. Explore it like a shell —"),
    body("or type a question in plain English. Everything underlined is clickable."),
    blank(),
    h("COMMANDS"),
    ...GROUP_ORDER.flatMap((g) => {
      const cmds = ctx.commands.filter((c) => c.group === g);
      return cmds.length
        ? [body([seg(g.toUpperCase(), "faint")]), ...cmds.map((c) => body([seg(c.name.padEnd(10), "accent", { run: `man ${c.name}` }), seg(c.summary, "muted")]))]
        : [];
    }),
    blank(),
    h("FILES"),
    body("~/systems/<name>/   README.md · architecture · decisions.md · stack.txt …"),
    body("~/skills/           capabilities and the skill graph"),
    body("~/stack/            technologies"),
    body("~/career.log        experience · ~/about.md · ~/contact.txt"),
    blank(),
    h("SEE ALSO"),
    body(links(["help", ...ctx.p.systems.map((s) => s.slug)], "man ").map((x) => (x.run === "man help" ? { ...x, run: "help" } : x))),
  ];
}

const man: Command = {
  name: "man",
  group: "info",
  summary: "read the manual",
  usage: "man <command | system | kernel>",
  description: ["Shows the manual for a command, a system (generated from its content), or `man kernel` for the overview."],
  examples: ["man kernel", "man grep", "man atlas"],
  seeAlso: ["help", "kernel"],
  run(args, _flags, ctx) {
    const topic = args[0]?.toLowerCase();
    if (!topic) return fail("What manual page do you want?", [seg("try ", "faint"), seg("man kernel", "accent", { run: "man kernel" })]);
    if (topic === "kernel") return { output: kernelPage(ctx) };
    const cmd = ctx.commands.find((c) => c.name === topic || c.aliases?.includes(topic));
    if (cmd) return { output: commandPage(cmd) };
    if (ctx.p.systems.some((s) => s.slug === topic)) return { output: systemPage(ctx, topic) };
    const near = nearest(topic, [...ctx.commands.map((c) => c.name), ...ctx.p.systems.map((s) => s.slug), "kernel"]);
    return fail(`No manual entry for ${topic}`, near ? [seg("did you mean ", "faint"), seg(`man ${near}`, "accent", { run: `man ${near}` })] : "try man kernel");
  },
};

const TOPICS: Record<string, OutputItem[]> = {
  navigation: [
    h("NAVIGATION"),
    body([seg("ls [path]", "accent"), seg("      list a directory (click entries to open them)", "muted")]),
    body([seg("cd <path>", "accent"), seg("      move; cd .. up, cd - back, cd ~ home", "muted")]),
    body([seg("tree -L 2", "accent"), seg("      the whole structure", "muted")]),
    body([seg("pwd", "accent"), seg("            where am I", "muted")]),
  ],
  search: [
    h("SEARCH"),
    body([seg("grep -i rag .", "accent"), seg("           search every file", "muted")]),
    body([seg("find . -name *.md", "accent"), seg("       find by name or -type", "muted")]),
    body([seg("whereis kafka", "accent"), seg("           every file mentioning a term", "muted")]),
    body([seg("grep -i agent . | head -n 5", "accent"), seg(" pipes work", "muted")]),
  ],
  shortcuts: [
    h("SHORTCUTS"),
    body("Tab          complete · Tab again opens a menu, Tab / Shift+Tab cycle, Enter picks"),
    body("→ / End      accept the grey suggestion (your history first, then completion)"),
    body("↑ ↓          history · !! last command · !N command N"),
    body("Ctrl+R       search history"),
    body("Ctrl+A / E   start / end of line · Ctrl+U clear to start · Ctrl+W delete word"),
    body("Ctrl+C       cancel · Ctrl+L clear screen · Esc close the side pane"),
  ],
  links: [
    h("LINKS"),
    body("Any command can be shared as a link — it runs when the page opens:"),
    body([seg("/?cmd=man%20atlas", "accent")]),
    body([seg("/?cmd=run%20atlas", "accent")]),
    body("Separate several commands with ; (up to 5). In `history`, every ↗ is a link to that command."),
  ],
};

const help: Command = {
  name: "help",
  group: "info",
  summary: "list commands and help topics",
  usage: "help [navigation | search | shortcuts | links]",
  description: ["Lists every command by group, or explains a topic."],
  examples: ["help", "help shortcuts", "help links"],
  seeAlso: ["man"],
  run(args, _flags, ctx) {
    const topic = args[0]?.toLowerCase();
    if (topic) {
      const page = TOPICS[topic];
      return page ? { output: page } : fail(`help: no topic ${topic}`, `topics: ${Object.keys(TOPICS).join(", ")}`);
    }
    return {
      output: [
        out(seg("Type a command, click anything underlined, or just ask in plain English.", "muted")),
        ...GROUP_ORDER.flatMap((g) => {
          const cmds = ctx.commands.filter((c) => c.group === g);
          return cmds.length
            ? [blank(), out(seg(g.toUpperCase(), "faint")), ...cmds.map((c) => out(seg("  "), seg(c.name.padEnd(10), "accent", { run: `man ${c.name}` }), seg(c.summary, "muted")))]
            : [];
        }),
        blank(),
        out(seg("topics: ", "faint"), ...Object.keys(TOPICS).flatMap((t, i) => [...(i ? [seg(" · ", "faint")] : []), seg(`help ${t}`, "accent", { run: `help ${t}` })])),
      ],
    };
  },
};

const history: Command = {
  name: "history",
  group: "info",
  summary: "commands you have run",
  usage: "history [--session]",
  description: ["Lists previous commands (kept across visits). Click one to run it again; ↗ is a shareable link.", "Use !! or !N to repeat."],
  flags: { session: { describe: "only this visit, with times" } },
  examples: ["history", "history --session", "!!"],
  seeAlso: ["help"],
  run(_args, flags, ctx) {
    const entries = ctx.state.history.map((e, i) => ({ ...e, n: i + 1 }));
    const shown = flags.session ? entries.filter((e) => e.at >= ctx.state.sessionStart) : entries;
    return {
      output: shown.map((e) =>
        out(
          seg(`${String(e.n).padStart(4)}  `, "faint"),
          ...(flags.session ? [seg(`${hhmm(e.at)}  `, "faint")] : []),
          seg(e.command, "text", { run: e.command }),
          seg("  ↗", "faint", { href: deepLinkFor(e.command) }),
        ),
      ),
    };
  },
};

const whoami: Command = {
  name: "whoami",
  group: "info",
  summary: "who is behind this",
  usage: "whoami",
  description: ["Prints the system profile: role, systems, capabilities, stack and contact — all derived from content."],
  examples: ["whoami"],
  seeAlso: ["id", "resume"],
  run() {
    return { output: [{ block: { kind: "neofetch" } }] };
  },
};

const id: Command = {
  name: "id",
  group: "info",
  summary: "identity and capability groups",
  usage: "id",
  description: ["Prints the user handle and the capability groups they belong to."],
  examples: ["id"],
  seeAlso: ["whoami"],
  run(_args, _flags, ctx) {
    return { output: [out(seg(`uid=${handleOf(ctx.p)}`, "accent"), seg(" groups=", "faint"), seg(ctx.p.capabilities.map((c) => c.id).join(","), "text"))] };
  },
};

const resume: Command = {
  name: "resume",
  group: "info",
  summary: "recruiter summary",
  usage: "resume",
  description: ["A one-screen summary: role, availability, top systems with their headline impact, core stack and contact."],
  examples: ["resume", "export resume.pdf"],
  seeAlso: ["whoami", "export", "recruiter"],
  run(_args, _flags, ctx) {
    const { identity: me, systems, technologies } = ctx.p;
    const top = systems.filter((s) => s.featured).slice(0, 3);
    const stack = [...new Set(top.flatMap((s) => s.technologies))].slice(0, 10).map((t) => technologies.find((x) => x.id === t)?.name ?? t);
    return {
      output: [
        out(seg(me.name, "heading")),
        out(seg(me.role, "text"), ...(me.location ? [seg(` · ${me.location}`, "muted")] : [])),
        ...(me.availability ? [out(seg(me.availability, "ok"))] : []),
        blank(),
        out(seg("TOP SYSTEMS", "faint")),
        ...top.map((s) =>
          out(
            seg("  "),
            seg(s.name.padEnd(10), "accent", { run: `open ${s.slug}` }),
            seg(s.tagline, "text"),
            ...(s.impact?.[0] ? [seg(`  ${s.impact[0].value} ${s.impact[0].label}`, "ok")] : []),
          ),
        ),
        blank(),
        out(seg("CORE STACK  ", "faint"), seg(stack.join(" · "), "text")),
        out(seg("CONTACT     ", "faint"), seg(me.links.email, "link", { href: `mailto:${me.links.email}` })),
        ...(me.links.resume ? [blank(), out(seg("→ ", "faint"), seg("export resume.pdf", "accent", { run: "export resume.pdf" }))] : []),
      ],
    };
  },
};

const exportCmd: Command = {
  name: "export",
  group: "info",
  summary: "download the resume",
  usage: "export resume.pdf",
  description: ["Downloads the published resume PDF."],
  examples: ["export resume.pdf"],
  seeAlso: ["resume"],
  run(args, _flags, ctx) {
    if (args[0] !== "resume.pdf") return fail(`export: unknown target "${args[0] ?? ""}"`, `usage: ${this.usage}`);
    const href = ctx.p.identity.links.resume;
    if (!href) return fail("export: no resume published");
    return { effects: [{ type: "download", href }], output: [out(seg("downloading resume.pdf…", "faint"))] };
  },
};

const ask: Command = {
  name: "ask",
  group: "info",
  summary: "ask Kernel's AI about this portfolio",
  usage: "ask <question…>",
  description: [
    "Answers from this portfolio's content only (Gemini when configured, local search otherwise), then lists the related systems and the parts that match.",
    "You can also just type a question — `ask` is optional.",
  ],
  examples: ["ask what has been built with agents?", 'ask "how does atlas stay grounded?"'],
  seeAlso: ["grep", "man"],
  run(args) {
    const question = args.join(" ").trim();
    if (!question) return fail("ask: missing question", `usage: ${this.usage}`);
    return { effects: [{ type: "ask", question }] };
  },
};

export const infoCommands = [man, help, history, whoami, id, resume, exportCmd, ask];
