import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { COMMANDS } from "@/core/shell/commands";
import { execute, initialState } from "@/core/shell/execute";
import { formatDuration } from "@/core/shell/commands/runtime";
import { DEFAULT_ENV, type RuntimeEnv } from "@/core/shell/types";
import { NOW, seq, textOf } from "./helpers";

const withEnv = (input: string, env: Partial<RuntimeEnv> = {}, p: Portfolio = portfolio, now = NOW + 125_000) =>
  textOf(execute(input, initialState(NOW), p, now, { env: { ...DEFAULT_ENV, ...env } }).output);

describe("stats", () => {
  it("counts non-empty commands", () => {
    expect(seq("ls", "pwd", "   ").state.stats.commands).toBe(2);
  });
});

describe("status", () => {
  it("reports real subsystem state", () => {
    const text = withEnv("status", { ai: "online" });
    expect(text).toContain("KERNEL STATUS");
    expect(text).toMatch(new RegExp(`portfolio\\s+READY\\s+${portfolio.systems.length} systems`));
    expect(text).toMatch(/query\s+ONLINE\s+gemini configured/);
    expect(text).toMatch(/session\s+READY\s+up 2m 5s · 1 commands/);
    expect(withEnv("status")).toMatch(/query\s+UNKNOWN/);
    expect(withEnv("status", { ai: "offline" })).toMatch(/query\s+OFFLINE\s+no key — local search answers/);
  });

  it("is derived from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = p.systems.slice(0, 1);
    expect(withEnv("status", {}, p)).toMatch(/portfolio\s+READY\s+1 systems/);
  });
});

describe("ps / top / env", () => {
  it("ps lists kernel modules with real counts", () => {
    const lines = withEnv("ps", { pane: "graph" }).split("\n");
    expect(lines[0]).toMatch(/PID\s+NAME\s+STATE\s+DETAIL/);
    expect(lines).toHaveLength(7);
    expect(lines[1]).toMatch(new RegExp(`1\\s+shell\\s+running\\s+${COMMANDS.length} commands`));
    expect(lines[6]).toMatch(/6\s+renderer\s+running\s+pane: graph/);
  });

  it("top summarises this session", () => {
    const state = seq("ls", "pwd", "ls").state; // consecutive duplicates are not recorded, so interleave
    const text = textOf(execute("top", state, portfolio, NOW + 60_000, { env: DEFAULT_ENV }).output);
    expect(text).toMatch(/^kernel — up 1m 0s/);
    expect(text).toMatch(/commands\s+4 this session · history 4/);
    expect(text).toMatch(/ls\s+█+ 2/);
  });

  it("env shows public configuration only", () => {
    const text = withEnv("env", { theme: "light", ai: "online", recruiter: true, motion: "reduced" });
    for (const line of ["KERNEL_VERSION=1.0", "CWD=~", "THEME=light", "MOTION=reduced", "RECRUITER=on", "AI=online", "HISTSIZE=1"]) {
      expect(text).toContain(line);
    }
    expect(text).toMatch(/SESSION_START=\d\d:\d\d/);
    expect(text).not.toMatch(/KEY|GEMINI/);
  });

  it("formats durations", () => {
    expect(formatDuration(5_000)).toBe("0m 5s");
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });

  it("tolerates a minimal portfolio", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.experience = [];
    p.systems = p.systems.slice(-1);
    for (const cmd of ["status", "ps", "top", "env"]) expect(() => withEnv(cmd, {}, p)).not.toThrow();
  });
});

describe("graph --depth", () => {
  it("expands focus by hops", () => {
    const res = execute("graph --depth 1 langgraph", initialState(NOW), portfolio, NOW);
    const focus = (res.effects[0] as { view: { focus: string[] } }).view.focus;
    expect(focus).toEqual(expect.arrayContaining(["tech:langgraph", "system:atlas", "system:relay", "cap:agents"]));
  });

  it("validates depth", () => {
    expect(withEnv("graph --depth 4 atlas")).toBe("graph: --depth must be 1, 2 or 3");
    expect(withEnv("graph --depth 2")).toBe("graph: --depth needs a node");
  });
});
