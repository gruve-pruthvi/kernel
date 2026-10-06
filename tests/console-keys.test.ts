import { describe, expect, it } from "vitest";
import { consoleKeyAction, consoleModeAction, escapeAction, focusWrap } from "@/components/kernel/keys";

const k = (patch: Partial<Parameters<typeof consoleKeyAction>[0]> = {}) =>
  consoleKeyAction({ key: "`", meta: false, ctrl: false, alt: false, editable: false, inConsole: false, pathname: "/", open: false, booting: false, queryOpen: false, ...patch });

describe("consoleKeyAction", () => {
  it("backtick opens the console on GUI pages", () => {
    expect(k()).toBe("open");
    expect(k({ pathname: "/systems/atlas" })).toBe("open");
  });

  it("console key ignores editable targets and modifiers", () => {
    expect(k({ editable: true })).toBeNull();
    expect(k({ meta: true })).toBeNull();
    expect(k({ ctrl: true })).toBeNull();
    expect(k({ alt: true })).toBeNull();
    expect(k({ key: "~" })).toBeNull();
  });

  it("closes with backtick (even from the console's own input) or Escape", () => {
    expect(k({ open: true })).toBe("close");
    expect(k({ open: true, editable: true, inConsole: true })).toBe("close");
    expect(k({ open: true, key: "Escape", editable: true, inConsole: true })).toBe("close");
    expect(k({ open: true, editable: true, inConsole: false })).toBeNull();
  });

  it("never acts in the full shell or while the bootloader is up", () => {
    expect(k({ pathname: "/shell" })).toBeNull();
    expect(k({ booting: true })).toBeNull();
  });
});

describe("escapeAction", () => {
  it("peels one layer at a time, and finally closes the console", () => {
    const base = { menu: false, search: false, pane: false, console: true };
    expect(escapeAction({ ...base, menu: true, search: true, pane: true })).toBe("menu");
    expect(escapeAction({ ...base, search: true, pane: true })).toBe("search");
    expect(escapeAction({ ...base, pane: true })).toBe("pane");
    expect(escapeAction(base)).toBe("exit");
    expect(escapeAction({ ...base, console: false })).toBe("none");
  });
});

describe("console vs query panel", () => {
  it("Escape closes the query panel first when it is open", () => {
    expect(k({ open: true, key: "Escape", queryOpen: true, editable: true })).toBeNull();
    expect(k({ open: true, key: "Escape", queryOpen: false })).toBe("close");
  });
});

describe("consoleModeAction", () => {
  it("human in the console on the recruiter page just closes the console", () => {
    expect(consoleModeAction("human", "/", "console")).toBe("close");
    expect(consoleModeAction("human", "/systems", "console")).toBe("switch");
    expect(consoleModeAction("shell", "/", "console")).toBe("switch");
    expect(consoleModeAction("human", "/shell", "page")).toBe("switch");
  });
});

describe("focusWrap", () => {
  it("wraps Tab and Shift+Tab at the edges of the console only", () => {
    expect(focusWrap(2, 3, false)).toBe(0);
    expect(focusWrap(0, 3, true)).toBe(2);
    expect(focusWrap(1, 3, false)).toBeNull();
    expect(focusWrap(-1, 3, false)).toBe(0); // focus outside: pull it back in
    expect(focusWrap(0, 0, false)).toBeNull();
  });
});
