"use client";

import { kernel, useKernel } from "@/lib/store";

export function RecruiterToggle() {
  const on = useKernel((s) => s.recruiter);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={kernel.toggleRecruiter}
      className={`hidden items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition sm:inline-flex ${
        on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <span className={`size-1.5 rounded-full ${on ? "bg-accent" : "bg-faint"}`} aria-hidden />
      Recruiter
    </button>
  );
}
