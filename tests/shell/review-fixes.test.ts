import { describe, expect, it } from "vitest";
import { createTypewriter } from "@/components/kernel/policy";
import { createRateLimiter } from "@/core/ratelimit";
import { siteUrl } from "@/lib/site";
import { run } from "./helpers";

describe("typewriter stop is final (review #1)", () => {
  const frames = () => {
    const queue: ((t: number) => void)[] = [];
    let t = 0;
    return {
      nextFrame: () => new Promise<number>((resolve) => queue.push(resolve)),
      tick: async (n = 1) => {
        for (let i = 0; i < n; i++) {
          t += 16;
          queue.shift()?.(t);
          await Promise.resolve();
          await Promise.resolve();
        }
      },
    };
  };

  it("never writes after stop()", async () => {
    const f = frames();
    const writes: string[] = [];
    const tw = createTypewriter({ write: (s) => writes.push(s), nextFrame: f.nextFrame, instant: () => false, now: () => 0 });
    tw.push("x".repeat(2000));
    await f.tick(2);
    const before = writes.length;
    const shown = tw.shown;
    const done = tw.stop();
    await f.tick(3);
    await done;
    expect(writes.length).toBe(before);
    expect(tw.shown).toBe(shown);
  });

  it("end() resolves after revealing everything", async () => {
    const f = frames();
    let last = "";
    const tw = createTypewriter({ write: (s) => (last = s), nextFrame: f.nextFrame, instant: () => true, now: () => 0 });
    tw.push("hello");
    const done = tw.end();
    await f.tick(2);
    await done;
    expect(last).toBe("hello");
  });
});

describe("typo routing only triggers on real paths (review #2)", () => {
  const asks = (input: string) => run(input).res.effects.some((e) => e.type === "ask");
  it("keeps tech questions going to the AI", () => {
    for (const q of ["my experience with node.js", "set up ci/cd", "i built things with next.js", "work on ai/ml", "go projects using ci/cd"]) {
      expect(asks(q), q).toBe(true);
    }
  });
  it("still catches real typos", () => {
    expect(run("cta README.md").text).toContain("did you mean cat");
    expect(run("grpe rag .").text).toContain("did you mean grep");
    expect(run("lss ./systems").text).toContain("did you mean ls");
  });
});

describe("siteUrl on Vercel (review #3)", () => {
  it("falls back to the Vercel production URL before localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "kernel-demo.vercel.app";
    expect(siteUrl()).toBe("https://kernel-demo.vercel.app");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("rate limiter evicts least recently used (review #4)", () => {
  it("keeps an active limited client even if it was inserted first", () => {
    const rl = createRateLimiter({ perMinute: 1, perDay: 10, now: () => 0, maxKeys: 3 });
    rl.check("victim");
    for (const k of ["a", "b"]) rl.check(k);
    expect(rl.check("victim").ok).toBe(false); // touched again → most recent
    expect(rl.check("c").ok).toBe(true); // evicts "a", not the victim
    expect(rl.check("victim").ok).toBe(false);
  });
});
