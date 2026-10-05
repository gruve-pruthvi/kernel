import { describe, expect, it } from "vitest";
import { edgePath, NODE, toView, VIEW } from "@/components/architecture/geometry";

describe("architecture geometry", () => {
  it("maps 0-100 coordinates into the padded view box", () => {
    const a = toView(0, 0);
    const b = toView(100, 100);
    expect(a.x).toBeGreaterThanOrEqual(NODE.width / 2);
    expect(b.x).toBeLessThanOrEqual(VIEW.width - NODE.width / 2);
    expect(a.y).toBeGreaterThanOrEqual(NODE.height / 2);
    expect(b.y).toBeLessThanOrEqual(VIEW.height - NODE.height / 2);
  });

  it("clips horizontal edges to node borders", () => {
    const { d } = edgePath({ x: 100, y: 100 }, { x: 500, y: 100 });
    expect(d).toBe(`M ${100 + NODE.width / 2 + 4} 100 L ${500 - NODE.width / 2 - 8} 100`);
  });

  it("clips vertical edges to node borders", () => {
    const { d } = edgePath({ x: 100, y: 100 }, { x: 100, y: 400 });
    expect(d).toBe(`M 100 ${100 + NODE.height / 2 + 4} L 100 ${400 - NODE.height / 2 - 8}`);
  });

  it("returns the midpoint for labels", () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 400, y: 0 }).mid).toEqual({ x: 200, y: 0 });
  });
});
