import { describe, expect, it } from "vitest";
import { comboboxProps, drainCount, mobileKeys, optionId, splitRows } from "@/components/kernel/policy";
import { commandName } from "@/core/shell/analytics";

describe("splitRows", () => {
  it("keeps in-progress rows out of the live region", () => {
    const rows = [{ id: 1 }, { id: 2, live: true }, { id: 3 }];
    expect(splitRows(rows)).toEqual({ settled: [{ id: 1 }, { id: 3 }], live: [{ id: 2, live: true }] });
  });
});

describe("comboboxProps", () => {
  it("describes the completion menu to assistive tech", () => {
    expect(comboboxProps(null, "c")).toEqual({ role: "combobox", "aria-expanded": false, "aria-autocomplete": "list" });
    expect(comboboxProps({ items: [1, 2], index: -1 }, "c")).toEqual({
      role: "combobox",
      "aria-expanded": true,
      "aria-controls": "c",
      "aria-autocomplete": "list",
    });
    expect(comboboxProps({ items: [1, 2], index: 1 }, "c")["aria-activedescendant"]).toBe(optionId("c", 1));
    expect(optionId("c", 1)).toBe("c-1");
  });
});

describe("mobileKeys", () => {
  it("disables keys while busy and offers ^C", () => {
    expect(mobileKeys(false).map((k) => k.id)).toEqual(["tab", "up", "cdup", "ls", "help", "clear"]);
    expect(mobileKeys(false).every((k) => !k.disabled)).toBe(true);
    const busy = mobileKeys(true);
    expect(busy.find((k) => k.id === "cancel")).toEqual({ id: "cancel", label: "^C", disabled: false });
    expect(busy.filter((k) => k.id !== "cancel").every((k) => k.disabled)).toBe(true);
  });
});

describe("drainCount", () => {
  const simulate = (initial: number) => {
    let buffered = initial;
    let t = 0;
    while (buffered > 0 && t < 10_000) {
      buffered -= drainCount(buffered, 16);
      t += 16;
    }
    return t;
  };

  it("drain rate catches up with large buffers", () => {
    expect(simulate(5_000)).toBeLessThanOrEqual(1_300);
  });

  it("still types short answers visibly", () => {
    expect(simulate(40)).toBeGreaterThanOrEqual(200);
  });

  it("never stalls or overshoots", () => {
    expect(drainCount(1, 1)).toBe(1);
    expect(drainCount(3, 1000)).toBe(3);
    expect(drainCount(0, 16)).toBe(0);
  });
});

describe("commandName", () => {
  it("records only the command name", () => {
    expect(commandName("grep -i secret-project .")).toBe("grep");
    expect(commandName("what is atlas?")).toBe("ask");
    expect(commandName("ask how does relay work")).toBe("ask");
    expect(commandName("rm -rf /")).toBe("unknown");
    expect(commandName("   ")).toBe("");
  });
});
