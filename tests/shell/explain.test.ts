import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import { explain, explainLines, similar } from "@/core/shell/explain";
import { run, textOf } from "./helpers";

describe("similar", () => {
  it("matches words sharing a 5-letter stem", () => {
    expect(similar("citations", "citation")).toBe(true);
    expect(similar("verify", "verifier")).toBe(true);
    expect(similar("rag", "rags")).toBe(false);
    expect(similar("graph", "graph")).toBe(true);
  });
});

describe("explain", () => {
  it("returns matching systems with real children", () => {
    const nodes = explain(portfolio, "how does atlas verify citations");
    expect(nodes[0].slug).toBe("atlas");
    expect(nodes[0].children).toContainEqual({ kind: "component", label: "Citation Verifier", run: "open atlas" });
    expect(nodes[0].children.length).toBeLessThanOrEqual(3);
  });

  it("only uses labels that exist in content", () => {
    for (const n of explain(portfolio, "hybrid retrieval agents kafka latency")) {
      const s = portfolio.systems.find((x) => x.slug === n.slug)!;
      const real = new Set([
        ...s.architecture.nodes.map((x) => x.label),
        ...s.decisions.map((d) => d.title),
        ...s.technologies.map((t) => portfolio.technologies.find((x) => x.id === t)!.name),
        ...(s.impact ?? []).map((i) => `${i.value} ${i.label}`),
      ]);
      for (const c of n.children) expect(real.has(c.label), c.label).toBe(true);
    }
  });

  it("returns nothing for unrelated questions", () => {
    expect(explain(portfolio, "favourite pizza topping")).toEqual([]);
    expect(explain(portfolio, "")).toEqual([]);
  });

  it("explain tolerates a minimal portfolio", () => {
    const p: Portfolio = structuredClone(portfolio);
    p.systems = [{ ...p.systems[p.systems.length - 1], decisions: [], impact: undefined }];
    expect(() => explain(p, "kafka pipeline")).not.toThrow();
  });

  it("renders a clickable tree", () => {
    const items = explainLines(explain(portfolio, "how does atlas verify citations"));
    const text = textOf(items);
    expect(text.split("\n")[0]).toBe("  related in this portfolio");
    expect(text).toMatch(/[├└]── component: Citation Verifier/);
    expect(explainLines([])).toEqual([]);
  });
});

describe("ask command", () => {
  it("asks the question without the command word", () => {
    expect(run('ask "what is atlas?"').res.effects).toEqual([{ type: "ask", question: "what is atlas?" }]);
    expect(run("ask what has been built with agents?").res.effects).toEqual([{ type: "ask", question: "what has been built with agents?" }]);
  });

  it("needs a question", () => {
    expect(run("ask").text).toBe("ask: missing question\nusage: ask <question…>");
  });
});
