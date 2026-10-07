"use client";

/** Next-command suggestions above the status bar. Stays mounted (invisible) while busy so the layout never jumps. */
export function HintBar({ hints, hidden, onRun }: { hints: string[]; hidden: boolean; onRun: (command: string) => void }) {
  if (hints.length === 0) return null;
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-1 text-[12px] ${hidden ? "invisible" : ""}`}
      aria-label="Suggested commands"
      aria-hidden={hidden || undefined}
    >
      <span className="shrink-0 text-faint">try</span>
      {hints.map((h) => (
        <button
          key={h}
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onRun(h)}
          className="shrink-0 rounded border border-border px-2 py-0.5 text-muted hover:border-accent hover:text-accent"
        >
          {`▸ ${h}`}
        </button>
      ))}
    </div>
  );
}
