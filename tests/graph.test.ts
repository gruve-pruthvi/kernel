import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { buildGraph, neighbours, nodeHref, nodeId, resolveFocus, resolveNodeId } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";

const g = buildGraph(portfolio);

describe("buildGraph", () => {
  it("creates one node per system, technology and capability", () => {
    const expected = portfolio.systems.length + portfolio.technologies.length + portfolio.capabilities.length;
    expect(g.nodes).toHaveLength(expected);
  });

  it("links systems to their technologies and capabilities without duplicates", () => {
    const atlas = portfolio.systems.find((s) => s.slug === "atlas")!;
    const fromAtlas = g.edges.filter((e) => e.source === "system:atlas");
    expect(fromAtlas).toHaveLength(atlas.technologies.length + atlas.capabilities.length);
    const keys = g.edges.map((e) => `${e.source}>${e.target}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("links capabilities to technologies", () => {
    expect(g.edges).toContainEqual({ source: "cap:rag", target: "tech:weaviate" });
  });

  it("is memoised", () => {
    expect(buildGraph(portfolio)).toBe(g);
  });
});

describe("lookup helpers", () => {
  it("neighbours are symmetric", () => {
    expect(neighbours(g, "tech:langgraph").has("system:atlas")).toBe(true);
    expect(neighbours(g, "system:atlas").has("tech:langgraph")).toBe(true);
  });

  it("resolves bare refs and full ids", () => {
    expect(resolveNodeId(g, "langgraph")).toBe("tech:langgraph");
    expect(resolveNodeId(g, "atlas")).toBe("system:atlas");
    expect(resolveNodeId(g, "rag")).toBe("cap:rag");
    expect(resolveNodeId(g, "tech:python")).toBe("tech:python");
    expect(resolveNodeId(g, "LangGraph")).toBe("tech:langgraph");
    expect(resolveNodeId(g, "nope")).toBeUndefined();
  });

  it("resolveFocus ignores unknown ids", () => {
    expect(resolveFocus(g, "nope,tech:python, atlas ,python")).toEqual(["tech:python", "system:atlas"]);
    expect(resolveFocus(g, null)).toEqual([]);
    expect(resolveFocus(g, "")).toEqual([]);
  });

  it("builds hrefs", () => {
    expect(nodeHref({ id: nodeId("system", "atlas"), type: "system", ref: "atlas", label: "Atlas" })).toBe("/systems/atlas");
    expect(nodeHref({ id: "tech:python", type: "technology", ref: "python", label: "Python" })).toBe(
      "/graph?focus=tech%3Apython",
    );
  });
});

describe("layoutGraph", () => {
  it("is deterministic and inside bounds", () => {
    const size = { width: 1000, height: 640 };
    const a = layoutGraph(g, size);
    const b = layoutGraph(g, size);
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
    for (const n of a.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(size.width);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(size.height);
    }
  });

  it("returns edges as plain id pairs", () => {
    const { edges } = layoutGraph(g, { width: 1000, height: 640 });
    expect(typeof edges[0].source).toBe("string");
  });
});
