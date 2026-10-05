// Pure keyboard policy for the shell input (kept out of Shell.tsx so it can be unit-tested).

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
