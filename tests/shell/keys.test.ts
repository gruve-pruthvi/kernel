import { describe, expect, it } from "vitest";
import { blockWhileBusy, tabDecision } from "@/components/kernel/keys";

describe("tabDecision (review fix: no keyboard trap)", () => {
  it("lets Tab leave the shell when the input is empty or a command is running", () => {
    expect(tabDecision({ input: "", menuOpen: false, busy: false })).toBe("pass");
    expect(tabDecision({ input: "   ", menuOpen: false, busy: false })).toBe("pass");
    expect(tabDecision({ input: "ls", menuOpen: false, busy: true })).toBe("pass");
  });

  it("completes while typing or cycling the menu", () => {
    expect(tabDecision({ input: "gr", menuOpen: false, busy: false })).toBe("complete");
    expect(tabDecision({ input: "", menuOpen: true, busy: false })).toBe("complete");
  });
});

describe("blockWhileBusy", () => {
  it("blocks typing but not navigation or browser shortcuts", () => {
    expect(blockWhileBusy({ key: "a", meta: false, ctrl: false, alt: false })).toBe(true);
    expect(blockWhileBusy({ key: "Enter", meta: false, ctrl: false, alt: false })).toBe(true);
    expect(blockWhileBusy({ key: "Backspace", meta: false, ctrl: false, alt: false })).toBe(true);
    expect(blockWhileBusy({ key: "Tab", meta: false, ctrl: false, alt: false })).toBe(false);
    expect(blockWhileBusy({ key: "r", meta: true, ctrl: false, alt: false })).toBe(false);
    expect(blockWhileBusy({ key: "c", meta: true, ctrl: false, alt: false })).toBe(false);
    expect(blockWhileBusy({ key: "ArrowUp", meta: false, ctrl: false, alt: false })).toBe(false);
  });
});
