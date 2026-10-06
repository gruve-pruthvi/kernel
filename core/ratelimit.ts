export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number; reason: "minute" | "day" };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_KEYS = 10_000;

export function createRateLimiter(opts: { perMinute: number; perDay: number; now?: () => number; maxKeys?: number }) {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? MAX_KEYS;
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((h) => t - h < DAY);
      const lastMinute = recent.filter((h) => t - h < MINUTE);

      if (lastMinute.length >= opts.perMinute) {
        hits.set(key, recent);
        return { ok: false, reason: "minute", retryAfterSec: Math.ceil((lastMinute[0] + MINUTE - t) / 1000) };
      }
      if (recent.length >= opts.perDay) {
        hits.set(key, recent);
        return { ok: false, reason: "day", retryAfterSec: Math.ceil((recent[0] + DAY - t) / 1000) };
      }

      if (!hits.has(key) && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      recent.push(t);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}
