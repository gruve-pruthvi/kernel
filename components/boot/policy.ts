// Pure keyboard policy for the boot menu (kept out of BootOverlay so it can be unit-tested).

export type BootKey = "up" | "down" | "boot-selected" | "boot-shell" | "boot-human";

/** Menu keys act on the overlay only; typing in a field, links, buttons and browser shortcuts keep their own behaviour. */
export function bootKeyAction(k: { key: string; meta: boolean; ctrl: boolean; alt: boolean; targetTag: string; editable: boolean }): BootKey | null {
  if (k.meta || k.ctrl || k.alt || k.editable || k.targetTag === "A" || k.targetTag === "BUTTON") return null;
  switch (k.key) {
    case "ArrowDown":
      return "down";
    case "ArrowUp":
      return "up";
    case "Enter":
      return "boot-selected";
    case "`":
      return "boot-shell";
    case "Escape":
      return "boot-human";
    default:
      return null;
  }
}
