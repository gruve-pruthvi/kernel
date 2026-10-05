import { describe, expect, it } from "vitest";
import { complete, parseCommand, runCommand, suggest, tokenize } from "@/core/command";
import { portfolio } from "@/core/content";

const run = (input: string, recruiter = false) => runCommand(input, portfolio, { recruiter });
const text = (input: string) => run(input).lines.map((l) => l.text).join("\n");

describe("tokenize / parseCommand", () => {
  it("groups quoted strings", () => {
    expect(tokenize(`ask "what is rag?" now`)).toEqual(["ask", "what is rag?", "now"]);
    expect(tokenize(`ask 'single quotes'`)).toEqual(["ask", "single quotes"]);
    expect(tokenize(`ask "unterminated quote`)).toEqual(["ask", "unterminated quote"]);
  });

  it("parses value and boolean flags", () => {
    expect(parseCommand("systems --tech kafka")).toEqual({ name: "systems", args: [], flags: { tech: "kafka" } });
    expect(parseCommand("inspect atlas --open")).toEqual({ name: "inspect", args: ["atlas"], flags: { open: true } });
    expect(parseCommand("systems --cap=rag")).toEqual({ name: "systems", args: [], flags: { cap: "rag" } });
    expect(parseCommand("   ")).toBeNull();
  });

  it("handles messy input", () => {
    expect(parseCommand("  INSPECT   atlas  ")).toEqual({ name: "inspect", args: ["atlas"], flags: {} });
    expect(run("systems --tech").lines[0].kind).toBe("error");
    expect(() => run(`ask "what is "rag""`)).not.toThrow();
    expect(() => run("--")).not.toThrow();
  });
});

describe("runCommand", () => {
  it("help lists every command", () => {
    const out = text("help");
    for (const name of ["whoami", "systems", "inspect", "graph", "trace", "stack", "ask", "recruiter", "contact", "clear"]) {
      expect(out).toContain(name);
    }
  });

  it("whoami prints identity", () => {
    expect(text("whoami")).toContain(portfolio.identity.role);
  });

  it("systems lists and filters", () => {
    expect(text("systems")).toContain("Atlas");
    const kafka = text("systems --tech kafka");
    expect(kafka).toContain("Ledger");
    expect(kafka).not.toContain("Relay");
    expect(run("systems --tech cobol").lines[0].kind).toBe("error");
  });

  it("inspect prints architecture and optionally opens", () => {
    const res = run("inspect atlas");
    expect(res.lines.map((l) => l.text).join("\n")).toContain("Hybrid Retriever");
    expect(res.actions).toEqual([]);
    expect(run("inspect atlas --open").actions).toEqual([{ type: "openSystem", slug: "atlas" }]);
  });

  it("inspect unknown suggests nearest slug", () => {
    const res = run("inspect atlsa");
    expect(res.lines[0].kind).toBe("error");
    expect(res.lines.map((l) => l.text).join(" ")).toContain("atlas");
  });

  it("graph focuses a node", () => {
    expect(run("graph langgraph").actions).toEqual([{ type: "highlightGraph", ids: ["tech:langgraph"] }]);
    expect(run("graph").actions).toEqual([{ type: "navigate", path: "/graph" }]);
    expect(run("graph nope").lines[0].kind).toBe("error");
  });

  it("trace shows commits and navigates", () => {
    const res = run("trace");
    expect(res.lines.some((l) => l.text.includes("7f3b2d1"))).toBe(true);
    expect(res.actions).toEqual([{ type: "navigate", path: "/trace" }]);
  });

  it("stack groups and filters by category", () => {
    expect(text("stack")).toContain("LangGraph");
    const ai = text("stack --ai");
    expect(ai).toContain("LangGraph");
    expect(ai).not.toContain("Kafka");
  });

  it("ask hands off to query", () => {
    expect(run(`ask "what is atlas?"`).ask).toBe("what is atlas?");
    expect(run("ask what is atlas").ask).toBe("what is atlas");
    expect(run("ask").lines[0].kind).toBe("error");
  });

  it("recruiter toggles", () => {
    expect(run("recruiter", false).actions).toEqual([{ type: "toggleRecruiter", on: true }]);
    expect(run("recruiter", true).actions).toEqual([{ type: "toggleRecruiter", on: false }]);
    expect(run("recruiter on", true).actions).toEqual([{ type: "toggleRecruiter", on: true }]);
  });

  it("contact, resume, clear", () => {
    expect(text("contact")).toContain(portfolio.identity.links.email);
    expect(run("resume").lines.some((l) => l.kind === "link")).toBe(true);
    expect(run("clear").clear).toBe(true);
  });

  it("easter eggs", () => {
    expect(text("sudo hire")).toContain("Candidate approved");
    expect(run("sudo hire").actions).toEqual([{ type: "navigate", path: "/connect" }]);
    expect(text("rm -rf /")).toContain("Permission denied");
  });

  it("unknown command suggests", () => {
    const res = run("sytems");
    expect(res.lines[0]).toMatchObject({ kind: "error", text: "command not found: sytems" });
    expect(res.lines[1].text).toContain("systems");
  });
});

describe("suggest / complete", () => {
  it("suggests within distance 2", () => {
    expect(suggest("hlep")).toBe("help");
    expect(suggest("xyzzy")).toBeUndefined();
  });

  it("completes commands and arguments", () => {
    expect(complete("ins", portfolio)).toEqual(["inspect "]);
    expect(complete("inspect re", portfolio)).toEqual(["inspect relay"]);
    expect(complete("graph lang", portfolio)).toEqual(["graph langgraph", "graph langchain"]);
    expect(complete("recruiter o", portfolio)).toEqual(["recruiter on", "recruiter off"]);
    expect(complete("", portfolio).length).toBeGreaterThan(5);
  });
});
