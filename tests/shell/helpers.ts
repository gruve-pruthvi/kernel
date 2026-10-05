import { portfolio } from "@/core/content";
import { execute, initialState } from "@/core/shell/execute";
import type { OutputItem, Result, ShellState } from "@/core/shell/types";

export const NOW = 1_760_000_000_000;

export function textOf(items: OutputItem[]): string {
  return items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : "[neofetch]")).join("\n");
}

export function run(input: string, cwd: string[] = [], state?: ShellState) {
  const res = execute(input, state ?? { ...initialState(NOW), cwd }, portfolio, NOW);
  return { res, text: textOf(res.output) };
}

export function seq(...inputs: string[]): Result {
  let state = initialState(NOW);
  let res: Result | undefined;
  for (const input of inputs) {
    res = execute(input, state, portfolio, NOW);
    state = res.state;
  }
  return res!;
}
