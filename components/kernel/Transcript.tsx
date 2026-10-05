"use client";

import { portfolio } from "@/core/content";
import { pathOf } from "@/core/shell/fs";
import type { Line, OutputItem, Seg, Tone } from "@/core/shell/types";
import { neofetchData } from "@/core/shell/welcome";

export const TONE: Record<Tone, string> = {
  text: "text-text",
  muted: "text-muted",
  faint: "text-faint",
  accent: "text-accent",
  error: "text-[var(--k-model)]",
  ok: "text-[var(--k-store)]",
  dir: "text-[var(--k-client)]",
  view: "text-[var(--k-service)]",
  link: "text-[var(--k-queue)]",
  warn: "text-[var(--k-queue)]",
  heading: "font-semibold text-text",
  match: "bg-accent-soft text-accent",
};

export type Row = { id: number; kind: "prompt"; cwd: string[]; text: string } | { id: number; kind: "item"; item: OutputItem };

export function SegView({ seg, onRun }: { seg: Seg; onRun: (command: string) => void }) {
  const cls = TONE[seg.tone ?? "text"];
  if (seg.run) {
    const command = seg.run;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRun(command);
        }}
        className={`${cls} cursor-pointer underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid`}
      >
        {seg.text}
      </button>
    );
  }
  if (seg.href) {
    const external = /^https?:/.test(seg.href);
    return (
      <a
        href={seg.href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`${cls} underline underline-offset-4`}
      >
        {seg.text}
      </a>
    );
  }
  return <span className={cls}>{seg.text}</span>;
}

export function LineView({ line, onRun }: { line: Line; onRun: (command: string) => void }) {
  return (
    <div className="min-h-[1.65em] whitespace-pre-wrap break-words">
      {line.map((s, i) => (
        <SegView key={i} seg={s} onRun={onRun} />
      ))}
    </div>
  );
}

export function PromptText({ cwd }: { cwd: string[] }) {
  return (
    <>
      <span className="text-accent">kernel</span> <span className={TONE.dir}>{pathOf(cwd)}</span>
      <span className="text-faint"> $ </span>
    </>
  );
}

const LOGO = [" _  __", "| |/ /", "| ' / ", "| . \\ ", "|_|\\_\\"].join("\n");
const SWATCHES = ["--k-client", "--k-service", "--k-agent", "--k-model", "--k-store", "--k-queue", "--k-external"];

export function Neofetch() {
  const { handle, rows } = neofetchData(portfolio);
  return (
    <div className="my-1 flex flex-col gap-3 sm:flex-row sm:gap-8">
      <pre aria-hidden="true" className="shrink-0 text-[15px] font-bold leading-[1.15] text-accent">
        {LOGO}
      </pre>
      <div>
        <p>
          <span className="text-accent">{handle}</span>
          <span className="text-faint">@</span>
          <span className="text-accent">kernel</span>
        </p>
        <p aria-hidden="true" className="text-faint">
          {"─".repeat(30)}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className={TONE.dir}>{r.label}</dt>
              <dd className={TONE[r.tone ?? "text"]}>
                {r.href ? (
                  <a href={r.href} className="underline underline-offset-4">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p aria-hidden="true" className="mt-2 flex">
          {SWATCHES.map((k) => (
            <span key={k} className="h-3.5 w-6" style={{ background: `var(${k})` }} />
          ))}
        </p>
      </div>
    </div>
  );
}

export function Transcript({ rows, onRun }: { rows: Row[]; onRun: (command: string) => void }) {
  return (
    <>
      {rows.map((row) =>
        row.kind === "prompt" ? (
          <div key={row.id} className="min-h-[1.65em] whitespace-pre-wrap break-words">
            <PromptText cwd={row.cwd} />
            {row.text}
          </div>
        ) : "block" in row.item ? (
          <Neofetch key={row.id} />
        ) : (
          <LineView key={row.id} line={row.item.line} onRun={onRun} />
        ),
      )}
    </>
  );
}
