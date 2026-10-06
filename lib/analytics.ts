"use client";

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/** Sends an event only when the Plausible script is loaded (NEXT_PUBLIC_PLAUSIBLE_DOMAIN set). */
export function track(event: string, props?: Record<string, string>) {
  try {
    window.plausible?.(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the app */
  }
}
