import type { Command } from "../registry";
import { navCommands } from "./nav";

export const COMMANDS: Command[] = [...navCommands];

export function getCommand(name: string): Command | undefined {
  const n = name.toLowerCase();
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export const commandNames = (): string[] => COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
