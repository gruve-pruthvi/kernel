import { describe, expect, it } from "vitest";
import { typingKeyAction } from "@/components/kernel/keys";
import { typeIn } from "@/components/kernel/policy";

describe("typeIn", () => {
  it("types the command letter by letter within the cap and reports it finished", async () => {
    const writes: string[] = [];
    const waits: number[] = [];
    const done = await typeIn("ls systems", { write: (t) => writes.push(t), sleep: async (ms) => void waits.push(ms), aborted: () => false, instant: false });
    expect(done).toBe(true);
    expect(writes.at(-1)).toBe("ls systems");
    expect(writes.length).toBe("ls systems".length);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(300);
  });

  it("stops typing and reports unfinished once aborted (Ctrl+C)", async () => {
    const writes: string[] = [];
    let abort = false;
    const done = await typeIn("cd systems/atlas", {
      write: (t) => {
        writes.push(t);
        if (t.length === 3) abort = true;
      },
      sleep: async () => {},
      aborted: () => abort,
      instant: false,
    });
    expect(done).toBe(false);
    expect(writes.at(-1)).toBe("cd ");
  });

  it("inserts instantly with reduced motion", async () => {
    const writes: string[] = [];
    expect(await typeIn("ls", { write: (t) => writes.push(t), sleep: async () => {}, aborted: () => false, instant: true })).toBe(true);
    expect(writes).toEqual(["ls"]);
  });
});

describe("typingKeyAction", () => {
  const k = (key: string, ctrl = false) => typingKeyAction({ key, ctrl, meta: false, alt: false });
  it("Ctrl+C aborts a typed-in suggestion; every other key is swallowed", () => {
    expect(k("c", true)).toBe("abort");
    expect(k("C", true)).toBe("abort");
    for (const key of ["Enter", "a", "Tab", "ArrowUp", "Escape"]) expect(k(key), key).toBe("swallow");
    expect(typingKeyAction({ key: "c", ctrl: true, meta: true, alt: false })).toBe("swallow");
  });
});
