import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { searchPortfolio, tokenize } from "@/core/search";

describe("tokenize", () => {
  it("lowercases, splits and drops stopwords", () => {
    expect(tokenize("What has he built with LangGraph?")).toEqual(["built", "langgraph"]);
  });
});

describe("searchPortfolio", () => {
  it("ranks an exact system name first", () => {
    expect(searchPortfolio(portfolio, "Relay")[0]).toMatchObject({ kind: "system", id: "relay", href: "/systems/relay" });
  });

  it("finds technologies with graph hrefs", () => {
    const results = searchPortfolio(portfolio, "kafka");
    const tech = results.find((r) => r.kind === "technology");
    expect(tech).toMatchObject({ id: "kafka", href: "/graph?focus=tech%3Akafka" });
  });

  it("finds systems by content, not just name", () => {
    const ids = searchPortfolio(portfolio, "citation verification").map((r) => r.id);
    expect(ids).toContain("atlas");
  });

  it("finds experience entries", () => {
    expect(searchPortfolio(portfolio, "Example Labs").some((r) => r.kind === "experience")).toBe(true);
  });

  it("returns nothing for empty or stopword-only queries", () => {
    expect(searchPortfolio(portfolio, "")).toEqual([]);
    expect(searchPortfolio(portfolio, "what is the")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchPortfolio(portfolio, "ai systems agents data", 2)).toHaveLength(2);
  });
});
