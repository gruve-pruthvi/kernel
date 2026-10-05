import type { Command } from "../registry";
import { actionCommands } from "./actions";
import { infoCommands } from "./info";
import { navCommands } from "./nav";
import { searchCommands } from "./search";
import { textCommands } from "./text";

export const COMMANDS: Command[] = [...navCommands, ...textCommands, ...searchCommands, ...infoCommands, ...actionCommands];

export function getCommand(name: string): Command | undefined {
  const n = name.toLowerCase();
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export const commandNames = (): string[] => COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
