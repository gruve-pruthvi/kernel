import { describe, expect, it } from "vitest";
import { checkIntegrity, portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { expandHistory } from "@/core/shell/parser";
import { nearest } from "@/core/shell/util";
import { run, seq } from "./helpers";

describe("typo distance counts a transposition as one edit", () => {
  it("prefers grep over tree for grpe", () => {
    expect(nearest("grpe", ["tree", "grep"])).toBe("grep");
  });
});

describe("A1.1 history expansion tracks both quote kinds", () => {
  it("keeps single-quoted !! literal even after an apostrophe inside double quotes", () => {
    expect(expandHistory(`echo "it's" '!!'`, ["ls"])).toEqual({ ok: true, line: `echo "it's" '!!'`, expanded: false });
  });
  it("expands !! after a double-quoted apostrophe", () => {
    expect(expandHistory(`echo "don't" !!`, ["ls"])).toEqual({ ok: true, line: `echo "don't" ls`, expanded: true });
  });
});

describe("A1.2 only the final pipeline stage changes shell state", () => {
  it("ignores cd in a non-final stage", () => {
    expect(run("cd systems | cat").res.state.cwd).toEqual([]);
  });
  it("applies cd in the final stage", () => {
    expect(run("echo x | cd systems").res.state.cwd).toEqual(["systems"]);
  });
});

describe("A1.3 typos with path-like arguments suggest instead of asking", () => {
  it("suggests cat for cta README.md", () => {
    const { res, text } = run("cta README.md");
    expect(res.effects).toEqual([]);
    expect(text).toContain("did you mean cat");
  });
  it("suggests grep for grpe rag .", () => {
    expect(run("grpe rag .").text).toContain("did you mean grep");
  });
  it("still asks real questions that mention files", () => {
    expect(run("what's in README.md").res.effects).toEqual([{ type: "ask", question: "what's in README.md" }]);
  });
});

describe("A1.4 cd with an empty argument is a no-op", () => {
  it("does not overwrite the previous directory", () => {
    expect(seq("cd systems", 'cd ""', "cd -").state.cwd).toEqual([]);
  });
});

describe("A3.9 integrity catches duplicate experience ids and commit hashes", () => {
  it("reports duplicate experience ids", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.experience[1].id = p.experience[0].id;
    expect(checkIntegrity(p)).toContain(`experience: duplicate id "${p.experience[0].id}"`);
  });
  it("reports duplicate commit hashes within an experience", () => {
    const p: Portfolio = structuredClone(portfolio);
    const e = p.experience[0];
    e.commits[1].hash = e.commits[0].hash;
    expect(checkIntegrity(p)).toContain(`experience.${e.id}.commits: duplicate hash "${e.commits[0].hash}"`);
  });
});
