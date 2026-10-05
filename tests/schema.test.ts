import { describe, expect, it } from "vitest";
import { experienceSchema, systemSchema } from "@/core/schema";

const minimalSystem = {
  id: "demo",
  slug: "demo",
  number: 1,
  name: "Demo",
  tagline: "A demo system",
  featured: false,
  category: "ai",
  status: "prototype",
  summary: "Summary",
  problem: "Problem",
  role: "Lead engineer",
  responsibilities: [],
  technologies: [],
  capabilities: [],
  architecture: {
    nodes: [{ id: "a", label: "A", kind: "service", x: 10, y: 50, description: "A node" }],
    edges: [],
  },
  decisions: [],
  placeholder: true,
};

describe("systemSchema", () => {
  it("accepts a minimal system", () => {
    expect(systemSchema.parse(minimalSystem).name).toBe("Demo");
  });

  it("rejects node coordinates outside 0-100", () => {
    const bad = {
      ...minimalSystem,
      architecture: { nodes: [{ ...minimalSystem.architecture.nodes[0], x: 140 }], edges: [] },
    };
    expect(systemSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown node kind", () => {
    const bad = {
      ...minimalSystem,
      architecture: { nodes: [{ ...minimalSystem.architecture.nodes[0], kind: "robot" }], edges: [] },
    };
    expect(systemSchema.safeParse(bad).success).toBe(false);
  });
});

describe("experienceSchema", () => {
  it("requires 7-char hex commit hashes", () => {
    const exp = {
      id: "e",
      organisation: "Org",
      role: "Engineer",
      start: "2024-01",
      summary: "s",
      branch: "main",
      commits: [{ hash: "zzzzzzz", message: "m", date: "2024-02" }],
    };
    expect(experienceSchema.safeParse(exp).success).toBe(false);
    exp.commits[0].hash = "a1b2c3d";
    expect(experienceSchema.safeParse(exp).success).toBe(true);
  });

  it("requires YYYY-MM dates", () => {
    const exp = {
      id: "e",
      organisation: "Org",
      role: "Engineer",
      start: "Jan 2024",
      summary: "s",
      branch: "main",
      commits: [],
    };
    expect(experienceSchema.safeParse(exp).success).toBe(false);
  });
});
