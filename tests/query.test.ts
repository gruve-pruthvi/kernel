import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { buildContext, localAnswer, retrieve, systemPrompt, toSources } from "@/core/query";

describe("buildContext", () => {
  it("always includes identity and the system index", () => {
    const ctx = buildContext(portfolio, []);
    expect(ctx).toContain(portfolio.identity.role);
    for (const s of portfolio.systems) expect(ctx).toContain(`${s.slug}:`);
  });

  it("includes details of retrieved systems", () => {
    const ctx = buildContext(portfolio, retrieve(portfolio, "Atlas"));
    expect(ctx).toContain("Hybrid retrieval over pure vector search");
  });

  it("falls back to featured systems when nothing matched", () => {
    const ctx = buildContext(portfolio, []);
    expect(ctx).toContain("## SYSTEM atlas");
  });
});

describe("systemPrompt", () => {
  it("contains grounding rules and the owner name", () => {
    const prompt = systemPrompt(portfolio);
    expect(prompt).toContain(portfolio.identity.name);
    expect(prompt).toMatch(/only/i);
    expect(prompt).toMatch(/never invent/i);
  });
});

describe("localAnswer", () => {
  it("answers from search results with sources and suggestions", () => {
    const res = localAnswer(portfolio, "Tell me about Relay");
    expect(res.text).toContain("Relay");
    expect(res.sources[0]).toMatchObject({ kind: "system", id: "relay" });
    expect(res.suggestions).toContainEqual({ type: "openSystem", slug: "relay" });
  });

  it("suggests graph focus for technologies", () => {
    const res = localAnswer(portfolio, "kafka");
    expect(res.suggestions.some((a) => a.type === "highlightGraph")).toBe(true);
  });

  it("is honest when nothing matches", () => {
    const res = localAnswer(portfolio, "favourite pizza topping");
    expect(res.text).toMatch(/couldn't find/i);
    expect(res.sources).toEqual([]);
  });

  it("toSources strips scores", () => {
    expect(toSources(retrieve(portfolio, "atlas"))[0]).not.toHaveProperty("score");
  });
});
