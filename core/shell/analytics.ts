import { getCommand } from "./commands";
import { isQuestion } from "./execute";

/** The only thing analytics may record about a shell line: which command ran. Never arguments or questions. */
export function commandName(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  const first = trimmed.split(/\s+/)[0].toLowerCase();
  if (first === "ask" || isQuestion(trimmed)) return "ask";
  return getCommand(first)?.name ?? "unknown";
}
