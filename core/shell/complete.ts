import type { Portfolio } from "../schema";
import { GUI_PAGES } from "./commands/actions";
import { buildFs, isDir, resolve } from "./fs";
import type { Command } from "./registry";

const PATH_COMMANDS = new Set(["ls", "cd", "cat", "less", "head", "tail", "wc", "tree", "find", "grep", "open"]);
const HELP_TOPICS = ["navigation", "search", "shortcuts", "links"];

function paths(p: Portfolio, cwd: string[], last: string, dirsOnly: boolean): string[] {
  const slash = last.lastIndexOf("/");
  const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
  const base = slash >= 0 ? last.slice(slash + 1) : last;
  const node = resolve(buildFs(p), cwd, dirPart || ".");
  if (!isDir(node)) return [];
  return node.children
    .filter((ch) => (!dirsOnly || isDir(ch)) && ch.name.startsWith(base))
    .map((ch) => `${dirPart}${ch.name}${isDir(ch) ? "/" : ""}`);
}

export function complete(input: string, cwd: string[], p: Portfolio, commands: Command[]): string[] {
  const cut = Math.max(input.lastIndexOf("|"), input.lastIndexOf(";")) + 1;
  const before = input.slice(0, cut);
  const stage = input.slice(cut);
  const lead = /^\s*/.exec(stage)![0];
  const words = stage.slice(lead.length).split(" ");
  const names = commands.flatMap((c) => [c.name, ...(c.aliases ?? [])]);

  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (!w) return [];
    return names.filter((n) => n.startsWith(w)).map((n) => `${before}${lead}${n} `);
  }

  const cmd = commands.find((c) => c.name === words[0].toLowerCase() || c.aliases?.includes(words[0].toLowerCase()));
  if (!cmd) return [];
  const last = words[words.length - 1];
  const head = `${before}${lead}${words.slice(0, -1).join(" ")} `;

  let options: string[] = [];
  if (last.startsWith("-")) {
    options = Object.entries(cmd.flags ?? {}).map(([name, d]) => (d.singleDash ? `-${name}` : `--${name}`));
  } else if (cmd.name === "run") {
    options = p.systems.filter((s) => s.simulation).map((s) => s.slug);
  } else if (cmd.name === "man") {
    options = [...commands.map((x) => x.name), ...p.systems.map((s) => s.slug), "kernel"];
  } else if (cmd.name === "help") {
    options = HELP_TOPICS;
  } else if (cmd.name === "graph") {
    options = [...p.systems.map((s) => s.slug), ...p.capabilities.map((x) => x.id), ...p.technologies.map((t) => t.id)];
  } else if (cmd.name === "which") {
    options = [...names, ...p.systems.map((s) => s.slug), ...p.capabilities.map((x) => x.id), ...p.technologies.map((t) => t.id)];
  } else if (cmd.name === "git") {
    options = ["log"];
  } else if (cmd.name === "gui") {
    options = [...GUI_PAGES];
  } else if (cmd.name === "export") {
    options = ["resume.pdf"];
  }
  if (cmd.name === "open") options = [...p.systems.map((s) => s.slug), "graph", "resume", "trace", "human", "contact"];
  if (PATH_COMMANDS.has(cmd.name) && !last.startsWith("-")) {
    options = [...options, ...paths(p, cwd, last, cmd.name === "cd")];
  }

  return [...new Set(options)].filter((o) => o.startsWith(last) && o !== last).map((o) => `${head}${o}`);
}

export function autosuggest(input: string, history: string[], candidates: string[]): string {
  if (!input.trim()) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.startsWith(input) && h.length > input.length) return h.slice(input.length);
  }
  return ghost(input, candidates);
}

export interface MenuItem {
  value: string;
  label: string;
  detail: string;
}

/** Labels each completion candidate for the zsh-style menu. */
export function describeCandidates(candidates: string[], cwd: string[], p: Portfolio, commands: Command[]): MenuItem[] {
  return candidates.map((value) => {
    const cut = Math.max(value.lastIndexOf("|"), value.lastIndexOf(";")) + 1;
    const words = value.slice(cut).trim().split(/\s+/);
    const word = words[words.length - 1] ?? value;
    const trimmed = word.replace(/\/$/, "");
    const label = trimmed.includes("/") ? `${trimmed.slice(trimmed.lastIndexOf("/") + 1)}${word.endsWith("/") ? "/" : ""}` : word;
    const cmd = commands.find((c) => c.name === words[0]?.toLowerCase() || c.aliases?.includes(words[0]?.toLowerCase() ?? ""));
    let detail = "";
    if (words.length === 1 && cmd) detail = cmd.summary;
    else if (label.startsWith("-") && cmd) {
      const name = label.replace(/^-+/, "");
      detail = cmd.flags?.[name]?.describe ?? "";
    } else {
      const node = resolve(buildFs(p), cwd, word);
      const system = p.systems.find((s) => s.slug === label.replace(/\/$/, ""));
      if (node?.kind === "system" || (system && !node)) detail = system?.tagline ?? "system";
      else if (node && isDir(node)) detail = "directory";
      else if (node?.kind === "file") detail = "file";
      else if (node?.kind === "view") detail = "view";
      else if (node?.kind === "link") detail = "download";
      else if (system) detail = system.tagline;
      else if (cmd?.name === "man" && commands.some((c) => c.name === label)) detail = commands.find((c) => c.name === label)!.summary;
      else if (cmd?.name === "help") detail = "help topic";
      else if (cmd?.name === "gui" || ["trace", "human", "contact"].includes(label)) detail = "visual page";
      else detail = p.capabilities.find((x) => x.id === label)?.name ?? p.technologies.find((t) => t.id === label)?.name ?? (label === "kernel" ? "the manual" : "");
    }
    return { value, label, detail };
  });
}

export function ghost(input: string, candidates: string[]): string {
  const first = candidates[0];
  return first && first.startsWith(input) ? first.slice(input.length) : "";
}

export function commonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const v of values) while (!v.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}
