import type { Line, Seg, Tone } from "./types";

export function inline(text: string, base: Tone = "text"): Seg[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  if (parts.length === 0) return [{ text: "", tone: base }];
  return parts.map((p) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? { text: p.slice(2, -2), tone: "accent" } : { text: p, tone: base }));
}

const PREFIXES: [string, Tone][] = [
  ["● ", "accent"],
  ["○ ", "faint"],
  ["→ ", "ok"],
  ["+ ", "ok"],
  ["− ", "warn"],
];

export function styleLine(text: string): Line {
  if (text.startsWith("# ")) return [{ text: text.slice(2), tone: "heading" }];
  if (text.startsWith("## ")) return [{ text: text.slice(3), tone: "accent" }];
  const bullet = /^(\s*)[-*] (.*)$/.exec(text);
  if (bullet) return [{ text: `${bullet[1]}› `, tone: "accent" }, ...inline(bullet[2])];
  const trimmed = text.trimStart();
  for (const [prefix, tone] of PREFIXES) {
    if (trimmed.startsWith(prefix)) return [{ text, tone }];
  }
  return inline(text);
}
