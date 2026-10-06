import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { systemSchema, type Portfolio } from "@/core/schema";
import { run, runWith } from "./helpers";

const clone = (): Portfolio => structuredClone(portfolio);
const commitCount = portfolio.experience.reduce((n, e) => n + e.commits.length, 0);

describe("git log", () => {
  it("prints multi-line entries newest first", () => {
    const lines = run("git log").text.split("\n");
    expect(lines[0]).toBe("commit 7f3b2d1 (feat/ai-systems)");
    expect(lines[1]).toMatch(/^Org: {4}.+ @ Example Labs$/);
    expect(lines[2]).toBe("Date:   Sep 2025");
    expect(lines.filter((l) => l.startsWith("commit "))).toHaveLength(commitCount);
  });

  it("supports --oneline and a system filter", () => {
    const oneline = run("git log --oneline").text.split("\n");
    expect(oneline[0]).toMatch(/^\* 7f3b2d1 \(feat\/ai-systems\) /);
    expect(oneline).toHaveLength(commitCount);
    const atlas = run("git log atlas --oneline").text.split("\n");
    const expected = portfolio.experience.flatMap((e) => e.commits).filter((c) => c.systems?.includes("atlas")).length;
    expect(atlas).toHaveLength(expected);
    expect(run("git log atlsa").text).toBe('git log: no system "atlsa"\ndid you mean git log atlas');
  });
});

describe("git show / branch", () => {
  it("shows one commit with its systems", () => {
    const text = run("git show 7f3b").text;
    expect(text).toContain("commit 7f3b2d1");
    expect(text).toContain("feat: introduce multi-agent orchestration with Relay");
    expect(text).toContain("Systems:");
    expect(text).toContain("Relay");
  });

  it("git show rejects short and ambiguous prefixes", () => {
    expect(run("git show a").text).toBe("git show: hash prefix too short (use at least 4 characters)");
    expect(run("git show ffff").text).toBe("git show: unknown revision ffff");
    const p = clone();
    p.experience[0].commits[0].hash = "abcd111";
    p.experience[0].commits[1].hash = "abcd222";
    expect(runWith(p, "git show abcd").text).toBe("git show: abcd is ambiguous (abcd111, abcd222)");
    expect(run("git show").text).toBe("git show: missing revision\nusage: git log [system] [--oneline] · git show <hash> · git branch");
  });

  it("lists branches with the current role starred", () => {
    const lines = run("git branch").text.split("\n");
    expect(lines[0]).toMatch(/^\* feat\/ai-systems {2}/);
    expect(lines).toHaveLength(portfolio.experience.length);
    expect(run("git status").text).toBe("git: 'status' is not available here\nusage: git log [system] [--oneline] · git show <hash> · git branch");
  });
});

describe("diff", () => {
  it("compares two systems", () => {
    const text = run("diff atlas relay").text;
    expect(text.split("\n")[0]).toMatch(/Atlas\s+Relay/);
    expect(text).toMatch(/= .*LangGraph.*shared/);
    expect(text).toMatch(/- .*Weaviate.*only atlas/);
    expect(text).toMatch(/\+ .*MCP.*only relay/);
  });

  it("validates arguments", () => {
    expect(run("diff atlas").text).toBe("diff: need two systems\nusage: diff <system> <system>");
    expect(run("diff atlas atlas").text).toBe("diff: compare two different systems");
    expect(run("diff atlas ghost").text).toBe('diff: no system "ghost"');
  });
});

describe("benchmark", () => {
  it("refuses to invent numbers", () => {
    const { text, res } = run("benchmark atlas");
    expect(text).toBe("benchmark: Atlas has no published measurements\nadd them to content/systems/atlas.ts → benchmarks");
    expect(res.exitCode).toBe(1);
  });

  it("prints published measurements", () => {
    const p = clone();
    p.systems[0].benchmarks = [{ metric: "p95 latency", value: "820", unit: "ms", context: "1k req load test", measuredAt: "2025-04" }];
    const text = runWith(p, "benchmark atlas").text;
    expect(text).toContain("p95 latency");
    expect(text).toContain("820 ms");
    expect(text).toContain("1k req load test · Apr 2025");
  });

  it("validates the content field", () => {
    const base = structuredClone(portfolio.systems[0]);
    expect(systemSchema.safeParse({ ...base, benchmarks: [{ metric: "x", value: "1", measuredAt: "April" }] }).success).toBe(false);
    expect(systemSchema.safeParse({ ...base, benchmarks: [{ metric: "x", value: "1" }] }).success).toBe(true);
  });
});

describe("introspection commands tolerate a minimal portfolio", () => {
  it("prints empty states instead of throwing", () => {
    const p = clone();
    p.experience = [];
    p.systems = [p.systems[p.systems.length - 1]];
    expect(runWith(p, "git log").text).toBe("no commits yet");
    expect(runWith(p, "git branch").text).toBe("no branches yet");
    expect(runWith(p, `diff ${p.systems[0].slug} atlas`).text).toBe('diff: no system "atlas"');
    expect(runWith(p, `benchmark ${p.systems[0].slug}`).res.exitCode).toBe(1);
  });
});
