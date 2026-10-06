import type { Portfolio } from "../schema";
import { COMMANDS, commandNames, getCommand } from "./commands";
import { buildFs, resolve } from "./fs";
import { expandHistory, parse, parseFlags } from "./parser";
import { out, plainText, seg } from "./registry";
import { DEFAULT_ENV, type Effect, type HistoryEntry, type OutputItem, type Result, type RuntimeEnv, type ShellState } from "./types";
import { nearest } from "./util";

export const HISTORY_LIMIT = 200;

export function initialState(now: number, history: HistoryEntry[] = []): ShellState {
  return { cwd: [], prevCwd: [], history: history.slice(-HISTORY_LIMIT), sessionStart: now, stats: { commands: 0, simulations: 0 } };
}

const PROSE_WORD = /^[\p{L}\p{N}'’",.!?()/-]+$/u;

/**
 * Plain English goes to the AI. Decided on the raw line (apostrophes would otherwise open a quote):
 * - unknown first word followed by prose-like words, or anything ending in "?";
 * - a line starting with a command word only when it reads as a question (ends in "?", 3+ prose words).
 */
const QUESTION_WORDS = new Set([
  "what", "what's", "whats", "who", "who's", "whos", "why", "how", "where", "when", "which",
  "is", "are", "can", "could", "does", "do", "did", "tell", "show", "explain", "give", "list", "has", "have", "any",
]);

/** `isPath` lets the executor say whether an argument names a real file; without it only explicit paths count. */
export function isQuestion(line: string, isPath: (word: string) => boolean = () => false): boolean {
  if (/[|;]/.test(line)) return false;
  const words = line.trim().split(/\s+/);
  const first = words[0];
  if (first.toLowerCase() === "ask") return false;
  const prose = words.every((w) => PROSE_WORD.test(w)) && !words.slice(1).some((w) => w.startsWith("-"));
  const asked = /\?$/.test(line);
  if (getCommand(first)) return asked && words.length >= 3 && prose;
  // Path-like = explicit path, flag, glob, "." or an entry that really exists — not "node.js" or "ci/cd" in prose.
  const pathLike = words.slice(1).some((w) => w === "." || /^(\.{1,2}\/|~\/|\/)/.test(w) || w.includes("*") || w.startsWith("-") || isPath(w));
  const near = nearest(first, commandNames(), first.length <= 3 ? 1 : 2);
  if (!asked && pathLike && !QUESTION_WORDS.has(first.toLowerCase()) && near) return false;
  if (asked) return true;
  return words.length >= 2 && prose && /^[\p{L}][\p{L}'’]*$/u.test(first);
}

export function execute(
  input: string,
  state: ShellState,
  p: Portfolio,
  now = Date.now(),
  opts: { maxPipelines?: number; env?: RuntimeEnv } = {},
): Result {
  const trimmed = input.trim();
  if (!trimmed) return { output: [], effects: [], state, exitCode: 0 };

  const expansion = expandHistory(trimmed, state.history.map((h) => h.command));
  if (!expansion.ok) return { output: [out(seg(`kernel: ${expansion.error}`, "error"))], effects: [], state, exitCode: 1 };
  const line = expansion.line;

  const last = state.history[state.history.length - 1]?.command;
  let st: ShellState = {
    ...state,
    history: last === line ? state.history : [...state.history, { command: line, at: now }].slice(-HISTORY_LIMIT),
    stats: { ...state.stats, commands: state.stats.commands + 1 },
  };
  const output: OutputItem[] = expansion.expanded ? [out(seg(line, "faint"))] : [];
  const effects: Effect[] = [];

  const parsed = parse(line);
  if (!parsed.ok) return { output: [...output, out(seg(`kernel: ${parsed.error}`, "error"))], effects, state: st, exitCode: 1 };

  let pipelines = parsed.pipelines;
  let skipped = 0;
  if (opts.maxPipelines && pipelines.length > opts.maxPipelines) {
    skipped = pipelines.length - opts.maxPipelines;
    pipelines = pipelines.slice(0, opts.maxPipelines);
  }

  const fs = buildFs(p);
  if (isQuestion(line, (w) => resolve(fs, state.cwd, w) !== undefined)) return { output, effects: [{ type: "ask", question: line }], state: st, exitCode: 0 };

  let exitCode: 0 | 1 = 0;

  for (const pipeline of pipelines) {
    let stdin: string[] | null = null;
    for (let i = 0; i < pipeline.length; i++) {
      const stage = pipeline[i];
      const isLast = i === pipeline.length - 1;
      const cmd = getCommand(stage.name);
      if (!cmd) {
        const near = nearest(stage.name, commandNames());
        output.push(
          out(seg(`kernel: command not found: ${stage.name}`, "error")),
          out(
            ...(near ? [seg("did you mean ", "faint"), seg(near, "accent", { run: near }), seg(" · ", "faint")] : []),
            seg("or ask in plain English", "faint"),
          ),
        );
        exitCode = 1;
        break;
      }
      const flags = parseFlags(stage.argv, cmd.flags);
      if (!flags.ok) {
        output.push(out(seg(`${cmd.name}: ${flags.error}`, "error")), out(seg(`usage: ${cmd.usage}`, "faint")));
        exitCode = 1;
        break;
      }
      const res = cmd.run(flags.args, flags.flags, { p, fs, state: st, stdin, now, commands: COMMANDS, env: opts.env ?? DEFAULT_ENV });
      // Bash runs pipeline stages in subshells: only the final stage may change shell state.
      if (res.state && isLast) st = { ...st, ...res.state };
      exitCode = res.exitCode ?? 0;
      if (isLast) {
        output.push(...(res.output ?? []));
        effects.push(...(res.effects ?? []));
      } else if (exitCode !== 0) {
        output.push(...(res.output ?? []));
        break;
      } else {
        stdin = plainText(res.output ?? []);
      }
    }
  }

  if (skipped) output.push(out(seg(`kernel: skipped ${skipped} more command${skipped === 1 ? "" : "s"} (limit ${opts.maxPipelines})`, "faint")));
  return { output, effects, state: st, exitCode };
}
