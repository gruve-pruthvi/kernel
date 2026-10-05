import { isDir, joinPath, normalise, pathOf, resolve, type DirNode, type FsNode } from "../fs";
import { blank, entrySeg, fail, out, seg, type Command } from "../registry";
import type { OutputItem } from "../types";

const KIND: Record<FsNode["kind"], string> = { dir: "d", system: "s", file: "-", view: "v", link: "l" };
const size = (n: FsNode) => (isDir(n) ? n.children.length : n.kind === "file" ? n.lines.length : 0);

const ls: Command = {
  name: "ls",
  group: "navigation",
  summary: "list directory contents",
  usage: "ls [-l] [path…]",
  description: [
    "Lists files and directories. Directories end in /, views (open in the side pane) end in *, links end in @.",
    "Everything listed is clickable.",
  ],
  flags: { long: { short: "l", describe: "long format: kind, size (entries or lines), name" } },
  examples: ["ls", "ls systems", "ls -l systems/atlas"],
  seeAlso: ["cd", "tree", "find"],
  run(args, flags, ctx) {
    const targets = args.length ? args : ["."];
    const output: OutputItem[] = [];
    let exitCode: 0 | 1 = 0;
    targets.forEach((t, idx) => {
      const node = resolve(ctx.fs, ctx.state.cwd, t);
      if (!node) {
        output.push(out(seg(`ls: cannot access '${t}': No such file or directory`, "error")));
        exitCode = 1;
        return;
      }
      if (targets.length > 1) {
        if (idx > 0) output.push(blank());
        output.push(out(seg(`${t}:`, "faint")));
      }
      if (!isDir(node)) {
        output.push(out(entrySeg(node, t)));
        return;
      }
      if (flags.long) {
        for (const c of node.children) {
          output.push(out(seg(`${KIND[c.kind]}  ${String(size(c)).padStart(4)}  `, "faint"), entrySeg(c, joinPath(t, c.name))));
        }
      } else {
        output.push({ line: node.children.flatMap((c, i) => [...(i ? [seg("   ")] : []), entrySeg(c, joinPath(t, c.name))]) });
      }
    });
    return { output, exitCode };
  },
};

const cd: Command = {
  name: "cd",
  group: "navigation",
  summary: "change the working directory",
  usage: "cd [path | -]",
  description: ["Moves into a directory. With no path, returns home (~). `cd -` returns to the previous directory."],
  examples: ["cd systems/atlas", "cd ..", "cd -"],
  seeAlso: ["ls", "pwd"],
  run(args, _flags, ctx) {
    if (args.length > 1) return fail("cd: too many arguments");
    const target = args[0] ?? "~";
    if (target === "-") {
      return { state: { cwd: ctx.state.prevCwd, prevCwd: ctx.state.cwd }, output: [out(seg(pathOf(ctx.state.prevCwd), "dir"))] };
    }
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`cd: no such file or directory: ${target}`);
    if (!isDir(node)) return fail(`cd: not a directory: ${target}`);
    return { state: { cwd: normalise(ctx.state.cwd, target), prevCwd: ctx.state.cwd } };
  },
};

const pwd: Command = {
  name: "pwd",
  group: "navigation",
  summary: "print the working directory",
  usage: "pwd",
  description: ["Prints where you are in the filesystem."],
  examples: ["pwd"],
  seeAlso: ["cd"],
  run(_args, _flags, ctx) {
    return { output: [out(seg(pathOf(ctx.state.cwd), "dir"))] };
  },
};

const tree: Command = {
  name: "tree",
  group: "navigation",
  summary: "show the filesystem as a tree",
  usage: "tree [-L n] [path]",
  description: ["Draws the directory structure. This is the whole portfolio's information architecture."],
  flags: { level: { short: "L", value: true, placeholder: "n", describe: "descend at most n levels" } },
  examples: ["tree", "tree -L 1", "tree systems/atlas"],
  seeAlso: ["ls", "find"],
  run(args, flags, ctx) {
    const level = flags.level === undefined ? Infinity : Number(flags.level);
    if (!(level === Infinity || (Number.isInteger(level) && level >= 1))) return fail("tree: -L needs a positive whole number");
    const target = args[0] ?? ".";
    const node = resolve(ctx.fs, ctx.state.cwd, target);
    if (!node) return fail(`tree: ${target}: No such file or directory`);
    if (!isDir(node)) return { output: [out(entrySeg(node, target))] };

    const output: OutputItem[] = [out(seg(target === "." ? pathOf(ctx.state.cwd) : target, "dir"))];
    let dirs = 0;
    let files = 0;
    const draw = (d: DirNode, prefix: string, depth: number, base: string) => {
      d.children.forEach((c, i) => {
        const last = i === d.children.length - 1;
        const path = joinPath(base, c.name);
        output.push(out(seg(prefix + (last ? "└── " : "├── "), "faint"), entrySeg(c, path)));
        if (isDir(c)) {
          dirs++;
          if (depth < level) draw(c, prefix + (last ? "    " : "│   "), depth + 1, path);
        } else files++;
      });
    };
    draw(node, "", 1, target);
    output.push(blank(), out(seg(`${dirs} directories, ${files} files`, "faint")));
    return { output };
  },
};

export const navCommands = [ls, cd, pwd, tree];
