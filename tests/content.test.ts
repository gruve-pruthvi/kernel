import { describe, expect, it } from "vitest";
import { rawPortfolio } from "@/content";
import {
  checkIntegrity,
  getCommits,
  getFeaturedSystems,
  getRelatedSystems,
  getSystem,
  getSystems,
  getSystemsByTechnology,
  portfolio,
  validatePortfolio,
} from "@/core/content";
import { formatPeriod, systemNumber } from "@/core/format";
import type { Portfolio } from "@/core/schema";

const clone = (): Portfolio => structuredClone(portfolio);

describe("shipped content", () => {
  it("validates with zero integrity errors", () => {
    expect(() => validatePortfolio(rawPortfolio)).not.toThrow();
    expect(checkIntegrity(portfolio)).toEqual([]);
  });

  it("has exactly three featured systems sorted by number", () => {
    const featured = getFeaturedSystems();
    expect(featured).toHaveLength(3);
    const numbers = getSystems().map((s) => s.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("marks every system as placeholder", () => {
    expect(getSystems().every((s) => s.placeholder)).toBe(true);
  });
});

describe("checkIntegrity", () => {
  it("reports precise integrity errors", () => {
    const p = clone();
    p.systems[0].technologies.push("cobol");
    p.systems[0].architecture.edges.push({ from: p.systems[0].architecture.nodes[0].id, to: "ghost" });
    p.systems[0].simulation = { prompt: "x", steps: [{ nodeId: "nowhere", title: "t", detail: "d", durationMs: 100 }] };
    const errors = checkIntegrity(p);
    const slug = p.systems[0].slug;
    expect(errors).toContain(`systems.${slug}.technologies: unknown technology "cobol"`);
    expect(errors).toContain(`systems.${slug}.architecture.edges[${p.systems[0].architecture.edges.length - 1}]: unknown node "ghost"`);
    expect(errors).toContain(`systems.${slug}.simulation.steps[0]: unknown node "nowhere"`);
  });

  it("reports duplicate slugs and numbers", () => {
    const p = clone();
    p.systems[1].slug = p.systems[0].slug;
    p.systems[1].number = p.systems[0].number;
    const errors = checkIntegrity(p);
    expect(errors.some((e) => e.includes("duplicate slug"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicate number"))).toBe(true);
  });

  it("reports unknown commit system references", () => {
    const p = clone();
    p.experience[0].commits[0].systems = ["missing-system"];
    expect(checkIntegrity(p).some((e) => e.includes('unknown system "missing-system"'))).toBe(true);
  });

  it("validatePortfolio throws with paths for schema errors", () => {
    const p = clone() as unknown as { systems: { name: string }[] };
    p.systems[0].name = "";
    expect(() => validatePortfolio(p)).toThrow(/systems\.0\.name/);
  });
});

describe("selectors", () => {
  it("finds a system by slug and returns undefined for unknown", () => {
    const first = getSystems()[0];
    expect(getSystem(first.slug)?.id).toBe(first.id);
    expect(getSystem("does-not-exist")).toBeUndefined();
  });

  it("finds systems by technology", () => {
    const tech = getSystems()[0].technologies[0];
    expect(getSystemsByTechnology(tech).length).toBeGreaterThan(0);
  });

  it("related systems exclude self and share technology", () => {
    const first = getSystems()[0];
    const related = getRelatedSystems(first.slug);
    expect(related.find((s) => s.slug === first.slug)).toBeUndefined();
    for (const r of related) {
      expect(r.technologies.some((t) => first.technologies.includes(t))).toBe(true);
    }
  });

  it("commits are sorted newest first", () => {
    const dates = getCommits().map((c) => c.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe("format", () => {
  it("pads system numbers", () => {
    expect(systemNumber(1)).toBe("001");
    expect(systemNumber(42)).toBe("042");
  });

  it("formats periods", () => {
    expect(formatPeriod("2024-06")).toBe("Jun 2024 — Present");
    expect(formatPeriod("2022-07", "2024-05")).toBe("Jul 2022 — May 2024");
  });
});

describe("commit references (review fix)", () => {
  it("validates commit systems against slugs, not ids", () => {
    const p = clone();
    p.systems[0].id = "renamed-id";
    p.experience[0].commits[0].systems = [p.systems[0].slug];
    expect(checkIntegrity(p).filter((e) => e.includes("unknown system"))).toEqual([]);
    p.experience[0].commits[0].systems = ["renamed-id"];
    expect(checkIntegrity(p).some((e) => e.includes('unknown system "renamed-id"'))).toBe(true);
  });

  it("reports duplicate system ids", () => {
    const p = clone();
    p.systems[1].id = p.systems[0].id;
    expect(checkIntegrity(p).some((e) => e.includes("duplicate id"))).toBe(true);
  });
});
