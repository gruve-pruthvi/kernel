import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { execute, initialState } from "@/core/shell/execute";
import { DEFAULT_ENV, type RuntimeEnv } from "@/core/shell/types";
import { NOW, textOf } from "./helpers";

const on = (input: string, env: Partial<RuntimeEnv> = {}) => {
  const res = execute(input, initialState(NOW), portfolio, NOW, { env: { ...DEFAULT_ENV, ...env } });
  return { effects: res.effects, text: textOf(res.output), exitCode: res.exitCode };
};

describe("mode commands", () => {
  it("human switches to the recruiter view", () => {
    expect(on("human").effects).toEqual([{ type: "mode", mode: "human" }]);
  });

  it("exit depends on the surface", () => {
    expect(on("exit", { surface: "console" }).effects).toEqual([{ type: "exit" }]);
    expect(on("exit", { surface: "page" }).effects).toEqual([{ type: "exit" }]);
    expect(on("exit", { surface: "page" }).text).toContain("recruiter view");
    expect(on("logout").effects).toEqual([{ type: "exit" }]);
  });

  it("reboot replays the bootloader", () => {
    expect(on("reboot").effects[0]).toMatchObject({ type: "navigate", href: "/?boot=1" });
  });

  it("fullscreen opens the full shell from the console only", () => {
    expect(on("fullscreen", { surface: "console" }).effects).toEqual([{ type: "navigate", href: "/shell" }]);
    const page = on("fullscreen", { surface: "page" });
    expect(page.effects).toEqual([]);
    expect(page.text).toBe("fullscreen: already in the full shell");
  });

  it("mode effects are dropped inside pipelines", () => {
    for (const cmd of ["human | cat", "exit | wc -l", "reboot | head"]) expect(on(cmd).effects, cmd).toEqual([]);
  });
});

describe("reboot is a full page load", () => {
  it("asks for a hard navigation so the pre-paint boot script runs", () => {
    expect(on("reboot").effects).toEqual([{ type: "navigate", href: "/?boot=1", hard: true }]);
  });
});
