import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { plainText } from "@/core/shell/registry";
import { welcome } from "@/core/shell/welcome";
import { run } from "./helpers";

describe("tour command", () => {
  it("starts and skips the tour through an effect", () => {
    expect(run("tour").res.effects).toEqual([{ type: "tour", action: "start" }]);
    expect(run("tour skip").res.effects).toEqual([{ type: "tour", action: "skip" }]);
    expect(run("tour").res.exitCode).toBe(0);
  });

  it("tour parses case-insensitively and rejects extra args", () => {
    expect(run("TOUR").res.effects).toEqual([{ type: "tour", action: "start" }]);
    expect(run("tour SKIP").res.effects).toEqual([{ type: "tour", action: "skip" }]);
    const bad = run("tour skip now");
    expect(bad.res.exitCode).toBe(1);
    expect(bad.res.effects).toEqual([]);
    expect(bad.text).toContain("usage: tour [skip]");
  });

  it("has a manual page and shows up in help", () => {
    expect(run("man tour").text).toContain("TOUR(1)");
    expect(run("help").text).toContain("tour");
  });

  it("plain `skip` is not a command outside the tour", () => {
    expect(run("skip").res.exitCode).toBe(1);
  });
});

describe("welcome", () => {
  it("drops the old `try` line — the hint bar replaces it", () => {
    const text = plainText(welcome(portfolio));
    expect(text.some((l) => l.startsWith("try"))).toBe(false);
    expect(text.some((l) => l.includes("what has been built with agents?"))).toBe(true);
    expect(text.some((l) => portfolio.systems.every((s) => l.includes(s.slug)))).toBe(true);
  });
});
