"use client";

import { useReducedMotion } from "motion/react";
import { useKernel } from "./store";

export function useMotionAllowed(): boolean {
  const reduced = useReducedMotion();
  const recruiter = useKernel((s) => s.recruiter);
  return !reduced && !recruiter;
}
