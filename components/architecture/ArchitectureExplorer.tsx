"use client";

import { useEffect, useState } from "react";
import type { Architecture, Simulation } from "@/core/schema";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { SimulationLog, type SimStatus } from "./SimulationLog";

export function ArchitectureExplorer({
  architecture,
  simulation,
  techNames,
}: {
  architecture: Architecture;
  simulation?: Simulation;
  techNames: Record<string, string>;
}) {
  const motion = useMotionAllowed();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SimStatus>("idle");

  const total = simulation?.steps.length ?? 0;
  const activeId = simulation && status !== "idle" ? simulation.steps[step]?.nodeId ?? null : null;

  useEffect(() => {
    if (!simulation || status !== "running") return;
    const duration = motion ? simulation.steps[step].durationMs : 250;
    const t = window.setTimeout(() => {
      if (step >= total - 1) setStatus("done");
      else setStep((s) => s + 1);
    }, duration);
    return () => window.clearTimeout(t);
  }, [simulation, status, step, total, motion]);

  const focusId = hovered ?? pinned;
  const inspected = architecture.nodes.find((n) => n.id === (focusId ?? activeId));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="overflow-x-auto rounded-lg border border-border bg-surface p-2 [scrollbar-width:thin]">
          <ArchitectureDiagram
            architecture={architecture}
            focusId={focusId}
            activeId={activeId}
            motion={motion}
            onHover={setHovered}
            onSelect={(id) => setPinned((p) => (p === id ? null : id))}
          />
        </div>
        <aside className="rounded-lg border border-border bg-surface p-4" aria-live="polite">
          {inspected ? (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{inspected.kind}</p>
              <h3 className="mt-2 text-base font-semibold">{inspected.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{inspected.description}</p>
              {inspected.tech && inspected.tech.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {inspected.tech.map((t) => (
                    <span key={t} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {techNames[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
              {pinned === inspected.id && <p className="mt-4 font-mono text-[10px] text-faint">pinned · click again to release</p>}
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Inspector</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Hover or focus a component to see what it does. Click to pin it.
              </p>
            </>
          )}
        </aside>
      </div>
      {simulation && (
        <SimulationLog
          simulation={simulation}
          step={step}
          status={status}
          onRun={() => {
            if (status === "done") setStep(0);
            setStatus("running");
          }}
          onPause={() => setStatus("paused")}
          onStep={() => {
            if (status === "idle") {
              setStatus("paused");
              return;
            }
            setStep((s) => Math.min(s + 1, total - 1));
            if (step + 1 >= total - 1) setStatus("done");
            else setStatus("paused");
          }}
          onReset={() => {
            setStatus("idle");
            setStep(0);
          }}
        />
      )}
    </div>
  );
}
