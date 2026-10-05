"use client";

import { useEffect, useRef } from "react";
import type { Simulation } from "@/core/schema";

export type SimStatus = "idle" | "running" | "paused" | "done";

export function SimulationLog({
  simulation,
  step,
  status,
  onRun,
  onPause,
  onStep,
  onReset,
}: {
  simulation: Simulation;
  step: number;
  status: SimStatus;
  onRun: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
}) {
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [step]);

  const shown = simulation.steps.slice(0, step + 1);
  const btn = "rounded border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted transition hover:border-border-strong hover:text-text disabled:opacity-40";

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="mr-auto font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Simulated walkthrough</p>
        {status === "running" ? (
          <button type="button" className={btn} onClick={onPause}>
            Pause
          </button>
        ) : (
          <button type="button" className={`${btn} border-accent/50 text-accent`} onClick={onRun}>
            {status === "paused" ? "Resume" : status === "done" ? "Replay" : "Run"}
          </button>
        )}
        <button type="button" className={btn} onClick={onStep} disabled={status === "running" || step >= simulation.steps.length - 1}>
          Step
        </button>
        <button type="button" className={btn} onClick={onReset} disabled={status === "idle"}>
          Reset
        </button>
      </div>
      <div className="px-4 py-3 font-mono text-[12px] leading-6">
        <p className="text-text">
          <span className="text-accent">&gt;</span> {simulation.prompt}
        </p>
        <ol ref={logRef} className="mt-2 max-h-56 overflow-y-auto" aria-live="polite">
          {status !== "idle" &&
            shown.map((s, i) => (
              <li key={i} className="animate-fade-up text-muted">
                <span className="text-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
                <span className={i === step && status !== "done" ? "text-accent" : "text-text"}>[{s.title}]</span> {s.detail}
              </li>
            ))}
          {status === "idle" && <li className="text-faint">Press Run to send this request through the architecture.</li>}
          {status === "running" && <li className="cursor-blink text-accent">▍</li>}
        </ol>
      </div>
    </div>
  );
}
