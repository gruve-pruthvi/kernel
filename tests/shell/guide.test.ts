import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import type { Portfolio } from "@/core/schema";
import {
  advanceTour,
  readTourStatus,
  shouldOfferTour,
  TOUR_LENGTH,
  tourDoneLine,
  tourOffer,
  tourStep,
  type StepEvent,
} from "@/core/shell/guide";
import { plainText } from "@/core/shell/registry";

const clone = (): Portfolio => structuredClone(portfolio);
const ev = (command: string, cwd: string[] = [], patch: Partial<StepEvent> = {}): StepEvent => ({ command, cwd, effects: [], exitCode: 0, ...patch });
const first = portfolio.systems[0].slug;
const runnable = portfolio.systems.find((s) => s.simulation)!.slug;

describe("readTourStatus", () => {
  it("readTourStatus accepts only done and skipped", () => {
    expect(readTourStatus("done")).toBe("done");
    expect(readTourStatus("skipped")).toBe("skipped");
    for (const junk of [null, "", "yes", "DONE", "true"]) expect(readTourStatus(junk)).toBeNull();
  });
});

describe("shouldOfferTour", () => {
  it("offers only on an unseen, full-page, non-deep-linked shell", () => {
    expect(shouldOfferTour({ status: null, variant: "page", deepLinked: false })).toBe(true);
    expect(shouldOfferTour({ status: "done", variant: "page", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: "skipped", variant: "page", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: null, variant: "console", deepLinked: false })).toBe(false);
    expect(shouldOfferTour({ status: null, variant: "page", deepLinked: true })).toBe(false);
  });
});

describe("advanceTour", () => {
  it("step 1 completes on listing or entering systems", () => {
    for (const e of [ev("ls"), ev("ls -la"), ev("ls systems"), ev("tree"), ev("cd systems", ["systems"])]) {
      expect(advanceTour(0, e, portfolio), e.command).toBe(1);
    }
    expect(advanceTour(0, ev("cat about.md"), portfolio)).toBe(0);
    expect(advanceTour(0, ev("whoami"), portfolio)).toBe(0);
  });

  it("entering a project directly finishes steps 1 and 2", () => {
    expect(advanceTour(0, ev(`cd ~/systems/${first}`, ["systems", first]), portfolio)).toBe(2);
    expect(advanceTour(1, ev(`cd ${first}`, ["systems", first]), portfolio)).toBe(2);
    expect(advanceTour(1, ev("ls", ["systems"]), portfolio)).toBe(1);
  });

  it("step 3 completes on a demo or a question", () => {
    const sim = ev(`run ${runnable}`, ["systems", first], { effects: [{ type: "simulate", slug: runnable }] });
    const ask = ev("what is atlas?", ["systems", first], { effects: [{ type: "ask", question: "what is atlas?" }] });
    expect(advanceTour(2, sim, portfolio)).toBe(TOUR_LENGTH);
    expect(advanceTour(2, ask, portfolio)).toBe(TOUR_LENGTH);
    expect(advanceTour(2, ev("cat README.md", ["systems", first]), portfolio)).toBe(2);
  });

  it("failed commands never advance", () => {
    expect(advanceTour(0, ev("ls nope", [], { exitCode: 1 }), portfolio)).toBe(0);
    expect(advanceTour(1, ev("cd nope", ["systems"], { exitCode: 1 }), portfolio)).toBe(1);
  });

  it("never goes backwards and stays finished", () => {
    expect(advanceTour(2, ev("ls"), portfolio)).toBe(2);
    expect(advanceTour(TOUR_LENGTH, ev("ls"), portfolio)).toBe(TOUR_LENGTH);
  });

  it("without systems, step 2 is entering skills", () => {
    const p = clone();
    p.systems = [];
    expect(advanceTour(0, ev("ls"), p)).toBe(1);
    expect(advanceTour(1, ev("cd skills", ["skills"]), p)).toBe(2);
  });
});

describe("tourStep", () => {
  it("suggests commands that fit the current folder", () => {
    expect(tourStep(0, [], portfolio)!.command).toBe("ls systems");
    expect(tourStep(0, ["skills"], portfolio)!.command).toBe("ls ~/systems");
    expect(tourStep(1, [], portfolio)!.command).toBe(`cd systems/${first}`);
    expect(tourStep(1, ["systems"], portfolio)!.command).toBe(`cd ${first}`);
    expect(tourStep(1, ["stack"], portfolio)!.command).toBe(`cd ~/systems/${first}`);
    expect(tourStep(TOUR_LENGTH, [], portfolio)).toBeNull();
  });

  it("step 3 runs the project you are in when it has a demo", () => {
    expect(tourStep(2, ["systems", runnable], portfolio)!.command).toBe(`run ${runnable}`);
    const noDemo = portfolio.systems.find((s) => !s.simulation);
    if (noDemo) expect(tourStep(2, ["systems", noDemo.slug], portfolio)!.command).toBe(`run ${runnable}`);
  });

  it("falls back to a question when nothing is runnable, and to skills when there are no systems", () => {
    const p = clone();
    for (const s of p.systems) delete s.simulation;
    expect(tourStep(2, [], p)!.command).toMatch(/^ask /);
    p.systems = [];
    expect(tourStep(0, [], p)!.command).toBe("ls");
    expect(tourStep(1, [], p)!.command).toBe("cd ~/skills");
    expect(tourStep(2, [], p)!.command).toMatch(/^ask /);
  });
});

describe("tour lines", () => {
  it("the offer runs `tour` when clicked", () => {
    const offer = tourOffer();
    expect(plainText([offer])[0]).toContain("take the 20-second tour");
    expect("line" in offer && offer.line.some((s) => s.run === "tour")).toBe(true);
    expect(plainText([tourDoneLine()])[0]).toContain("tour done");
  });
});
