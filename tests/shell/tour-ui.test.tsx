import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HintBar } from "@/components/kernel/HintBar";
import { TourCard } from "@/components/kernel/TourCard";

describe("TourCard", () => {
  it("shows the step, the text and a clickable command", () => {
    const html = renderToString(<TourCard step={0} total={3} text="Look around:" command="ls systems" disabled={false} onRun={() => {}} onSkip={() => {}} />);
    expect(html).toContain("tour 1/3");
    expect(html).toContain("Look around:");
    expect(html).toContain("▸ ls systems");
    expect(html).toContain('aria-label="Skip the tour"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("HintBar", () => {
  it("renders one button per hint and stays mounted when hidden", () => {
    const html = renderToString(<HintBar hints={["ls systems", "cat about.md"]} hidden={false} onRun={() => {}} />);
    expect(html.match(/<button/g)?.length).toBe(2);
    expect(html).toContain("▸ cat about.md");
    const hidden = renderToString(<HintBar hints={["ls"]} hidden onRun={() => {}} />);
    expect(hidden).toContain("invisible");
  });
});
