import { describe, expect, it } from "vitest";
import { bootKeyAction } from "@/components/boot/policy";

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
