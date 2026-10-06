import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage(init: Record<string, string> = {}, broken = false) {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => {
      if (broken) throw new Error("blocked");
      return k in data ? data[k] : null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("blocked");
      data[k] = v;
    },
    removeItem: (k: string) => {
      if (broken) throw new Error("blocked");
      delete data[k];
    },
  };
}

async function loadStore(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("document", { documentElement: { dataset: {} as Record<string, string> } });
  return import("@/lib/store");
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("kernel store mode", () => {
  it("restores the saved mode and deletes the legacy recruiter key", async () => {
    const storage = fakeStorage({ "kernel:mode": "shell", "kernel:recruiter": "on" });
    const { kernelSnapshot } = await loadStore(storage);
    expect(kernelSnapshot().mode).toBe("shell");
    expect(storage.data).not.toHaveProperty("kernel:recruiter");
  });

  it("defaults to human and ignores invalid values", async () => {
    const { kernelSnapshot } = await loadStore(fakeStorage({ "kernel:mode": "robot" }));
    expect(kernelSnapshot().mode).toBe("human");
  });

  it("setMode persists the mode and marks the menu as seen", async () => {
    const storage = fakeStorage();
    const { kernel, kernelSnapshot, readBootPrefs } = await loadStore(storage);
    kernel.setMode("shell");
    expect(kernelSnapshot().mode).toBe("shell");
    expect(storage.data).toMatchObject({ "kernel:mode": "shell", "kernel:bootmenu": "seen" });
    expect(readBootPrefs()).toEqual({ storedMode: "shell", menuSeen: true });
  });

  it("blocked storage never throws", async () => {
    const { kernel, kernelSnapshot, readBootPrefs } = await loadStore(fakeStorage({}, true));
    expect(kernelSnapshot().mode).toBe("human");
    expect(() => kernel.setMode("shell")).not.toThrow();
    expect(kernelSnapshot().mode).toBe("shell");
    expect(readBootPrefs()).toEqual({ storedMode: null, menuSeen: false });
  });

  it("the boot handoff is taken exactly once", async () => {
    const { kernel } = await loadStore(fakeStorage());
    kernel.handOff([{ line: [{ text: "boot" }] }]);
    expect(kernel.takeHandoff()).toEqual([{ line: [{ text: "boot" }] }]);
    expect(kernel.takeHandoff()).toBeNull();
  });
});
