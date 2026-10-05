"use client";

import { useState } from "react";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { getSystem, portfolio } from "@/core/content";
import { neighbours, type GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { buildFs, pathOf, resolve } from "@/core/shell/fs";
import { styleLine } from "@/core/shell/style";
import type { View } from "@/core/shell/types";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import { LineView } from "./Transcript";

const COLOR = { system: "var(--g-system)", technology: "var(--g-technology)", capability: "var(--g-capability)" };

function title(view: View): string {
  if (view.type === "architecture") return `systems/${view.slug}/architecture`;
  if (view.type === "graph") return "skills/graph";
  return pathOf(view.path).replace(/^~\//, "");
}

export function ViewPane({
  view,
  activeId,
  graph,
  onClose,
  onRun,
}: {
  view: View;
  activeId: string | null;
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  onClose: () => void;
  onRun: (command: string) => void;
}) {
  const motion = useMotionAllowed();
  const [hover, setHover] = useState<string | null>(null);

  return (
    <section className="flex h-full min-h-0 flex-col border-border bg-surface/60 md:border-l" aria-label={`View: ${title(view)}`}>
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-3 text-[11px] text-faint">
        <span className="text-accent">{view.type === "reader" ? "less" : "view"}</span>
        <span className="truncate text-muted">{title(view)}</span>
        <button type="button" onClick={onClose} className="ml-auto hover:text-text" aria-label="Close view (Esc)">
          {view.type === "reader" ? "[q]" : "[esc]"}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {view.type === "architecture" && <ArchitecturePane slug={view.slug} activeId={activeId} hover={hover} setHover={setHover} motion={motion} />}
        {view.type === "graph" && <GraphPane graph={graph} focus={view.focus} hover={hover} setHover={setHover} onRun={onRun} />}
        {view.type === "reader" && <ReaderPane path={view.path} onRun={onRun} />}
      </div>
    </section>
  );
}

function ArchitecturePane({
  slug,
  activeId,
  hover,
  setHover,
  motion,
}: {
  slug: string;
  activeId: string | null;
  hover: string | null;
  setHover: (id: string | null) => void;
  motion: boolean;
}) {
  const system = getSystem(slug);
  if (!system) return null;
  const shown = system.architecture.nodes.find((n) => n.id === (hover ?? activeId));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-border bg-bg [&_svg]:min-w-0">
        <ArchitectureDiagram architecture={system.architecture} focusId={hover} activeId={activeId} motion={motion} onHover={setHover} onSelect={setHover} />
      </div>
      <div className="min-h-16 rounded border border-border p-3 text-[12px] leading-5" aria-live="polite">
        {shown ? (
          <>
            <p>
              <span className="text-accent">{shown.label}</span> <span className="text-faint">({shown.kind})</span>
            </p>
            <p className="text-muted">{shown.description}</p>
          </>
        ) : (
          <p className="text-faint">hover or focus a component · `run {slug}` streams a request through it</p>
        )}
      </div>
    </div>
  );
}

function GraphPane({
  graph,
  focus,
  hover,
  setHover,
  onRun,
}: {
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  focus: string[];
  hover: string | null;
  setHover: (id: string | null) => void;
  onRun: (command: string) => void;
}) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const active = hover ? [hover] : focus;
  const lit = new Set(active);
  active.forEach((id) => neighbours(graph, id).forEach((n) => lit.add(n)));
  const has = active.length > 0;

  return (
    <svg viewBox="0 0 1000 640" className="h-auto w-full" role="group" aria-label="Engineering graph">
      {graph.edges.map((e) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        const on = has && (active.includes(e.source) || active.includes(e.target));
        return <line key={`${e.source}-${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? "var(--accent)" : "var(--border-strong)"} strokeOpacity={has && !on ? 0.12 : 0.6} />;
      })}
      {graph.nodes.map((n) => {
        const size = n.type === "system" ? 9 : n.type === "capability" ? 7 : 5;
        const command = n.type === "system" ? `open ${n.ref}` : `graph ${n.ref}`;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            opacity={has && !lit.has(n.id) ? 0.2 : 1}
            className="cursor-pointer outline-none"
            tabIndex={0}
            role="button"
            aria-label={`${n.type} ${n.label}`}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
            onClick={() => onRun(command)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRun(command);
              }
            }}
          >
            <circle r={size + 8} fill="transparent" />
            {n.type === "system" && <rect x={-size} y={-size} width={size * 2} height={size * 2} rx="3" fill={COLOR.system} />}
            {n.type === "capability" && <rect x={-size} y={-size} width={size * 2} height={size * 2} transform="rotate(45)" fill={COLOR.capability} />}
            {n.type === "technology" && <circle r={size} fill={COLOR.technology} />}
            {(n.type === "system" || lit.has(n.id)) && (
              <text y={size + 16} textAnchor="middle" className="fill-[var(--text-muted)] font-mono text-[12px]">
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ReaderPane({ path, onRun }: { path: string[]; onRun: (command: string) => void }) {
  const node = resolve(buildFs(portfolio), [], path.join("/"));
  if (node?.kind !== "file") return <p className="text-faint">nothing to read here</p>;
  return (
    <article className="text-[13px] leading-[1.7]">
      {node.lines.map((l, i) => (
        <LineView key={i} line={styleLine(l)} onRun={onRun} />
      ))}
    </article>
  );
}
