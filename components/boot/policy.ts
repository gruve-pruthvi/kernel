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

/** Movement (px) a touch must travel before it counts as scrolling rather than a slightly wobbly tap. */
export const SCROLL_SLOP = 12;

/** A swipe that started outside the menu boots the recruiter view; taps and drags on the menu never do. */
export function isScrollGesture(start: { x: number; y: number }, now: { x: number; y: number }, startedInMenu: boolean): boolean {
  if (startedInMenu) return false;
  return Math.hypot(now.x - start.x, now.y - start.y) > SCROLL_SLOP;
}
