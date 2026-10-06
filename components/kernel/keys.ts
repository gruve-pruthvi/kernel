// Pure keyboard policy for the shell input (kept out of Shell.tsx so it can be unit-tested).

import { modeForPath } from "@/core/boot";

/** Tab completes while typing or cycling the menu; otherwise it moves focus, so the shell is never a keyboard trap. */
export function tabDecision(o: { input: string; menuOpen: boolean; busy: boolean }): "complete" | "pass" {
  if (o.busy) return "pass";
  if (o.menuOpen) return "complete";
  return o.input.trim() ? "complete" : "pass";
}

/** While a command runs, swallow typing but never navigation keys or browser shortcuts. */
export function blockWhileBusy(k: { key: string; meta: boolean; ctrl: boolean; alt: boolean }): boolean {
  if (k.meta || k.ctrl || k.alt) return false;
  return k.key.length === 1 || k.key === "Enter" || k.key === "Backspace" || k.key === "Delete";
}

/** Quake-style console toggle: ` opens/closes it on GUI pages; Escape closes it. Never while typing elsewhere. */
export function consoleKeyAction(k: {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  editable: boolean;
  inConsole: boolean;
  pathname: string;
  open: boolean;
  booting: boolean;
}): "open" | "close" | null {
  if (k.booting || modeForPath(k.pathname) === "shell") return null;
  if (k.open && k.key === "Escape") return "close";
  if (k.key !== "`" || k.meta || k.ctrl || k.alt) return null;
  if (k.open) return k.editable && !k.inConsole ? null : "close";
  return k.editable ? null : "open";
}

/** Escape in the shell closes the innermost layer; in the drop-down console the last Escape closes the console. */
export function escapeAction(s: { menu: boolean; search: boolean; pane: boolean; console: boolean }): "menu" | "search" | "pane" | "exit" | "none" {
  if (s.menu) return "menu";
  if (s.search) return "search";
  if (s.pane) return "pane";
  return s.console ? "exit" : "none";
}
