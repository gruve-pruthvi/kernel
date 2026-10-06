export const DEEP_LINK_MAX_COMMANDS = 5;
export const DEEP_LINK_MAX_CHARS = 200;
const RAW_MAX = 4_000;

export interface DeepLink {
  commands: string[];
  notices: string[];
}

/** Splits on `;` outside single/double quotes. */
export function splitCommands(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (const ch of raw) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ";") {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts;
}

export function parseDeepLink(search: string): DeepLink {
  const raw = (new URLSearchParams(search).get("cmd") ?? "").slice(0, RAW_MAX);
  const all = splitCommands(raw).map((c) => c.trim()).filter(Boolean);
  const notices: string[] = [];
  let truncated = false;
  const commands = all.slice(0, DEEP_LINK_MAX_COMMANDS).map((c) => {
    if (c.length <= DEEP_LINK_MAX_CHARS) return c;
    truncated = true;
    return c.slice(0, DEEP_LINK_MAX_CHARS);
  });
  if (truncated) notices.push(`deep link: commands longer than ${DEEP_LINK_MAX_CHARS} characters were truncated`);
  const skipped = all.length - commands.length;
  if (skipped > 0) notices.push(`deep link: skipped ${skipped} more command${skipped === 1 ? "" : "s"} (limit ${DEEP_LINK_MAX_COMMANDS})`);
  return { commands, notices };
}

export const deepLinkFor = (command: string) => `/?cmd=${encodeURIComponent(command)}`;
