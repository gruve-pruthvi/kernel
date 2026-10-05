import { describe, expect, it } from "vitest";
import { run } from "./helpers";

const asks = (input: string) => run(input).res.effects.some((e) => e.type === "ask");

describe("plain-English routing (review fix)", () => {
  it("sends questions with apostrophes to the AI", () => {
    expect(asks("what's the stack")).toBe(true);
    expect(asks("who's behind this")).toBe(true);
  });

  it("sends questions that start with a command word to the AI", () => {
    for (const q of ["which systems use kafka?", "find the rag systems?", "open to work?", "history of atlas?", "man what is this?"]) {
      expect(asks(q), q).toBe(true);
    }
  });

  it("keeps real commands as commands", () => {
    for (const c of ["ls systems?", "grep -i rag .?", "cat systems/atlas/README.md", "rm -rf /", "sl", "help me find agents"]) {
      expect(asks(c), c).toBe(false);
    }
    expect(asks("what has been built with agents")).toBe(true);
    expect(asks("hello?")).toBe(true);
  });
});
