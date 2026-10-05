import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { buildFs, resolve } from "@/core/shell/fs";
import { run } from "./helpers";

const lines = (path: string) => {
  const n = resolve(buildFs(portfolio), [], path);
  return n?.kind === "file" ? n.lines : [];
};

describe("cat", () => {
  it("prints styled files", () => {
    const { res, text } = run("cat README.md");
    expect(text).toContain(portfolio.identity.name);
    expect(res.output[0]).toEqual({ line: [{ text: portfolio.identity.name, tone: "heading" }] });
  });

  it("concatenates multiple files and reports misses", () => {
    const { text, res } = run("cat contact.txt nope");
    expect(text).toContain(portfolio.identity.links.email);
    expect(text).toContain("cat: nope: No such file or directory");
    expect(res.exitCode).toBe(1);
  });

  it("explains directories, views and links", () => {
    expect(run("cat systems").text).toBe("cat: systems: Is a directory\ntry ls systems");
    expect(run("cat systems/atlas/architecture").res.effects).toEqual([
      { type: "openView", view: { type: "architecture", slug: "atlas" } },
    ]);
    const pdf = run("cat resume.pdf").res.output[0];
    expect("line" in pdf && pdf.line.some((s) => s.href === portfolio.identity.links.resume)).toBe(true);
    expect(run("cat").text).toBe("cat: missing file operand\nusage: cat <file…>");
  });
});

describe("less", () => {
  it("opens the reader pane", () => {
    expect(run("less README.md", ["systems", "atlas"]).res.effects).toEqual([
      { type: "openView", view: { type: "reader", path: ["systems", "atlas", "README.md"] } },
    ]);
    expect(run("less systems").text).toBe("less: systems: Is a directory\ntry ls systems");
    expect(run("less").text).toBe("less: missing file operand\nusage: less <file>");
  });
});

describe("head / tail / wc / echo", () => {
  it("slices files", () => {
    expect(run("head -n 2 README.md").res.output).toHaveLength(2);
    expect(run("head README.md").res.output).toHaveLength(Math.min(10, lines("README.md").length));
    expect(run("tail -n 1 contact.txt").text).toBe(lines("contact.txt").at(-1));
    expect(run("tail -n 0 contact.txt").res.output).toEqual([]);
    expect(run("head -n x README.md").text).toBe("head: -n needs a whole number");
    expect(run("head").text).toBe("head: missing file operand\nusage: head [-n N] [file]");
  });

  it("counts", () => {
    expect(run("wc -l README.md").text).toBe(`${lines("README.md").length} README.md`);
    expect(run("wc README.md").text).toMatch(/^\s*\d+\s+\d+\s+\d+ README\.md$/);
  });

  it("echoes", () => {
    expect(run(`echo hello   "big world"`).text).toBe("hello big world");
  });
});

describe("pipes", () => {
  it("feeds plain text between stages", () => {
    expect(run("cat README.md | head -n 1").text).toBe(portfolio.identity.name);
    expect(run("cat contact.txt | wc -l").text).toBe(String(lines("contact.txt").length));
    expect(run("echo a | cat").text).toBe("a");
  });

  it("effects of non-final stages are discarded", () => {
    const { res } = run("cat systems/atlas/architecture | head -n 1");
    expect(res.effects).toEqual([]);
    expect(res.output).toHaveLength(1);
  });

  it("stops the pipeline on a failing stage", () => {
    const { text, res } = run("cat nope | head");
    expect(text).toBe("cat: nope: No such file or directory");
    expect(res.exitCode).toBe(1);
  });
});
