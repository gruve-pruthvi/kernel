export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  }
  return dp[a.length][b.length];
}

export function nearest(word: string, list: string[], max = 2): string | undefined {
  let best: { value: string; d: number } | undefined;
  for (const value of list) {
    const d = levenshtein(word.toLowerCase(), value.toLowerCase());
    if (d <= max && (!best || d < best.d)) best = { value, d };
  }
  return best?.value;
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function globToRegExp(glob: string): RegExp {
  const body = glob
    .split("")
    .map((ch) => (ch === "*" ? ".*" : ch === "?" ? "." : escapeRegExp(ch)))
    .join("");
  return new RegExp(`^${body}$`);
}

export function hhmm(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
