import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { COMMANDS } from "@/core/shell/commands";
import { execute, initialState } from "@/core/shell/execute";
import { handleOf, neofetchData, welcome } from "@/core/shell/welcome";
import { NOW, run, seq, textOf } from "./helpers";

describe("man", () => {
  it("every command has a complete manual", () => {
    for (const c of COMMANDS) {
      const page = run(`man ${c.name}`).text;
      for (const section of ["NAME", "SYNOPSIS", "DESCRIPTION", "EXAMPLES", "SEE ALSO"]) expect(page, c.name).toContain(section);
      expect(page.includes("OPTIONS"), c.name).toBe(Boolean(c.flags && Object.keys(c.flags).length));
      expect(c.examples.length, c.name).toBeGreaterThan(0);
      expect(c.seeAlso.length, c.name).toBeGreaterThan(0);
    }
  });

  it("generates system and kernel pages", () => {
    const atlas = run("man atlas").text;
    expect(atlas).toContain("ATLAS(7)");
    expect(atlas).toContain(portfolio.systems[0].tagline);
    expect(atlas).toContain("run atlas");
    const kernel = run("man kernel").text;
    for (const c of COMMANDS) expect(kernel).toContain(c.name);
  });

  it("handles missing topics", () => {
    expect(run("man").text).toBe("What manual page do you want?\ntry man kernel");
    expect(run("man nope").text.split("\n")[0]).toBe("No manual entry for nope");
    expect(run("man gerp").text).toContain("grep");
  });
});

describe("help", () => {
  it("lists groups and topics", () => {
    const text = run("help").text;
    for (const g of ["NAVIGATION", "FILES", "SEARCH", "INFO"]) expect(text).toContain(g);
    expect(run("help shortcuts").text).toContain("Ctrl+R");
    expect(run("help links").text).toContain("/shell?cmd=");
    expect(run("help nope").text).toBe("help: no topic nope\ntopics: navigation, search, shortcuts, links");
  });
});

describe("history", () => {
  it("numbers entries and links them", () => {
    const res = seq("ls", "pwd", "history");
    expect(textOf(res.output)).toBe("   1  ls  ↗\n   2  pwd  ↗\n   3  history  ↗");
    const first = res.output[0];
    expect("line" in first && first.line.find((s) => s.href)?.href).toBe("/shell?cmd=ls");
    expect("line" in first && first.line.find((s) => s.run)?.run).toBe("ls");
  });

  it("filters to this session with timestamps", () => {
    const state = { ...initialState(NOW, [{ command: "old", at: NOW - 86_400_000 }]) };
    const res = execute("history --session", state, portfolio, NOW);
    const text = textOf(res.output);
    expect(text).not.toContain("old");
    expect(text).toMatch(/^\s+2 {2}\d\d:\d\d {2}history/);
  });
});

describe("whoami / id / resume / export", () => {
  it("whoami renders the neofetch block", () => {
    expect(run("whoami").res.output).toEqual([{ block: { kind: "neofetch" } }]);
  });

  it("neofetch data is derived from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = p.systems.slice(0, 2);
    const rows = Object.fromEntries(neofetchData(p).rows.map((r) => [r.label, r.value]));
    const prod = p.systems.filter((s) => s.status === "production").length;
    expect(rows.systems).toBe(`2 (${prod} in production)`);
    expect(rows.capabilities).toBe(String(p.capabilities.length));
    expect(neofetchData(portfolio).handle).toBe(handleOf(portfolio));
  });

  it("id lists capabilities as groups", () => {
    expect(run("id").text).toBe(`uid=${handleOf(portfolio)} groups=${portfolio.capabilities.map((c) => c.id).join(",")}`);
  });

  it("resume summarises from content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems[0].impact = [{ label: "fewer pages", value: "+999%" }];
    const text = textOf(execute("resume", initialState(0), p, 0).output);
    expect(text).toContain(p.identity.name);
    expect(text).toContain("+999% fewer pages");
    for (const s of p.systems.filter((x) => x.featured).slice(0, 3)) expect(text).toContain(s.name);
    expect(text).toContain(p.identity.links.email);
  });

  it("export downloads the resume", () => {
    expect(run("export resume.pdf").res.effects).toEqual([{ type: "download", href: portfolio.identity.links.resume }]);
    expect(run("export cv.doc").text).toBe('export: unknown target "cv.doc"\nusage: export resume.pdf');
    const p: Portfolio = structuredClone(portfolio);
    p.identity.links.resume = undefined;
    expect(textOf(execute("export resume.pdf", initialState(0), p, 0).output)).toBe("export: no resume published");
  });
});

describe("welcome and deep links", () => {
  it("welcome shows neofetch, hints and system names", () => {
    const items = welcome(portfolio);
    expect(items[0]).toEqual({ block: { kind: "neofetch" } });
    const text = textOf(items);
    for (const s of portfolio.systems) expect(text).toContain(s.slug);
    expect(text).toContain("man kernel");
  });

  it("unknown deep-linked commands are just not found", () => {
    expect(textOf(execute("rm -rf /", initialState(0), portfolio, 0).output)).toContain("command not found: rm");
  });

});
