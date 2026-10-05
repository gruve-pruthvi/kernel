import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { COMMANDS } from "@/core/shell/commands";
import { autosuggest, commonPrefix, complete, describeCandidates, ghost } from "@/core/shell/complete";

const c = (input: string, cwd: string[] = []) => complete(input, cwd, portfolio, COMMANDS);

describe("complete", () => {
  it("completes command names", () => {
    expect(c("gr")).toEqual(["grep ", "graph "]);
    expect(c("ls")).toEqual(["ls "]);
    expect(c("")).toEqual([]);
  });

  it("completes paths relative to the cwd, dirs only for cd", () => {
    expect(c("cd sy")).toEqual(["cd systems/"]);
    expect(c("cd systems/a")).toEqual(["cd systems/atlas/"]);
    expect(c("cat systems/atlas/d")).toEqual(["cat systems/atlas/decisions.md"]);
    expect(c("cd R")).toEqual([]);
    expect(c("cat R")).toEqual(["cat README.md"]);
    expect(c("cat ", ["systems", "atlas"])).toContain("cat README.md");
  });

  it("completes slugs, topics, pages and flags", () => {
    expect(c("run a")).toEqual(["run atlas"]);
    expect(c("run l")).toEqual([]);
    expect(c("man gr")).toEqual(["man grep", "man graph"]);
    expect(c("help sh")).toEqual(["help shortcuts"]);
    expect(c("gui t")).toEqual(["gui trace"]);
    expect(c("graph lang")).toEqual(["graph langgraph", "graph langchain"]);
    expect(c("grep --i")).toEqual(["grep --ignoreCase", "grep --invert"]);
    expect(c("find . -na")).toEqual(["find . -name"]);
    expect(c("open at")).toEqual(["open atlas"]);
  });

  it("completes only the last stage of a pipeline", () => {
    expect(c("cat README.md | he")).toEqual(["cat README.md | head ", "cat README.md | help "]);
    expect(c("ls; cd sk")).toEqual(["ls; cd skills/"]);
  });
});

describe("autosuggest (fish-style)", () => {
  it("prefers the newest matching history entry, then completion", () => {
    const history = ["grep -i rag .", "cd systems/atlas", "grep -n Hybrid systems"];
    expect(autosuggest("grep", history, c("grep"))).toBe(" -n Hybrid systems");
    expect(autosuggest("cd sy", history, c("cd sy"))).toBe("stems/atlas");
    expect(autosuggest("cat R", history, c("cat R"))).toBe("EADME.md");
    expect(autosuggest("", history, [])).toBe("");
    expect(autosuggest("grep -n Hybrid systems", history, [])).toBe("");
  });
});

describe("describeCandidates (completion menu)", () => {
  const d = (input: string, cwd: string[] = []) => describeCandidates(c(input, cwd), cwd, portfolio, COMMANDS);
  it("labels commands with their summary", () => {
    expect(d("gr")).toEqual([
      { value: "grep ", label: "grep", detail: COMMANDS.find((x) => x.name === "grep")!.summary },
      { value: "graph ", label: "graph", detail: COMMANDS.find((x) => x.name === "graph")!.summary },
    ]);
  });
  it("labels paths, systems, flags and topics", () => {
    const atlas = portfolio.systems.find((s) => s.slug === "atlas")!;
    expect(d("cd systems/a")[0]).toEqual({ value: "cd systems/atlas/", label: "atlas/", detail: atlas.tagline });
    expect(d("cat R")[0]).toMatchObject({ label: "README.md", detail: "file" });
    expect(d("open skills/g")[0]).toMatchObject({ label: "graph", detail: "view" });
    expect(d("run a")[0]).toMatchObject({ label: "atlas", detail: atlas.tagline });
    expect(d("grep --i")[0]).toMatchObject({ label: "--ignoreCase", detail: "ignore case" });
    expect(d("graph lang")[0]).toMatchObject({ label: "langgraph", detail: "LangGraph" });
    expect(d("help sh")[0]).toMatchObject({ label: "shortcuts", detail: "help topic" });
    expect(d("cd ")[0].detail).toBe("directory");
  });
});

describe("ghost / commonPrefix", () => {
  it("returns the remainder of the first candidate", () => {
    expect(ghost("cd sy", ["cd systems/"])).toBe("stems/");
    expect(ghost("x", [])).toBe("");
    expect(commonPrefix(["graph langgraph", "graph langchain"])).toBe("graph lang");
    expect(commonPrefix([])).toBe("");
  });
});
