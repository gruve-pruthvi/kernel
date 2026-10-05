import { describe, expect, it } from "vitest";
import { expandHistory, lex, parse, parseFlags, type FlagSpec, type Word } from "@/core/shell/parser";

const w = (...values: string[]): Word[] => values.map((value) => ({ value, quoted: false }));
const words = (input: string) => lex(input).map((t) => (t.type === "word" ? t.word.value : t.type));

describe("lex", () => {
  it("splits words, quotes, escapes and operators", () => {
    expect(words(`grep -i "agent orchestration" . | head -n 3; ls`)).toEqual([
      "grep", "-i", "agent orchestration", ".", "pipe", "head", "-n", "3", "semi", "ls",
    ]);
    expect(words(`echo 'a | b' c\\ d ""`)).toEqual(["echo", "a | b", "c d", ""]);
    expect(words(`echo "unterminated`)).toEqual(["echo", "unterminated"]);
    expect(lex(`"-x"`)[0]).toEqual({ type: "word", word: { value: "-x", quoted: true } });
  });
});

describe("parse", () => {
  it("builds pipelines and stages", () => {
    const r = parse("ls systems | grep atlas; pwd");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pipelines.map((p) => p.map((s) => s.name))).toEqual([["ls", "grep"], ["pwd"]]);
    expect(r.pipelines[0][0].argv.map((a) => a.value)).toEqual(["systems"]);
  });

  it("skips empty commands and rejects broken pipes", () => {
    const r = parse("ls;; ;pwd;");
    expect(r.ok && r.pipelines.length).toBe(2);
    expect(parse("ls |").ok).toBe(false);
    expect(parse("| ls").ok).toBe(false);
    expect(parse("ls | | grep x").ok).toBe(false);
    expect(parse("   ").ok && (parse("   ") as { pipelines: unknown[] }).pipelines.length).toBe(0);
  });
});

describe("history expansion edge cases", () => {
  const history = ["ls", "cd systems", "cat README.md"];
  it("expands !! and !N", () => {
    expect(expandHistory("!!", history)).toEqual({ ok: true, line: "cat README.md", expanded: true });
    expect(expandHistory("sudo !!", history)).toEqual({ ok: true, line: "sudo cat README.md", expanded: true });
    expect(expandHistory("!2", history)).toEqual({ ok: true, line: "cd systems", expanded: true });
    expect(expandHistory("ls", history)).toEqual({ ok: true, line: "ls", expanded: false });
  });

  it("errors on missing events and keeps single-quoted text literal", () => {
    expect(expandHistory("!!", [])).toEqual({ ok: false, error: "!!: event not found" });
    expect(expandHistory("!0", history)).toEqual({ ok: false, error: "!0: event not found" });
    expect(expandHistory("!999", history)).toEqual({ ok: false, error: "!999: event not found" });
    expect(expandHistory("echo '!!'", history)).toEqual({ ok: true, line: "echo '!!'", expanded: false });
    expect(expandHistory("echo hi!", history)).toEqual({ ok: true, line: "echo hi!", expanded: false });
  });
});

describe("parseFlags", () => {
  const spec: FlagSpec = {
    ignoreCase: { short: "i", describe: "" },
    lineNumber: { short: "n", describe: "" },
    lines: { short: "N", value: true, describe: "" },
    name: { value: true, singleDash: true, describe: "" },
  };

  it("parses long, short, combined, valued and single-dash flags", () => {
    expect(parseFlags(w("--ignoreCase", "x"), spec)).toEqual({ ok: true, args: ["x"], flags: { ignoreCase: true } });
    expect(parseFlags(w("-in", "x"), spec)).toEqual({ ok: true, args: ["x"], flags: { ignoreCase: true, lineNumber: true } });
    expect(parseFlags(w("-N", "5"), spec)).toEqual({ ok: true, args: [], flags: { lines: "5" } });
    expect(parseFlags(w("-N5"), spec)).toEqual({ ok: true, args: [], flags: { lines: "5" } });
    expect(parseFlags(w("--lines=7"), spec)).toEqual({ ok: true, args: [], flags: { lines: "7" } });
    expect(parseFlags(w("-name", "*.md"), spec)).toEqual({ ok: true, args: [], flags: { name: "*.md" } });
    expect(parseFlags(w("--", "-i"), spec)).toEqual({ ok: true, args: ["-i"], flags: {} });
    expect(parseFlags([{ value: "-i", quoted: true }], spec)).toEqual({ ok: true, args: ["-i"], flags: {} });
    expect(parseFlags(w("-", "-5"), spec)).toEqual({ ok: true, args: ["-", "-5"], flags: {} });
  });

  it("rejects unknown flags and missing values", () => {
    expect(parseFlags(w("--bogus"), spec)).toEqual({ ok: false, error: "unknown flag --bogus" });
    expect(parseFlags(w("-z"), spec)).toEqual({ ok: false, error: "unknown flag -z" });
    expect(parseFlags(w("-N"), spec)).toEqual({ ok: false, error: "-N needs a value" });
    expect(parseFlags(w("--lines"), spec)).toEqual({ ok: false, error: "--lines needs a value" });
    expect(parseFlags(w("--ignoreCase=yes"), spec)).toEqual({ ok: false, error: "--ignoreCase takes no value" });
    expect(parseFlags(w("-x"))).toEqual({ ok: false, error: "unknown flag -x" });
  });
});
