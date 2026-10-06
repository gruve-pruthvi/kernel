import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { run } from "./helpers";

describe("open", () => {
  it("opens the full case study with --full", () => {
    expect(run("open atlas --full").res.effects).toEqual([{ type: "navigate", href: "/systems/atlas" }]);
    expect(run("open graph --full").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
  });

  it("opens systems, views, files, pages and the resume", () => {
    expect(run("open atlas").res.effects).toEqual([{ type: "openView", view: { type: "architecture", slug: "atlas" } }]);
    expect(run("open graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("open skills/graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("open README.md").res.effects).toEqual([{ type: "openView", view: { type: "reader", path: ["README.md"] } }]);
    expect(run("open trace").res.effects).toEqual([{ type: "navigate", href: "/trace" }]);
    expect(run("open contact").res.effects).toEqual([{ type: "navigate", href: "/connect" }]);
    expect(run("open resume").res.effects).toEqual([{ type: "download", href: portfolio.identity.links.resume }]);
  });

  it("explains failures", () => {
    expect(run("open").text).toBe("open: missing target\nusage: open <system | graph | resume | page | path>");
    expect(run("open skills").text).toBe("open: skills is a directory\ntry cd skills");
    expect(run("open nope").text).toBe('open: cannot find "nope"');
  });
});

describe("run", () => {
  it("simulates by slug or from the system directory", () => {
    expect(run("run atlas").res.effects).toEqual([{ type: "simulate", slug: "atlas" }]);
    expect(run("run", ["systems", "relay"]).res.effects).toEqual([{ type: "simulate", slug: "relay" }]);
    expect(run("run", ["systems", "relay", "x"]).res.effects).toEqual([{ type: "simulate", slug: "relay" }]);
  });

  it("explains missing or simulation-less systems", () => {
    expect(run("run").text).toMatch(/^run: which system\?/);
    expect(run("run ledger").text).toBe("run: Ledger has no simulation yet\ntry open ledger");
    expect(run("run atlsa").text).toBe('run: no system "atlsa"\ndid you mean run atlas');
  });
});

describe("graph / git / gui / recruiter / clear / easter eggs", () => {
  it("graph focuses resolved nodes", () => {
    expect(run("graph langgraph atlas nope").res.effects).toEqual([
      { type: "openView", view: { type: "graph", focus: ["tech:langgraph", "system:atlas"] } },
    ]);
    expect(run("graph").res.effects).toEqual([{ type: "openView", view: { type: "graph", focus: [] } }]);
    expect(run("graph nope").text).toBe('graph: nothing matches "nope"');
  });

  it("gui, recruiter, clear", () => {
    expect(run("gui").res.effects).toEqual([{ type: "navigate", href: "/systems" }]);
    expect(run("gui trace").res.effects).toEqual([{ type: "navigate", href: "/trace" }]);
    expect(run("gui nope").text).toBe("gui: no page nope\npages: systems, graph, trace, human, connect");
    expect(run("recruiter").res.effects).toEqual([{ type: "mode", mode: "human" }]);
    expect(run("clear").res.effects).toEqual([{ type: "clear" }]);
  });

  it("easter eggs use real contact data", () => {
    expect(run("sudo hire").text).toContain(portfolio.identity.links.email);
    expect(run("sudo rm").text).toBe("sudo: permission denied — only `sudo hire` is allowed");
    expect(run("exit").text).toContain("gui");
  });

  it("effects of non-final stages are discarded", () => {
    for (const cmd of ["open atlas | head", "run atlas | grep x", "clear | cat", "recruiter | wc -l"]) {
      expect(run(cmd).res.effects, cmd).toEqual([]);
    }
  });
});
