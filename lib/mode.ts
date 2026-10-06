"use client";

import type { Mode } from "@/core/boot";
import { kernel } from "./store";

export const MODE_HOME: Record<Mode, string> = { human: "/", shell: "/shell" };
const FLASH: Record<Mode, string> = { human: "[ ok ] switching to the recruiter view…", shell: "[ ok ] switching to shell…" };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Saves the mode, plays a short reboot line (skipped without motion) and navigates to the mode's home. */
export async function switchMode(mode: Mode, router: { push(href: string): void }, motion: boolean) {
  kernel.setMode(mode);
  if (!motion) {
    router.push(MODE_HOME[mode]);
    return;
  }
  kernel.setReboot(FLASH[mode]);
  await sleep(400);
  router.push(MODE_HOME[mode]);
  await sleep(200);
  kernel.setReboot(null);
}
