import { describe, expect, it } from "vitest";
import { bootKeyAction, isScrollGesture } from "@/components/boot/policy";

const k = (patch: Partial<Parameters<typeof bootKeyAction>[0]> = {}) =>
  bootKeyAction({ key: "Enter", meta: false, ctrl: false, alt: false, targetTag: "DIV", editable: false, ...patch });

describe("bootKeyAction", () => {
  it("maps menu keys", () => {
    expect(k()).toBe("boot-selected");
    expect(k({ key: "ArrowDown" })).toBe("down");
    expect(k({ key: "ArrowUp" })).toBe("up");
    expect(k({ key: "`" })).toBe("boot-shell");
    expect(k({ key: "Escape" })).toBe("boot-human");
    expect(k({ key: "a" })).toBeNull();
  });

  it("never steals keys from text fields, links, buttons or shortcuts", () => {
    for (const patch of [{ editable: true }, { targetTag: "A" }, { targetTag: "BUTTON" }, { meta: true }, { ctrl: true }, { alt: true }]) {
      expect(k(patch), JSON.stringify(patch)).toBeNull();
      expect(k({ ...patch, key: "`" }), JSON.stringify(patch)).toBeNull();
    }
  });
});

describe("isScrollGesture", () => {
  it("a wobbly tap is not a scroll", () => {
    expect(isScrollGesture({ x: 100, y: 400 }, { x: 104, y: 409 }, false)).toBe(false);
  });
  it("a real swipe outside the menu is a scroll", () => {
    expect(isScrollGesture({ x: 100, y: 400 }, { x: 100, y: 380 }, false)).toBe(true);
    expect(isScrollGesture({ x: 100, y: 400 }, { x: 130, y: 400 }, false)).toBe(true);
  });
  it("gestures that start on the menu never boot by scrolling", () => {
    expect(isScrollGesture({ x: 100, y: 400 }, { x: 100, y: 300 }, true)).toBe(false);
  });
});
