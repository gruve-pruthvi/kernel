import type { Mode } from "../boot";

export type Tone =
  | "text"
  | "muted"
  | "faint"
  | "accent"
  | "error"
  | "ok"
  | "dir"
  | "view"
  | "link"
  | "warn"
  | "heading"
  | "match";

/** One styled run of text. `run` is a command executed on click; `href` is a link. */
export interface Seg {
  text: string;
  tone?: Tone;
  run?: string;
  href?: string;
}

export type Line = Seg[];
export type Block = { kind: "neofetch" };
export type OutputItem = { line: Line } | { block: Block };

export type View =
  | { type: "architecture"; slug: string }
  | { type: "graph"; focus: string[] }
  | { type: "reader"; path: string[] };

export type Effect =
  | { type: "openView"; view: View }
  | { type: "closeView" }
  | { type: "navigate"; href: string; hard?: boolean }
  | { type: "download"; href: string }
  | { type: "simulate"; slug: string }
  | { type: "ask"; question: string }
  | { type: "clear" }
  | { type: "mode"; mode: Mode }
  | { type: "exit" }
  | { type: "tour"; action: "start" | "skip" };

export interface HistoryEntry {
  command: string;
  at: number;
}

export interface ShellState {
  cwd: string[];
  prevCwd: string[];
  history: HistoryEntry[];
  sessionStart: number;
  stats: { commands: number; simulations: number };
}

export interface RuntimeEnv {
  theme: "dark" | "light";
  motion: "full" | "reduced";
  mode: Mode;
  surface: "page" | "console";
  ai: "online" | "offline" | "unknown";
  pane: string | null;
}

export const DEFAULT_ENV: RuntimeEnv = { theme: "dark", motion: "full", mode: "shell", surface: "page", ai: "unknown", pane: null };

export interface Result {
  output: OutputItem[];
  effects: Effect[];
  state: ShellState;
  exitCode: 0 | 1;
}
