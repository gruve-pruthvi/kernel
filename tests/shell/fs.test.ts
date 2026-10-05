import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { buildFs, displayPath, isDir, joinPath, normalise, pathOf, resolve, walk } from "@/core/shell/fs";
import { styleLine } from "@/core/shell/style";
import { globToRegExp, nearest } from "@/core/shell/util";

const fs = buildFs(portfolio);
const names = (path: string) => {
  const node = resolve(fs, [], path);
  return isDir(node) ? node.children.map((c) => c.name) : [];
};

describe("buildFs", () => {
  it("lays out the top level", () => {
    expect(names("~")).toEqual(["systems", "skills", "stack", "README.md", "about.md", "career.log", "contact.txt", "resume.pdf"]);
  });

  it("creates one system directory per system with core files", () => {
    expect(names("systems")).toEqual(portfolio.systems.map((s) => s.slug));
    for (const s of portfolio.systems) {
      const files = names(`systems/${s.slug}`);
      expect(files).toEqual(expect.arrayContaining(["README.md", "architecture", "decisions.md", "stack.txt"]));
      expect(resolve(fs, [], `systems/${s.slug}`)?.kind).toBe("system");
    }
  });

  it("only creates optional files when content exists", () => {
    expect(names("systems/atlas")).toEqual(expect.arrayContaining(["tradeoffs.md", "impact.txt", "links.txt"]));
    expect(names("systems/ledger")).not.toContain("tradeoffs.md");
    expect(names("systems/ledger")).not.toContain("links.txt");
  });

  it("is driven by content", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems[0].impact = undefined;
    p.identity.links.resume = undefined;
    const alt = buildFs(p);
    const sys = resolve(alt, [], `systems/${p.systems[0].slug}`);
    expect(isDir(sys) && sys.children.some((c) => c.name === "impact.txt")).toBe(false);
    expect(resolve(alt, [], "resume.pdf")).toBeUndefined();
  });

  it("has skill, stack and graph entries", () => {
    expect(names("skills")).toEqual([...portfolio.capabilities.map((c) => `${c.id}.md`), "graph"]);
    expect(names("stack")).toEqual(portfolio.technologies.map((t) => `${t.id}.txt`));
    expect(resolve(fs, [], "skills/graph")?.kind).toBe("view");
  });

  it("is memoised", () => {
    expect(buildFs(portfolio)).toBe(fs);
  });
});

describe("normalise and resolve edge cases", () => {
  it("handles relative, absolute, dot and dot-dot", () => {
    expect(normalise(["systems", "atlas"], "../relay")).toEqual(["systems", "relay"]);
    expect(normalise(["systems"], "~/skills")).toEqual(["skills"]);
    expect(normalise(["systems"], "/stack")).toEqual(["stack"]);
    expect(normalise(["systems"], "./atlas/")).toEqual(["systems", "atlas"]);
    expect(normalise(["systems"], "../../..")).toEqual([]);
    expect(normalise([], "////")).toEqual([]);
    expect(normalise(["systems"], "~")).toEqual([]);
  });

  it("resolves files, dirs and misses", () => {
    expect(resolve(fs, [], "systems/atlas/README.md")?.kind).toBe("file");
    expect(resolve(fs, ["systems"], "atlas/")?.kind).toBe("system");
    expect(resolve(fs, [], "systems/atlas/README.md/more")).toBeUndefined();
    expect(resolve(fs, [], "nope")).toBeUndefined();
    expect(resolve(fs, [], "")).toBe(fs);
  });

  it("formats paths", () => {
    expect(pathOf([])).toBe("~");
    expect(pathOf(["systems", "atlas"])).toBe("~/systems/atlas");
    expect(joinPath(".", "a")).toBe("a");
    expect(joinPath("systems/", "atlas")).toBe("systems/atlas");
    expect(displayPath(["systems", "atlas", "README.md"], ["systems"])).toBe("atlas/README.md");
    expect(displayPath(["skills", "rag.md"], ["systems"])).toBe("~/skills/rag.md");
    expect(displayPath(["systems"], ["systems"])).toBe(".");
  });

  it("walks depth-first with absolute parts", () => {
    const entries = walk(resolve(fs, [], "systems/atlas")!, ["systems", "atlas"]);
    expect(entries[0].parts).toEqual(["systems", "atlas"]);
    expect(entries.map((e) => e.parts.join("/"))).toContain("systems/atlas/README.md");
  });
});

describe("styleLine", () => {
  it("tones markdown-ish lines", () => {
    expect(styleLine("# Atlas")).toEqual([{ text: "Atlas", tone: "heading" }]);
    expect(styleLine("## Role")[0].tone).toBe("accent");
    expect(styleLine("- item")[0]).toEqual({ text: "› ", tone: "accent" });
    expect(styleLine("● chosen")[0].tone).toBe("accent");
    expect(styleLine("○ rejected")[0].tone).toBe("faint");
    expect(styleLine("→ because")[0].tone).toBe("ok");
    expect(styleLine("a **b** c").map((s) => s.tone)).toEqual(["text", "accent", "text"]);
  });
});

describe("util", () => {
  it("nearest and glob", () => {
    expect(nearest("sl", ["ls", "cd"])).toBe("ls");
    expect(nearest("zzzz", ["ls"])).toBeUndefined();
    expect(globToRegExp("*.md").test("README.md")).toBe(true);
    expect(globToRegExp("*.md").test("stack.txt")).toBe(false);
    expect(globToRegExp("a?las").test("atlas")).toBe(true);
    expect(globToRegExp("(x)").test("(x)")).toBe(true);
  });
});
