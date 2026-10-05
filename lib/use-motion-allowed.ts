"use client";

import { useSyncExternalStore } from "react";
import { useKernel } from "./store";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// Server render (and hydration) assume reduced motion so markup matches every visitor;
// motion turns on right after hydration for those who allow it.
export function useMotionAllowed(): boolean {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
  const recruiter = useKernel((s) => s.recruiter);
  return !reduced && !recruiter;
}
