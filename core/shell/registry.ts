import type { Portfolio } from "../schema";
import type { DirNode, FsNode } from "./fs";
import type { FlagSpec, Flags } from "./parser";
import type { Effect, Line, OutputItem, RuntimeEnv, Seg, ShellState, Tone } from "./types";

export interface Ctx {
  p: Portfolio;
  fs: DirNode;
  state: ShellState;
  stdin: string[] | null;
  now: number;
  commands: Command[];
  env: RuntimeEnv;
}

export interface CommandResult {
  output?: OutputItem[];
  effects?: Effect[];
  state?: Partial<ShellState>;
  exitCode?: 0 | 1;
}

export type Group = "navigation" | "files" | "search" | "info" | "actions";

export interface Command {
  name: string;
  aliases?: string[];
  group: Group;
  summary: string;
  usage: string;
  description: string[];
  flags?: FlagSpec;
  examples: string[];
  seeAlso: string[];
  run(args: string[], flags: Flags, ctx: Ctx): CommandResult;
}

export const seg = (text: string, tone?: Tone, extra: Partial<Seg> = {}): Seg => ({ text, ...(tone ? { tone } : {}), ...extra });
export const out = (...parts: (Seg | string)[]): OutputItem => ({ line: parts.map((p) => (typeof p === "string" ? seg(p) : p)) });
export const fromLine = (line: Line): OutputItem => ({ line });
export const blank = (): OutputItem => ({ line: [] });

export function fail(message: string, hint?: Seg[] | string): CommandResult {
  const extra = hint === undefined ? [] : [typeof hint === "string" ? out(seg(hint, "faint")) : fromLine(hint)];
  return { output: [out(seg(message, "error")), ...extra], exitCode: 1 };
}

export const plainText = (items: OutputItem[]): string[] =>
  items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : ""));

/** Clickable segment for a filesystem entry; `path` is what the user would type. */
export function entrySeg(node: FsNode, path: string): Seg {
  switch (node.kind) {
    case "dir":
    case "system":
      return seg(`${node.name}/`, "dir", { run: `cd ${path}` });
    case "view":
      return seg(`${node.name}*`, "view", { run: `open ${path}` });
    case "link":
      return seg(`${node.name}@`, "link", { href: node.href });
    case "file":
      return seg(node.name, "text", { run: `cat ${path}` });
  }
}
