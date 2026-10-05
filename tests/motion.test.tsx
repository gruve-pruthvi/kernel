import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useMotionAllowed } from "@/lib/use-motion-allowed";

function Probe() {
  return <span>{String(useMotionAllowed())}</span>;
}

describe("useMotionAllowed", () => {
  it("disallows motion during server render so hydration matches reduced-motion users", () => {
    expect(renderToString(<Probe />)).toBe("<span>false</span>");
  });
});
