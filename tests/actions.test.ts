import { describe, expect, it } from "vitest";
import { actionToHref, describeAction, validateAction } from "@/core/actions";
import { portfolio } from "@/core/content";

describe("validateAction", () => {
  it("accepts internal navigation and system pages", () => {
    expect(validateAction({ type: "navigate", path: "/trace" }, portfolio)).toEqual({ type: "navigate", path: "/trace" });
    expect(validateAction({ type: "navigate", path: "/systems/atlas" }, portfolio)).not.toBeNull();
  });

  it("rejects external URLs and unknown routes", () => {
    expect(validateAction({ type: "navigate", path: "https://evil.example" }, portfolio)).toBeNull();
    expect(validateAction({ type: "navigate", path: "//evil.example" }, portfolio)).toBeNull();
    expect(validateAction({ type: "navigate", path: "/admin" }, portfolio)).toBeNull();
    expect(validateAction({ type: "navigate", path: "/systems/ghost" }, portfolio)).toBeNull();
  });

  it("rejects unknown slugs", () => {
    expect(validateAction({ type: "openSystem", slug: "ghost" }, portfolio)).toBeNull();
    expect(validateAction({ type: "openSystem", slug: "relay" }, portfolio)).toEqual({ type: "openSystem", slug: "relay" });
  });

  it("resolves and filters graph ids", () => {
    expect(validateAction({ type: "highlightGraph", ids: ["langgraph", "ghost", "system:atlas"] }, portfolio)).toEqual({
      type: "highlightGraph",
      ids: ["tech:langgraph", "system:atlas"],
    });
    expect(validateAction({ type: "highlightGraph", ids: ["ghost"] }, portfolio)).toBeNull();
  });

  it("validates filters", () => {
    expect(validateAction({ type: "filterSystems", tech: "kafka" }, portfolio)).toEqual({ type: "filterSystems", tech: "kafka" });
    expect(validateAction({ type: "filterSystems", tech: "cobol" }, portfolio)).toBeNull();
    expect(validateAction({ type: "filterSystems" }, portfolio)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(validateAction(null, portfolio)).toBeNull();
    expect(validateAction({ type: "explode" }, portfolio)).toBeNull();
    expect(validateAction({ type: "toggleRecruiter", on: "yes" }, portfolio)).toBeNull();
  });
});

describe("actionToHref", () => {
  it("maps actions to internal hrefs", () => {
    expect(actionToHref({ type: "openSystem", slug: "atlas" })).toBe("/systems/atlas");
    expect(actionToHref({ type: "highlightGraph", ids: ["tech:python", "system:atlas"] })).toBe(
      "/graph?focus=tech%3Apython%2Csystem%3Aatlas",
    );
    expect(actionToHref({ type: "filterSystems", tech: "kafka", capability: "rag" })).toBe("/systems?tech=kafka&capability=rag");
    expect(actionToHref({ type: "toggleRecruiter", on: true })).toBeNull();
  });
});

describe("describeAction", () => {
  it("uses human names", () => {
    expect(describeAction({ type: "openSystem", slug: "atlas" }, portfolio)).toBe("Opened Atlas");
    expect(describeAction({ type: "filterSystems", tech: "kafka" }, portfolio)).toBe("Filtered systems by Kafka");
    expect(describeAction({ type: "highlightGraph", ids: ["tech:python"] }, portfolio)).toBe("Highlighted Python in the graph");
  });
});
