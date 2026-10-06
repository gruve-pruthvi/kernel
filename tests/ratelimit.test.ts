import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/core/ratelimit";

describe("createRateLimiter", () => {
  it("limits per minute then recovers", () => {
    let t = 0;
    const rl = createRateLimiter({ perMinute: 2, perDay: 100, now: () => t });
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("a").ok).toBe(true);
    const blocked = rl.check("a");
    expect(blocked).toMatchObject({ ok: false, reason: "minute" });
    expect(rl.check("b").ok).toBe(true);
    t = 61_000;
    expect(rl.check("a").ok).toBe(true);
  });

  it("limits per day", () => {
    let t = 0;
    const rl = createRateLimiter({ perMinute: 100, perDay: 3, now: () => t });
    for (let i = 0; i < 3; i++) {
      expect(rl.check("a").ok).toBe(true);
      t += 61_000;
    }
    expect(rl.check("a")).toMatchObject({ ok: false, reason: "day" });
    t += 24 * 60 * 60 * 1000;
    expect(rl.check("a").ok).toBe(true);
  });

  it("does not count rejected requests", () => {
    let t = 0;
    const rl = createRateLimiter({ perMinute: 1, perDay: 2, now: () => t });
    rl.check("a");
    rl.check("a");
    rl.check("a");
    t = 61_000;
    expect(rl.check("a").ok).toBe(true);
  });

  it("evicts the oldest key instead of clearing", () => {
    const rl = createRateLimiter({ perMinute: 1, perDay: 10, now: () => 0, maxKeys: 2 });
    expect(rl.check("a").ok).toBe(true);
    expect(rl.check("b").ok).toBe(true);
    expect(rl.check("b").ok).toBe(false);
    expect(rl.check("c").ok).toBe(true); // evicts "a" (oldest), not everyone
    expect(rl.check("b").ok).toBe(false); // b is still limited
    expect(rl.check("a").ok).toBe(true); // a was forgotten
  });
});
