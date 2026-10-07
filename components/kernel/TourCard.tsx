"use client";

/** The tour's step box above the prompt. Not a dialog: focus stays on the prompt, buttons never take it. */
export function TourCard({
  step,
  total,
  text,
  command,
  disabled,
  onRun,
  onSkip,
}: {
  step: number;
  total: number;
  text: string;
  command: string;
  disabled: boolean;
  onRun: (command: string) => void;
  onSkip: () => void;
}) {
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className="my-2 rounded border border-accent bg-accent-soft px-3 py-2">
      <div className="flex items-center gap-3 text-[11px] text-faint">
        <span className="text-accent">{`tour ${step + 1}/${total}`}</span>
        <span className="h-1 flex-1 overflow-hidden rounded bg-surface-2" aria-hidden="true">
          <span className="block h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round((step / total) * 100)}%` }} />
        </span>
        <button type="button" onPointerDown={keepFocus} onClick={onSkip} className="hover:text-text" aria-label="Skip the tour">
          ✕
        </button>
      </div>
      <p className="mt-1" aria-live="polite">
        <span className="text-muted">{text}</span>{" "}
        <button type="button" disabled={disabled} onPointerDown={keepFocus} onClick={() => onRun(command)} className="text-accent hover:underline disabled:opacity-50">
          {`▸ ${command}`}
        </button>
      </p>
    </div>
  );
}
