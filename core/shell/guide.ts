import type { Portfolio } from "../schema";
import { out, seg } from "./registry";
import type { Effect, OutputItem } from "./types";

// Guided tour and next-command hints for the shell. Pure: the UI feeds in what happened, this decides what to show.

export const TOUR_KEY = "kernel:tour";
export const TOUR_LENGTH = 3;
export type TourStatus = "done" | "skipped" | null;

/** What a finished command did: the line, the folder afterwards, its effects and whether it succeeded. */
export interface StepEvent {
  command: string;
  cwd: string[];
  effects: Effect[];
  exitCode: 0 | 1;
}

export interface TourStep {
  text: string;
  command: string;
}

const SAMPLE_QUESTION = "ask which project should I look at first?";

export function readTourStatus(raw: string | null): TourStatus {
  return raw === "done" || raw === "skipped" ? raw : null;
}

export function shouldOfferTour(o: { status: TourStatus; variant: "page" | "console"; deepLinked: boolean }): boolean {
  return o.status === null && o.variant === "page" && !o.deepLinked;
}

const nameOf = (command: string) => command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
const inSystem = (cwd: string[]) => cwd[0] === "systems" && cwd.length >= 2;
const hasDemo = (p: Portfolio, slug: string) => Boolean(p.systems.find((s) => s.slug === slug)?.simulation);

function stepDone(step: number, ev: StepEvent, p: Portfolio): boolean {
  if (ev.exitCode !== 0) return false;
  const withSystems = p.systems.length > 0;
  switch (step) {
    case 0:
      return ["ls", "tree"].includes(nameOf(ev.command)) || (withSystems && ev.cwd[0] === "systems");
    case 1:
      return withSystems ? inSystem(ev.cwd) : ev.cwd[0] === "skills";
    case 2:
      return ev.effects.some((e) => e.type === "simulate" || e.type === "ask");
    default:
      return false;
  }
}

/** The step after this event. Keeps going while later steps are also satisfied; never goes backwards. */
export function advanceTour(step: number, ev: StepEvent, p: Portfolio): number {
  let next = step;
  while (next < TOUR_LENGTH && stepDone(next, ev, p)) next++;
  return next;
}

export function tourStep(step: number, cwd: string[], p: Portfolio): TourStep | null {
  const home = cwd.length === 0;
  const firstSlug = p.systems[0]?.slug;
  switch (step) {
    case 0:
      if (!firstSlug) return { text: "Everything here is a folder. Look around:", command: "ls" };
      return { text: "Projects live in folders. Look around:", command: home ? "ls systems" : "ls ~/systems" };
    case 1:
      if (!firstSlug) return { text: "Skills live in a folder too. Step inside:", command: "cd ~/skills" };
      return {
        text: "Click a project to step inside (or type it):",
        command: home ? `cd systems/${firstSlug}` : cwd[0] === "systems" && cwd.length === 1 ? `cd ${firstSlug}` : `cd ~/systems/${firstSlug}`,
      };
    case 2: {
      const here = inSystem(cwd) && hasDemo(p, cwd[1]) ? cwd[1] : p.systems.find((s) => s.simulation)?.slug;
      return here
        ? { text: "Now watch it work — or just ask in plain English:", command: `run ${here}` }
        : { text: "Now just ask in plain English:", command: SAMPLE_QUESTION };
    }
    default:
      return null;
  }
}

export const tourOffer = (): OutputItem =>
  out(seg("new here?  ", "faint"), seg("▸ take the 20-second tour", "accent", { run: "tour" }), seg("   or just start typing", "faint"));

export const tourDoneLine = (): OutputItem =>
  out(seg("✓ tour done", "ok"), seg(" — the bar above the prompt always shows what to try next", "faint"));
