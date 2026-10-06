import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { bootLog, bootLogItems, bootScript, decideBoot, isLateHydration, type BootSignals, type Mode } from "@/core/boot";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";

const base: BootSignals = {
  storedMode: null,
  menuSeen: false,
  referrer: "",
  cmdParam: null,
  modeParam: null,
  forceBoot: false,
  isMobile: false,
  lateHydration: false,
};
const sig = (patch: Partial<BootSignals>): BootSignals => ({ ...base, ...patch });
const textOf = (items: ReturnType<typeof bootLogItems>) =>
  items.map((i) => ("line" in i ? i.line.map((s) => s.text).join("") : "")).join("\n");

describe("decideBoot", () => {
  it("first visit shows the menu with recruiter preselected and a 3 s countdown", () => {
    expect(decideBoot(base)).toEqual({ show: true, preselect: "human", countdownMs: 3000, target: "human" });
  });

  it("mobile gets a 2 s countdown and still prefers recruiter", () => {
    expect(decideBoot(sig({ isMobile: true }))).toMatchObject({ show: true, preselect: "human", countdownMs: 2000 });
  });

  it("developer referrers preselect the shell (subdomains too) but still show the menu", () => {
    for (const referrer of ["https://github.com/someone", "https://news.ycombinator.com/item?id=1", "https://www.dev.to/x", "https://gist.github.com/x"]) {
      expect(decideBoot(sig({ referrer })), referrer).toMatchObject({ show: true, preselect: "shell" });
    }
    for (const referrer of ["https://www.linkedin.com/feed", "https://mail.google.com/", "not a url", "https://notgithub.com/"]) {
      expect(decideBoot(sig({ referrer })).preselect, referrer).toBe("human");
    }
  });

  it("returning visitors skip the menu and go to their stored mode", () => {
    expect(decideBoot(sig({ menuSeen: true, storedMode: "shell" }))).toMatchObject({ show: false, target: "shell" });
    expect(decideBoot(sig({ menuSeen: true, storedMode: "human" }))).toMatchObject({ show: false, target: "human" });
  });

  it("partial storage shows the menu", () => {
    expect(decideBoot(sig({ menuSeen: true, storedMode: null })).show).toBe(true);
    expect(decideBoot(sig({ menuSeen: false, storedMode: "shell" })).show).toBe(true);
  });

  it("explicit mode and cmd params skip the menu", () => {
    expect(decideBoot(sig({ modeParam: "shell" }))).toMatchObject({ show: false, preselect: "shell", target: "shell" });
    expect(decideBoot(sig({ modeParam: "human", menuSeen: true, storedMode: "shell" }))).toMatchObject({ show: false, target: "human" });
    expect(decideBoot(sig({ cmdParam: "ls" }))).toMatchObject({ show: false, target: "shell" });
    expect(decideBoot(sig({ modeParam: "bogus" }))).toMatchObject({ show: true, preselect: "human" });
  });

  it("?boot=1 always shows the menu", () => {
    expect(decideBoot(sig({ forceBoot: true, menuSeen: true, storedMode: "shell" })).show).toBe(true);
    expect(decideBoot(sig({ forceBoot: true, lateHydration: true })).show).toBe(true);
  });

  it("late hydration never shows the menu and stays on the recruiter page", () => {
    expect(decideBoot(sig({ lateHydration: true }))).toMatchObject({ show: false, target: "human" });
    expect(decideBoot(sig({ lateHydration: true, referrer: "https://github.com/" }))).toMatchObject({ show: false, target: "human" });
  });
});

describe("bootLog", () => {
  it("builds lines from real content", () => {
    const lines = bootLog(portfolio);
    expect(lines.map((l) => l.id)).toEqual(["identity", "systems", "index", "graph"]);
    expect(lines[0].detail).toContain(portfolio.identity.role);
    expect(lines[1].slugs).toEqual(portfolio.systems.map((s) => s.slug));
    expect(lines[2].detail).toBe(`${portfolio.capabilities.length} capabilities · ${portfolio.technologies.length} technologies`);
  });

  it("an empty portfolio still yields the identity line and never throws", () => {
    const empty: Portfolio = { ...portfolio, systems: [], capabilities: [], technologies: [], experience: [] };
    expect(bootLog(empty).map((l) => l.id)).toEqual(["identity"]);
  });

  it("renders as shell transcript items", () => {
    const text = textOf(bootLogItems(bootLog(portfolio)));
    expect(text).toContain("KERNEL 1.0 (tty1)");
    expect(text).toContain("[ ok ] mount /systems");
  });
});

/** Runs the inline script against fake browser globals. */
function runScript(opts: { path?: string; search?: string; storage?: Record<string, string> | "blocked" }) {
  const store = opts.storage === "blocked" ? null : { ...(opts.storage ?? {}) };
  const dataset: Record<string, string> = {};
  let replaced: string | null = null;
  const localStorage = {
    getItem(k: string) {
      if (!store) throw new Error("blocked");
      return k in store ? store[k] : null;
    },
    setItem(k: string, v: string) {
      if (!store) throw new Error("blocked");
      store[k] = v;
    },
  };
  const context = {
    document: { documentElement: { dataset } },
    location: { pathname: opts.path ?? "/", search: opts.search ?? "", replace: (u: string) => (replaced = u) },
    URLSearchParams,
    get localStorage() {
      if (!store) throw new Error("blocked");
      return localStorage;
    },
  };
  vm.runInNewContext(bootScript(), context);
  return { boot: dataset.boot ?? null, replaced, store };
}

describe("bootScript", () => {
  it("marks first visits for the overlay", () => {
    expect(runScript({}).boot).toBe("on");
  });

  it("does nothing outside the front page", () => {
    expect(runScript({ path: "/systems" })).toMatchObject({ boot: null, replaced: null });
  });

  it("blocked storage behaves as a first visit", () => {
    expect(runScript({ storage: "blocked" })).toMatchObject({ boot: "on", replaced: null });
  });

  it("?mode= persists the choice", () => {
    const r = runScript({ search: "?mode=shell" });
    expect(r).toMatchObject({ boot: null, replaced: "/shell" });
    expect(r.store).toMatchObject({ "kernel:mode": "shell", "kernel:bootmenu": "seen" });
  });

  it("script and decideBoot agree on every signal combination", () => {
    const modes: (Mode | null)[] = [null, "human", "shell"];
    const params = ["", "?mode=human", "?mode=shell", "?mode=bogus", "?boot=1"];
    for (const storedMode of modes)
      for (const menuSeen of [false, true])
        for (const search of params) {
          const storage: Record<string, string> = {};
          if (storedMode) storage["kernel:mode"] = storedMode;
          if (menuSeen) storage["kernel:bootmenu"] = "seen";
          const q = new URLSearchParams(search);
          const d = decideBoot(sig({ storedMode, menuSeen, modeParam: q.get("mode"), forceBoot: q.get("boot") === "1" }));
          const r = runScript({ search, storage });
          const label = JSON.stringify({ storedMode, menuSeen, search });
          expect(r.boot === "on", label).toBe(d.show);
          expect(r.replaced === "/shell", label).toBe(!d.show && d.target === "shell");
        }
  });
});

describe("hydration lateness", () => {
  it("is measured from the pre-paint script, not from navigation start", () => {
    expect(isLateHydration(2600, "1200")).toBe(false); // slow server, fast JS: 1.4 s after the cover appeared
    expect(isLateHydration(2800, "1200")).toBe(true);
    expect(isLateHydration(400, undefined)).toBe(false);
    expect(isLateHydration(1600, undefined)).toBe(true); // no stamp: fall back to navigation start
  });

  it("the script stamps when it covered the page", () => {
    const store: Record<string, string> = {};
    const dataset: Record<string, string> = {};
    vm.runInNewContext(bootScript(), {
      document: { documentElement: { dataset } },
      location: { pathname: "/", search: "", replace: () => {} },
      URLSearchParams,
      performance: { now: () => 812.4 },
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) },
    });
    expect(dataset).toMatchObject({ boot: "on", bootAt: "812" });
  });
});
