import { describe, expect, it } from "vitest";
import { highlight } from "@/core/shell/commands/search";
import { run } from "./helpers";

describe("grep", () => {
  it("searches recursively with path:line:text and highlights", () => {
    const { res, text } = run("grep -n Hybrid systems");
    expect(text).toMatch(/^systems\/atlas\/decisions\.md:\d+:/m);
    const first = res.output[0];
    expect("line" in first && first.line.some((s) => s.tone === "match" && s.text === "Hybrid")).toBe(true);
    expect("line" in first && first.line[0]).toMatchObject({ tone: "link", run: expect.stringMatching(/^less /) });
  });

  it("supports -i, -l, -v and defaults to the cwd", () => {
    expect(run("grep -il hybrid").text).toContain("systems/atlas/README.md");
    expect(run("grep -il hybrid").text.split("\n").every((l) => !l.includes(":"))).toBe(true);
    expect(run("grep -i hybrid", ["systems"]).text).toMatch(/^atlas\//m);
    expect(run("grep -v e contact.txt").text).not.toContain("email");
  });

  it("filters stdin", () => {
    expect(run("cat contact.txt | grep email").text).toMatch(/^email/);
  });

  it("returns exit 1 with no matches and errors on missing paths", () => {
    const none = run("grep zzzzqqq .");
    expect(none.res.exitCode).toBe(1);
    expect(none.res.output).toEqual([]);
    expect(run("grep x nope").text).toBe("grep: nope: No such file or directory");
    expect(run("grep").text).toBe("grep: missing pattern\nusage: grep [-i] [-n] [-l] [-v] <pattern> [path…]");
  });

  it("grep survives odd patterns", () => {
    expect(() => run(`grep "(" .`)).not.toThrow();
    expect(run(`grep "(" README.md`).res.exitCode).toBe(1);
    expect(() => run(`grep "" README.md`)).not.toThrow();
    expect(() => run(`grep -i ".*" .`)).not.toThrow();
    expect(highlight("abc", /x*/g)).toEqual([{ text: "abc" }]);
  });
});

describe("find", () => {
  it("filters by name glob and type", () => {
    const md = run("find . -name *.md").text.split("\n");
    expect(md).toContain("systems/atlas/README.md");
    expect(md.every((l) => l.endsWith(".md"))).toBe(true);
    const sys = run("find systems -type system").text.split("\n");
    expect(sys).toEqual(["systems/atlas", "systems/relay", "systems/beacon", "systems/ledger"]);
    expect(run("find -type view").text.split("\n")).toContain("skills/graph");
  });

  it("validates input", () => {
    expect(run("find -type x").text).toBe("find: -type must be one of f, d, view, system, link");
    expect(run("find nope").text).toBe("find: nope: No such file or directory");
  });
});

describe("which / whereis", () => {
  it("locates commands and entities", () => {
    expect(run("which ls").text).toBe("ls: shell builtin");
    expect(run("which atlas").text).toBe("~/systems/atlas");
    expect(run("which rag").text).toBe("~/skills/rag.md");
    expect(run("which kafka").text).toBe("~/stack/kafka.txt");
    const miss = run("which nope");
    expect(miss.text).toBe("which: no nope in kernel");
    expect(miss.res.exitCode).toBe(1);
  });

  it("finds every file mentioning a term", () => {
    const { text } = run("whereis kafka");
    expect(text.split("\n")[0]).toBe("kafka:");
    expect(text).toContain("~/stack/kafka.txt");
    expect(text).toContain("~/systems/ledger/stack.txt");
    expect(run("whereis zzzzqqq").text).toBe('whereis: nothing mentions "zzzzqqq"');
  });
});
