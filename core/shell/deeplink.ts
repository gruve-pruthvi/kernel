export const DEEP_LINK_MAX = 500;

export function parseDeepLink(search: string): { line: string | null; truncated: boolean } {
  const value = new URLSearchParams(search).get("cmd")?.trim();
  if (!value) return { line: null, truncated: false };
  return value.length > DEEP_LINK_MAX ? { line: value.slice(0, DEEP_LINK_MAX), truncated: true } : { line: value, truncated: false };
}

export const deepLinkFor = (command: string) => `/?cmd=${encodeURIComponent(command)}`;
