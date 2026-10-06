import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { askChips, flagships, outcomeOf, proofStats, stackGroups, timeline } from "@/core/front";
import type { Portfolio } from "@/core/schema";

const first = portfolio.systems[0];
const minimal: Portfolio = {
  ...portfolio,
  systems: [{ ...first, featured: false, impact: undefined }],
  experience: [],
  technologies: [],
};

describe("front page selectors", () => {
  it("flagships prefer featured systems, max three", () => {
    const f = flagships(portfolio);
    expect(f.length).toBeLessThanOrEqual(3);
    expect(f.every((s) => s.featured)).toBe(true);
  });

  it("falls back to any system when none are featured", () => {
    expect(flagships(minimal).map((s) => s.slug)).toEqual([first.slug]);
  });

  it("proof stats come only from real impact entries", () => {
    for (const stat of proofStats(portfolio)) {
      const s = portfolio.systems.find((x) => x.slug === stat.slug)!;
      expect(s.impact?.[0]).toMatchObject({ value: stat.value, label: stat.label });
    }
    expect(proofStats(minimal)).toEqual([]);
  });

  it("outcome leads with impact, else the tagline", () => {
    expect(outcomeOf({ ...first, impact: [{ value: "40%", label: "faster triage" }] })).toBe("40% faster triage");
    expect(outcomeOf({ ...first, impact: undefined })).toBe(first.tagline);
  });

  it("timeline keeps content order and has an empty state", () => {
    const t = timeline(portfolio);
    expect(t.map((e) => e.id)).toEqual(portfolio.experience.map((e) => e.id));
    expect(t[0].period.length).toBeGreaterThan(0);
    expect(timeline(minimal)).toEqual([]);
  });

  it("stack groups skip empty categories", () => {
    const groups = stackGroups(portfolio);
    expect(groups.every((g) => g.names.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.names).sort()).toEqual(portfolio.technologies.map((t) => t.name).sort());
    expect(stackGroups(minimal)).toEqual([]);
  });

  it("ask chips use the first name", () => {
    const name = portfolio.identity.name.split(/\s+/)[0];
    const chips = askChips(portfolio);
    expect(chips).toHaveLength(3);
    expect(chips.every((c) => c.includes(name))).toBe(true);
  });
});
