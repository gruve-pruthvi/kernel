"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { neighbours, resolveFocus, type GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { GraphList } from "./GraphList";
import { GraphPanel } from "./GraphPanel";

const COLOR = { system: "var(--g-system)", technology: "var(--g-technology)", capability: "var(--g-capability)" };

export function SkillGraph({ nodes, edges }: { nodes: PositionedNode[]; edges: GraphEdge[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [hover, setHover] = useState<string | null>(null);

  const graph = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const focus = useMemo(() => resolveFocus(graph, params.get("focus")), [graph, params]);

  const setFocus = (id: string | null) => {
    router.replace(id ? `${pathname}?focus=${encodeURIComponent(id)}` : pathname, { scroll: false });
  };

  const active = useMemo(() => (hover ? [hover] : focus), [hover, focus]);
  const lit = useMemo(() => {
    const set = new Set<string>(active);
    active.forEach((id) => neighbours(graph, id).forEach((n) => set.add(n)));
    return set;
  }, [active, graph]);
  const hasActive = active.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <svg viewBox="0 0 1000 640" className="h-auto w-full" role="group" aria-label="Engineering graph">
          {edges.map((e) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            const on = hasActive && lit.has(e.source) && lit.has(e.target) && (active.includes(e.source) || active.includes(e.target));
            return (
              <line
                key={`${e.source}-${e.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={on ? "var(--accent)" : "var(--border-strong)"}
                strokeOpacity={hasActive && !on ? 0.15 : on ? 0.9 : 0.5}
                strokeWidth={on ? 1.5 : 1}
                className="transition-[stroke-opacity] duration-200"
              />
            );
          })}
          {nodes.map((n) => {
            const isFocus = active.includes(n.id);
            const dim = hasActive && !lit.has(n.id);
            const showLabel = n.type === "system" || lit.has(n.id) || n.degree >= 4;
            const size = n.type === "system" ? 9 : n.type === "capability" ? 7 : 5 + Math.min(3, n.degree / 2);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                opacity={dim ? 0.2 : 1}
                className="cursor-pointer outline-none transition-opacity duration-200"
                tabIndex={0}
                role="button"
                aria-label={`${n.type} ${n.label}`}
                aria-pressed={focus.includes(n.id)}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onClick={() => setFocus(focus.length === 1 && focus[0] === n.id ? null : n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setFocus(focus.length === 1 && focus[0] === n.id ? null : n.id);
                  }
                }}
              >
                <circle r={size + 10} fill="transparent" />
                {isFocus && <circle r={size + 6} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
                {n.type === "system" && <rect x={-size} y={-size} width={size * 2} height={size * 2} rx="3" fill={COLOR.system} />}
                {n.type === "capability" && <rect x={-size} y={-size} width={size * 2} height={size * 2} transform="rotate(45)" fill={COLOR.capability} />}
                {n.type === "technology" && <circle r={size} fill={COLOR.technology} />}
                {showLabel && (
                  <text
                    y={size + 16}
                    textAnchor="middle"
                    className={`pointer-events-none text-[12px] ${n.type === "system" ? "fill-[var(--text)] font-semibold" : "fill-[var(--text-muted)]"}`}
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="md:hidden">
        <GraphList graph={graph} focus={focus} onFocus={setFocus} />
      </div>
      <aside className="hidden rounded-lg border border-border bg-surface p-5 md:block lg:self-start" aria-live="polite">
        <GraphPanel graph={graph} focus={focus} onFocus={setFocus} />
      </aside>
    </div>
  );
}
