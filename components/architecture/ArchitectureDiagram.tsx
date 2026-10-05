"use client";

import type { Architecture, NodeKind } from "@/core/schema";
import { edgePath, NODE, toView, VIEW } from "./geometry";

const KIND_COLOR: Record<NodeKind, string> = {
  client: "var(--k-client)",
  service: "var(--k-service)",
  agent: "var(--k-agent)",
  model: "var(--k-model)",
  store: "var(--k-store)",
  queue: "var(--k-queue)",
  external: "var(--k-external)",
};

export function ArchitectureDiagram({
  architecture,
  focusId,
  activeId,
  motion,
  onHover,
  onSelect,
}: {
  architecture: Architecture;
  focusId: string | null;
  activeId: string | null;
  motion: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const pos = new Map(architecture.nodes.map((n) => [n.id, toView(n.x, n.y)]));
  const lit = focusId ?? activeId;
  const connected = new Set<string>();
  if (lit) {
    connected.add(lit);
    for (const e of architecture.edges) {
      if (e.from === lit) connected.add(e.to);
      if (e.to === lit) connected.add(e.from);
    }
  }
  const dim = (id: string) => Boolean(lit) && !connected.has(id);

  return (
    <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="h-auto w-full min-w-[720px]" role="group" aria-label="System architecture">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--border-strong)" />
        </marker>
        <marker id="arrow-lit" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {architecture.edges.map((e, i) => {
        const a = pos.get(e.from)!;
        const b = pos.get(e.to)!;
        const { d, mid } = edgePath(a, b);
        const isLit = Boolean(lit) && (e.from === lit || e.to === lit);
        return (
          <g key={`${e.from}-${e.to}-${i}`} opacity={lit && !isLit ? 0.25 : 1} className="transition-opacity duration-200">
            <path d={d} fill="none" stroke={isLit ? "var(--accent)" : "var(--border-strong)"} strokeWidth={isLit ? 1.6 : 1.2} markerEnd={`url(#${isLit ? "arrow-lit" : "arrow"})`} />
            {motion && (
              <path d={d} fill="none" stroke="var(--accent)" strokeOpacity={isLit ? 0.9 : 0.35} strokeWidth="1.2" className="edge-flow" />
            )}
            {e.label && (
              <text x={mid.x} y={mid.y - 6} textAnchor="middle" className="fill-[var(--text-faint)] font-mono text-[11px]">
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {architecture.nodes.map((n) => {
        const p = pos.get(n.id)!;
        const color = KIND_COLOR[n.kind];
        const isFocus = n.id === focusId;
        const isActive = n.id === activeId;
        return (
          <g
            key={n.id}
            transform={`translate(${p.x - NODE.width / 2} ${p.y - NODE.height / 2})`}
            opacity={dim(n.id) ? 0.35 : 1}
            className="cursor-pointer outline-none transition-opacity duration-200"
            tabIndex={0}
            role="button"
            aria-label={`${n.label}: ${n.description}`}
            aria-pressed={isFocus}
            onMouseEnter={() => onHover(n.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(n.id)}
            onBlur={() => onHover(null)}
            onClick={() => onSelect(n.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(n.id);
              }
            }}
          >
            {isActive && motion && (
              <rect width={NODE.width} height={NODE.height} rx="10" fill="none" stroke="var(--accent)" strokeWidth="2" className="pulse-ring" />
            )}
            <rect
              width={NODE.width}
              height={NODE.height}
              rx="10"
              fill={isActive ? "var(--accent-soft)" : "var(--surface-2)"}
              stroke={isFocus || isActive ? "var(--accent)" : color}
              strokeWidth={isFocus || isActive ? 2 : 1.2}
            />
            <rect x="12" y={NODE.height / 2 - 4} width="8" height="8" rx="2" fill={color} />
            <text x="28" y={NODE.height / 2 - 3} className="fill-[var(--text)] text-[13px] font-medium" dominantBaseline="middle">
              {n.label}
            </text>
            <text x="28" y={NODE.height / 2 + 12} className="fill-[var(--text-faint)] font-mono text-[10px] uppercase tracking-wider" dominantBaseline="middle">
              {n.kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
