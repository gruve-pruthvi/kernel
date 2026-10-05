import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { run, seq } from "./helpers";

describe("ls", () => {
  it("lists the root with clickable entries", () => {
    const { res, text } = run("ls");
    expect(text).toContain("systems/");
    expect(text).toContain("README.md");
    const segs = "line" in res.output[0] ? res.output[0].line : [];
    expect(segs.find((s) => s.text === "systems/")).toMatchObject({ tone: "dir", run: "cd systems" });
    expect(segs.find((s) => s.text === "README.md")).toMatchObject({ run: "cat README.md" });
    expect(segs.find((s) => s.text === "resume.pdf@")).toMatchObject({ tone: "link", href: portfolio.identity.links.resume });
  });

  it("lists a path, a system and a view", () => {
    expect(run("ls systems").text).toContain("atlas/");
    const atlas = run("ls systems/atlas");
    expect(atlas.text).toContain("architecture*");
    const segs = "line" in atlas.res.output[0] ? atlas.res.output[0].line : [];
    expect(segs.find((s) => s.text === "architecture*")).toMatchObject({ tone: "view", run: "open systems/atlas/architecture" });
  });

  it("supports -l and multiple paths", () => {
    expect(run("ls -l systems").text).toMatch(/s\s+\d+\s+atlas\//);
    const both = run("ls skills stack").text;
    expect(both).toContain("skills:");
    expect(both).toContain("stack:");
  });

  it("errors on missing paths and unknown flags", () => {
    const missing = run("ls nope");
    expect(missing.text).toBe("ls: cannot access 'nope': No such file or directory");
    expect(missing.res.exitCode).toBe(1);
    const bad = run("ls --bogus");
    expect(bad.text).toBe("ls: unknown flag --bogus\nusage: ls [-l] [path…]");
  });
});

describe("cd / pwd", () => {
  it("changes directory and prints it", () => {
    expect(seq("cd systems/atlas", "pwd").output).toEqual([{ line: [{ text: "~/systems/atlas", tone: "dir" }] }]);
    expect(seq("cd systems", "cd atlas", "cd ..", "pwd").state.cwd).toEqual(["systems"]);
    expect(seq("cd systems", "cd").state.cwd).toEqual([]);
  });

  it("supports cd - and errors", () => {
    const back = seq("cd systems", "cd ~/skills", "cd -");
    expect(back.state.cwd).toEqual(["systems"]);
    expect(run("cd nope").text).toBe("cd: no such file or directory: nope");
    expect(run("cd README.md").text).toBe("cd: not a directory: README.md");
    expect(run("cd a b").text).toBe("cd: too many arguments");
  });
});

describe("tree", () => {
  it("draws a depth-limited tree with a summary", () => {
    const { text } = run("tree -L 1");
    expect(text.split("\n")[0]).toBe("~");
    expect(text).toContain("├── systems/");
    expect(text).not.toContain("atlas/");
    expect(text).toMatch(/\d+ directories, \d+ files$/);
    expect(run("tree systems").text).toContain("│   ├── README.md");
    expect(run("tree -L 0").text).toBe("tree: -L needs a positive whole number");
  });
});

describe("executor", () => {
  it("records history and ignores blank input", () => {
    const res = seq("ls", "pwd", "pwd");
    expect(res.state.history.map((h) => h.command)).toEqual(["ls", "pwd"]);
    expect(run("   ").res.output).toEqual([]);
  });

  it("suggests the nearest command and offers plain English", () => {
    const { text, res } = run("sl");
    expect(text).toContain("kernel: command not found: sl");
    expect(text).toContain("did you mean ls");
    expect(res.exitCode).toBe(1);
  });

  it("routes plain-English input to ask", () => {
    expect(run("what has been built with agents").res.effects).toEqual([
      { type: "ask", question: "what has been built with agents" },
    ]);
    expect(run("hello?").res.effects).toEqual([{ type: "ask", question: "hello?" }]);
    expect(run("rm -rf /").res.effects).toEqual([]);
    expect(run("rm -rf /").text).toContain("command not found: rm");
  });

  it("runs ; lists in order and reports syntax errors", () => {
    expect(run("cd systems; pwd").text).toBe("~/systems");
    expect(run("ls |").text).toBe("kernel: syntax error near unexpected token '|'");
  });

  it("expands history and echoes the expansion", () => {
    const res = seq("pwd", "!!");
    expect(res.output[0]).toEqual({ line: [{ text: "pwd", tone: "faint" }] });
    expect(res.state.history.at(-1)?.command).toBe("pwd");
  });

  it("caps pipelines when asked", async () => {
    const { execute, initialState } = await import("@/core/shell/execute");
    const res = execute("pwd; pwd; pwd", initialState(0), portfolio, 0, { maxPipelines: 2 });
    expect(res.output.filter((o) => "line" in o && o.line[0]?.text === "~")).toHaveLength(2);
    expect(JSON.stringify(res.output)).toContain("skipped 1 more command");
  });
});
