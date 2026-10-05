import { isDir, normalise, resolve } from "../fs";
import { fail, fromLine, out, seg, type Command, type CommandResult, type Ctx } from "../registry";
import { styleLine } from "../style";
import type { Effect, OutputItem } from "../types";

type Read = { lines: string[] } | { error: CommandResult };

export function readFile(ctx: Ctx, path: string, name: string): Read {
  const node = resolve(ctx.fs, ctx.state.cwd, path);
  if (!node) return { error: fail(`${name}: ${path}: No such file or directory`) };
  if (isDir(node)) return { error: fail(`${name}: ${path}: Is a directory`, [seg("try ", "faint"), seg(`ls ${path}`, "accent", { run: `ls ${path}` })]) };
  if (node.kind === "view") return { error: fail(`${name}: ${path}: is a view`, [seg("try ", "faint"), seg(`open ${path}`, "accent", { run: `open ${path}` })]) };
  if (node.kind === "link") return { error: fail(`${name}: ${path}: binary file`, [seg("try ", "faint"), seg(`open ${path}`, "accent", { run: `open ${path}` })]) };
  return { lines: node.lines };
}

export function readSource(args: string[], ctx: Ctx, name: string, usage: string): Read {
  if (args[0]) return readFile(ctx, args[0], name);
  if (ctx.stdin) return { lines: ctx.stdin };
  return { error: fail(`${name}: missing file operand`, `usage: ${usage}`) };
}

const styled = (lines: string[]): OutputItem[] => lines.map((l) => fromLine(styleLine(l)));

const cat: Command = {
  name: "cat",
  group: "files",
  summary: "print files",
  usage: "cat <file…>",
  description: ["Prints one or more files. Reads from a pipe when given no file. Views open in the side pane."],
  examples: ["cat README.md", "cat systems/atlas/decisions.md", "cat about.md contact.txt"],
  seeAlso: ["less", "head", "grep"],
  run(args, _flags, ctx) {
    if (args.length === 0) {
      if (ctx.stdin) return { output: styled(ctx.stdin) };
      return fail("cat: missing file operand", `usage: ${this.usage}`);
    }
    const output: OutputItem[] = [];
    const effects: Effect[] = [];
    let exitCode: 0 | 1 = 0;
    for (const path of args) {
      const node = resolve(ctx.fs, ctx.state.cwd, path);
      if (node?.kind === "view") {
        effects.push({ type: "openView", view: node.view });
        output.push(out(seg(`opened ${path} in the view pane →`, "faint")));
      } else if (node?.kind === "link") {
        output.push(out(seg(`${node.name}  `), seg("download ↗", "link", { href: node.href })));
      } else {
        const r = readFile(ctx, path, "cat");
        if ("error" in r) {
          output.push(...(r.error.output ?? []));
          exitCode = 1;
        } else output.push(...styled(r.lines));
      }
    }
    return { output, effects, exitCode };
  },
};

const less: Command = {
  name: "less",
  group: "files",
  summary: "read a file in the side pane",
  usage: "less <file>",
  description: ["Opens a file in a scrollable reader beside the shell. Press Esc or q to close it."],
  examples: ["less README.md", "less systems/atlas/decisions.md"],
  seeAlso: ["cat", "open"],
  run(args, _flags, ctx) {
    if (args.length !== 1) return fail("less: missing file operand", `usage: ${this.usage}`);
    const [path] = args;
    const node = resolve(ctx.fs, ctx.state.cwd, path);
    if (node?.kind === "view") return { effects: [{ type: "openView", view: node.view }] };
    const r = readFile(ctx, path, "less");
    if ("error" in r) return r.error;
    return {
      effects: [{ type: "openView", view: { type: "reader", path: normalise(ctx.state.cwd, path) } }],
      output: [out(seg(`${path} — reading in the side pane (Esc closes)`, "faint"))],
    };
  },
};

function slice(name: "head" | "tail"): Command {
  return {
    name,
    group: "files",
    summary: name === "head" ? "first lines of a file" : "last lines of a file",
    usage: `${name} [-n N] [file]`,
    description: [`Prints the ${name === "head" ? "first" : "last"} N lines (default 10) of a file or of piped input.`],
    flags: { lines: { short: "n", value: true, placeholder: "N", describe: "number of lines" } },
    examples: [`${name} -n 5 README.md`, `grep -i agent . | ${name} -n 3`],
    seeAlso: [name === "head" ? "tail" : "head", "cat", "wc"],
    run(args, flags, ctx) {
      const n = flags.lines === undefined ? 10 : Number(flags.lines);
      if (!Number.isInteger(n) || n < 0) return fail(`${name}: -n needs a whole number`);
      const r = readSource(args, ctx, name, `${name} [-n N] [file]`);
      if ("error" in r) return r.error;
      const picked = name === "head" ? r.lines.slice(0, n) : n === 0 ? [] : r.lines.slice(-n);
      return { output: styled(picked) };
    },
  };
}

const wc: Command = {
  name: "wc",
  group: "files",
  summary: "count lines, words and characters",
  usage: "wc [-l] [file]",
  description: ["Counts lines, words and characters of a file or piped input."],
  flags: { lines: { short: "l", describe: "only count lines" } },
  examples: ["wc README.md", "grep -l rag . | wc -l"],
  seeAlso: ["head", "grep"],
  run(args, flags, ctx) {
    const r = readSource(args, ctx, "wc", this.usage);
    if ("error" in r) return r.error;
    const l = r.lines.length;
    const words = r.lines.join(" ").split(/\s+/).filter(Boolean).length;
    const chars = r.lines.join("\n").length;
    const suffix = args[0] ? ` ${args[0]}` : "";
    const counts = flags.lines ? `${l}` : `${String(l).padStart(4)} ${String(words).padStart(5)} ${String(chars).padStart(6)}`;
    return { output: [out(counts + suffix)] };
  },
};

const echo: Command = {
  name: "echo",
  group: "files",
  summary: "print text",
  usage: "echo <text…>",
  description: ["Prints its arguments separated by single spaces."],
  examples: ["echo hello kernel"],
  seeAlso: ["cat"],
  run(args) {
    return { output: [out(args.join(" "))] };
  },
};

export const textCommands = [cat, less, slice("head"), slice("tail"), wc, echo];
