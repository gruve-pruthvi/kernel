import { displayPath, isDir, joinPath, nodeText, normalise, pathOf, resolve, walk, type FsNode } from "../fs";
import { entrySeg, fail, out, seg, type Command } from "../registry";
import type { OutputItem, Seg } from "../types";
import { escapeRegExp, globToRegExp } from "../util";

function toRegExp(pattern: string, ignoreCase: boolean): RegExp {
  const flags = ignoreCase ? "gi" : "g";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return new RegExp(escapeRegExp(pattern), flags);
  }
}

export function highlight(text: string, re: RegExp): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))) {
    if (m[0] === "") continue;
    const at = m.index ?? 0;
    if (at > last) segs.push({ text: text.slice(last, at) });
    segs.push({ text: m[0], tone: "match" });
    last = at + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

const grep: Command = {
  name: "grep",
  group: "search",
  summary: "search file contents",
  usage: "grep [-i] [-n] [-l] [-v] <pattern> [path…]",
  description: [
    "Searches files for a pattern (a regular expression; invalid expressions are matched literally).",
    "Directories are searched recursively. With no path it searches piped input, or the current directory.",
  ],
  flags: {
    ignoreCase: { short: "i", describe: "ignore case" },
    lineNumber: { short: "n", describe: "show line numbers" },
    filesOnly: { short: "l", describe: "only list matching files" },
    invert: { short: "v", describe: "show non-matching lines" },
    recursive: { short: "r", describe: "accepted for familiarity; directories are always searched" },
  },
  examples: ["grep -i rag .", "grep -n Hybrid systems", "cat career.log | grep feat"],
  seeAlso: ["find", "whereis", "head"],
  run(args, flags, ctx) {
    const [pattern, ...paths] = args;
    if (pattern === undefined) return fail("grep: missing pattern", `usage: ${this.usage}`);
    const re = toRegExp(pattern, Boolean(flags.ignoreCase));
    const test = (line: string) => {
      re.lastIndex = 0;
      const hit = re.test(line);
      return flags.invert ? !hit : hit;
    };
    const render = (line: string): Seg[] => (flags.invert ? [{ text: line }] : highlight(line, re));
    const output: OutputItem[] = [];
    let matched = false;

    if (paths.length === 0 && ctx.stdin) {
      ctx.stdin.forEach((line, i) => {
        if (!test(line)) return;
        matched = true;
        output.push(out(...(flags.lineNumber ? [seg(String(i + 1), "ok"), seg(":", "faint")] : []), ...render(line)));
      });
      return { output, exitCode: matched ? 0 : 1 };
    }

    let exitCode: 0 | 1 = 0;
    for (const target of paths.length ? paths : ["."]) {
      const node = resolve(ctx.fs, ctx.state.cwd, target);
      if (!node) {
        output.push(out(seg(`grep: ${target}: No such file or directory`, "error")));
        exitCode = 1;
        continue;
      }
      for (const { node: f, parts } of walk(node, normalise(ctx.state.cwd, target))) {
        if (f.kind !== "file") continue;
        const hits = f.lines.map((line, i) => ({ line, i })).filter(({ line }) => test(line));
        if (hits.length === 0) continue;
        matched = true;
        const shown = displayPath(parts, ctx.state.cwd);
        const pathSeg = seg(shown, "link", { run: `less ${shown}` });
        if (flags.filesOnly) {
          output.push(out(pathSeg));
          continue;
        }
        for (const { line, i } of hits) {
          output.push(out(pathSeg, seg(":", "faint"), ...(flags.lineNumber ? [seg(String(i + 1), "ok"), seg(":", "faint")] : []), ...render(line)));
        }
      }
    }
    return { output, exitCode: matched && exitCode === 0 ? 0 : 1 };
  },
};

const TYPES: Record<string, (n: FsNode) => boolean> = {
  f: (n) => n.kind === "file",
  d: (n) => isDir(n),
  view: (n) => n.kind === "view",
  system: (n) => n.kind === "system",
  link: (n) => n.kind === "link",
};

const find: Command = {
  name: "find",
  group: "search",
  summary: "find files by name or kind",
  usage: "find [path] [-name glob] [-type f|d|view|system|link]",
  description: ["Walks the filesystem from a path (default .) and lists entries matching a name glob (* and ?) and/or a kind."],
  flags: {
    name: { value: true, singleDash: true, placeholder: "glob", describe: "match entry names, e.g. *.md" },
    type: { value: true, singleDash: true, placeholder: "kind", describe: "f, d, view, system or link" },
  },
  examples: ["find . -name *.md", "find systems -type system", "find -type view"],
  seeAlso: ["grep", "tree", "whereis"],
  run(args, flags, ctx) {
    const kind = flags.type as string | undefined;
    if (kind !== undefined && !TYPES[kind]) return fail("find: -type must be one of f, d, view, system, link");
    const target = args[0] ?? ".";
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`find: ${target}: No such file or directory`);
    const glob = typeof flags.name === "string" ? globToRegExp(flags.name) : null;
    const base = normalise(ctx.state.cwd, target);
    const output = walk(node, base)
      .filter(({ node: n }) => (!glob || glob.test(n.name)) && (!kind || TYPES[kind](n)))
      .map(({ node: n, parts }) => {
        const rel = parts.slice(base.length).join("/");
        const shown = rel ? joinPath(target, rel) : target;
        const click = entrySeg(n, shown);
        return out({ ...click, text: shown });
      });
    return { output, exitCode: output.length ? 0 : 1 };
  },
};

const which: Command = {
  name: "which",
  group: "search",
  summary: "locate a command, system, skill or technology",
  usage: "which <name…>",
  description: ["Shows whether a name is a builtin command, or where a system, capability or technology lives."],
  examples: ["which atlas", "which rag", "which grep"],
  seeAlso: ["whereis", "find"],
  run(args, _flags, ctx) {
    if (args.length === 0) return fail("which: missing name", `usage: ${this.usage}`);
    const output: OutputItem[] = [];
    let exitCode: 0 | 1 = 0;
    for (const name of args) {
      const n = name.toLowerCase();
      if (ctx.commands.some((c) => c.name === n || c.aliases?.includes(n))) output.push(out(`${n}: shell builtin`));
      else if (ctx.p.systems.some((s) => s.slug === n)) output.push(out(seg(`~/systems/${n}`, "dir", { run: `cd ~/systems/${n}` })));
      else if (ctx.p.capabilities.some((c) => c.id === n)) output.push(out(seg(`~/skills/${n}.md`, "text", { run: `cat ~/skills/${n}.md` })));
      else if (ctx.p.technologies.some((t) => t.id === n)) output.push(out(seg(`~/stack/${n}.txt`, "text", { run: `cat ~/stack/${n}.txt` })));
      else {
        output.push(out(seg(`which: no ${name} in kernel`, "error")));
        exitCode = 1;
      }
    }
    return { output, exitCode };
  },
};

const whereis: Command = {
  name: "whereis",
  group: "search",
  summary: "every file that mentions a term",
  usage: "whereis <term>",
  description: ["Lists every path whose name or content mentions the term (case-insensitive), with a count of matching lines."],
  examples: ["whereis kafka", "whereis agent"],
  seeAlso: ["grep", "which"],
  run(args, _flags, ctx) {
    const term = args.join(" ").toLowerCase();
    if (!term) return fail("whereis: missing term", `usage: ${this.usage}`);
    const hits = walk(ctx.fs, [])
      .slice(1)
      .map(({ node, parts }) => ({
        node,
        parts,
        count: nodeText(node).filter((l) => l.toLowerCase().includes(term)).length,
        named: node.name.toLowerCase().includes(term),
      }))
      .filter((h) => h.named || h.count > 0);
    if (hits.length === 0) return fail(`whereis: nothing mentions "${args.join(" ")}"`);
    return {
      output: [
        out(seg(`${args.join(" ")}:`, "accent")),
        ...hits.map((h) => {
          const path = pathOf(h.parts);
          const click = entrySeg(h.node, path);
          return out(seg("  "), { ...click, text: path }, ...(h.count ? [seg(`  (${h.count} line${h.count === 1 ? "" : "s"})`, "faint")] : []));
        }),
      ],
    };
  },
};

export const searchCommands = [grep, find, which, whereis];
