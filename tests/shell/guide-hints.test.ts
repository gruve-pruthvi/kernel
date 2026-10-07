import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { execute, initialState } from "@/core/shell/execute";
import { hints, type HintContext, type StepEvent } from "@/core/shell/guide";
import { NOW } from "./helpers";

const ev = (command: string, cwd: string[], patch: Partial<StepEvent> = {}): StepEvent => ({ command, cwd, effects: [], exitCode: 0, ...patch });
const runnable = portfolio.systems.find((s) => s.simulation)!.slug;
const noDemo = portfolio.systems.find((s) => !s.simulation);

function contexts(p: Portfolio): HintContext[] {
  const slugs = p.systems.map((s) => s.slug);
  const demo = p.systems.find((s) => s.simulation)?.slug;
  return [
    { cwd: [] },
    { cwd: ["systems"] },
    { cwd: ["skills"] },
    { cwd: ["stack"] },
    ...slugs.map((slug) => ({ cwd: ["systems", slug] })),
    ...(demo
      ? [
          { cwd: [], last: ev(`run ${demo}`, [], { effects: [{ type: "simulate" as const, slug: demo }] }) },
          { cwd: ["systems", demo], last: ev(`run ${demo}`, ["systems", demo], { effects: [{ type: "simulate" as const, slug: demo }] }) },
        ]
      : []),
    { cwd: [], last: ev("ask x", [], { effects: [{ type: "ask", question: "x" }] }), sources: [...slugs, "nope"] },
    { cwd: [], last: ev("ask x", [], { effects: [{ type: "ask", question: "x" }] }), sources: [] },
  ];
}

describe("hints", () => {
  it("every hint runs cleanly in every context", () => {
    for (const ctx of contexts(portfolio)) {
      const list = hints(ctx, portfolio);
      expect(list.length, JSON.stringify(ctx)).toBeGreaterThanOrEqual(1);
      expect(list.length, JSON.stringify(ctx)).toBeLessThanOrEqual(3);
      for (const command of list) {
        const res = execute(command, { ...initialState(NOW), cwd: ctx.cwd }, portfolio, NOW);
        expect(res.exitCode, `${command} in ~/${ctx.cwd.join("/")}`).toBe(0);
      }
    }
  });

  it("follows where the visitor is", () => {
    expect(hints({ cwd: [] }, portfolio)).toEqual(["ls systems", "cat about.md", "ask what have you built?"]);
    expect(hints({ cwd: ["skills"] }, portfolio)).toEqual(["ls ~/systems", "cat ~/about.md", "ask what have you built?"]);
    expect(hints({ cwd: ["systems"] }, portfolio)).toEqual(portfolio.systems.slice(0, 2).map((s) => `cd ${s.slug}`));
    expect(hints({ cwd: ["systems", runnable] }, portfolio)).toEqual(["cat README.md", `run ${runnable}`, "cd .."]);
    if (noDemo) expect(hints({ cwd: ["systems", noDemo.slug] }, portfolio)).toEqual(["cat README.md", "cd .."]);
  });

  it("after a demo, suggests its decisions and a comparison", () => {
    const other = portfolio.systems.find((s) => s.slug !== runnable)!.slug;
    const sim = { effects: [{ type: "simulate" as const, slug: runnable }] };
    expect(hints({ cwd: ["systems", runnable], last: ev(`run ${runnable}`, ["systems", runnable], sim) }, portfolio)).toEqual([
      "cat decisions.md",
      `diff ${runnable} ${other}`,
    ]);
    expect(hints({ cwd: [], last: ev(`run ${runnable}`, [], sim) }, portfolio)[0]).toBe(`cat ~/systems/${runnable}/decisions.md`);
  });

  it("ask hints keep only real systems", () => {
    const ask = ev("ask x", [], { effects: [{ type: "ask", question: "x" }] });
    expect(hints({ cwd: [], last: ask, sources: ["nope", "react", runnable] }, portfolio)).toEqual([`open ${runnable}`]);
    expect(hints({ cwd: [], last: ask, sources: ["nope"] }, portfolio)).toEqual(hints({ cwd: [] }, portfolio));
  });

  it("a failed last command does not change the hints", () => {
    const failed = ev("run nope", [], { exitCode: 1, effects: [{ type: "simulate", slug: runnable }] });
    expect(hints({ cwd: [], last: failed }, portfolio)).toEqual(hints({ cwd: [] }, portfolio));
  });

  it("tolerates a minimal portfolio", () => {
    const one = structuredClone(portfolio);
    one.systems = [one.systems[one.systems.length - 1]];
    one.experience = [];
    const none = structuredClone(portfolio);
    none.systems = [];
    for (const p of [one, none]) {
      for (const ctx of contexts(p)) {
        for (const command of hints(ctx, p)) {
          const res = execute(command, { ...initialState(NOW), cwd: ctx.cwd }, p, NOW);
          expect(res.exitCode, `${command} in ~/${ctx.cwd.join("/")}`).toBe(0);
        }
      }
    }
  });
});
