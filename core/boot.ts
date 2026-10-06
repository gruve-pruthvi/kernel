import { buildGraph } from "./graph";
import type { Portfolio } from "./schema";
import { blank, out, seg } from "./shell/registry";
import type { OutputItem } from "./shell/types";
import { handleOf } from "./shell/welcome";

export type Mode = "human" | "shell";
export const isMode = (v: unknown): v is Mode => v === "human" || v === "shell";

export const MODE_KEY = "kernel:mode";
export const MENU_KEY = "kernel:bootmenu";
export const COUNTDOWN_MS = { desktop: 3000, mobile: 2000 } as const;
export const HYDRATION_WATCHDOG_MS = 1500;

/** Hosts whose visitors are most likely engineers: the shell is preselected (they can still pick either). */
const DEV_HOSTS = ["github.com", "news.ycombinator.com", "dev.to", "lobste.rs", "stackoverflow.com"];

/** True when the overlay hydrates after the CSS watchdog lifted the cover; measured from when the pre-paint script ran. */
export function isLateHydration(now: number, bootAt: string | undefined): boolean {
  const start = bootAt === undefined ? 0 : Number(bootAt);
  return now - (Number.isFinite(start) ? start : 0) > HYDRATION_WATCHDOG_MS;
}

export interface BootSignals {
  storedMode: Mode | null;
  menuSeen: boolean;
  referrer: string;
  cmdParam: string | null;
  modeParam: string | null;
  forceBoot: boolean;
  isMobile: boolean;
  lateHydration: boolean;
  /** location.hash: a link to a section of the recruiter page (e.g. "#human"). */
  anchor: string;
}

export interface BootDecision {
  show: boolean;
  preselect: Mode;
  countdownMs: number;
  target: Mode;
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function preselectFor(s: BootSignals): Mode {
  if (isMode(s.modeParam)) return s.modeParam;
  if (s.cmdParam) return "shell";
  const host = referrerHost(s.referrer);
  if (DEV_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "shell";
  return "human";
}

/** Signals only choose the preselected line; the visitor always decides (or the countdown does). */
export function decideBoot(s: BootSignals): BootDecision {
  const preselect = preselectFor(s);
  const countdownMs = s.isMobile ? COUNTDOWN_MS.mobile : COUNTDOWN_MS.desktop;
  const explicit = isMode(s.modeParam) || Boolean(s.cmdParam);
  if (s.forceBoot) return { show: true, preselect, countdownMs, target: preselect };
  if (explicit) return { show: false, preselect, countdownMs, target: preselect };
  if (s.anchor.length > 1) return { show: false, preselect, countdownMs, target: "human" };
  if (s.lateHydration) return { show: false, preselect, countdownMs, target: "human" };
  if (s.menuSeen && s.storedMode) return { show: false, preselect, countdownMs, target: s.storedMode };
  return { show: true, preselect, countdownMs, target: preselect };
}

export interface BootLine {
  id: "identity" | "systems" | "index" | "graph";
  label: string;
  detail: string;
  /** System slugs on this line (each morphs into its card on the recruiter page). */
  slugs: string[];
}

export function bootLog(p: Portfolio): BootLine[] {
  const lines: BootLine[] = [{ id: "identity", label: "identity", detail: `${handleOf(p)} · ${p.identity.role}`, slugs: [] }];
  if (p.systems.length) {
    const slugs = p.systems.map((s) => s.slug);
    lines.push({ id: "systems", label: "mount /systems", detail: slugs.join(" "), slugs });
  }
  if (p.capabilities.length || p.technologies.length) {
    lines.push({ id: "index", label: "index", detail: `${p.capabilities.length} capabilities · ${p.technologies.length} technologies`, slugs: [] });
  }
  const g = buildGraph(p);
  if (g.edges.length) lines.push({ id: "graph", label: "link", detail: `graph ${g.nodes.length} nodes / ${g.edges.length} edges`, slugs: [] });
  return lines;
}

/** The same lines as shell transcript rows, handed to /shell when the visitor boots the shell. */
export function bootLogItems(lines: BootLine[]): OutputItem[] {
  return [
    out(seg("KERNEL 1.0 (tty1)", "accent")),
    ...lines.map((l) => out(seg("[ ok ] ", "ok"), seg(`${l.label}  `, "muted"), seg(l.detail))),
    blank(),
  ];
}

/**
 * Pre-paint script for the front page (inlined in <head>). Mirrors decideBoot for the signals available
 * before paint; tests/boot.test.ts checks the two agree. `?cmd=` never reaches here (next.config redirect).
 */
export function bootScript(): string {
  return `(function(){try{var d=document.documentElement,l=location;if(l.pathname!=="/")return;var q=new URLSearchParams(l.search);
var on=function(){d.dataset.bootAt=String(Math.round(typeof performance!=="undefined"?performance.now():0));d.dataset.boot="on"};
var g=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var p=function(k,v){try{localStorage.setItem(k,v)}catch(e){}};
if(q.get("boot")==="1"){on();return}
var m=q.get("mode");if(m==="human"||m==="shell"){p("${MODE_KEY}",m);p("${MENU_KEY}","seen");if(m==="shell")l.replace("/shell");return}
var s=g("${MODE_KEY}"),seen=g("${MENU_KEY}")==="seen";
if(l.hash&&l.hash!=="#")return;
if(seen&&s==="shell"){l.replace("/shell");return}
if(seen&&s==="human")return;
on()}catch(e){}})();`;
}

export const modeForPath = (pathname: string): Mode => (pathname === "/shell" || pathname.startsWith("/shell/") ? "shell" : "human");
