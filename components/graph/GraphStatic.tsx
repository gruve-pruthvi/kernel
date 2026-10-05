import Link from "next/link";
import { neighbours, nodeHref, type GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";

const COLOR = { system: "var(--g-system)", technology: "var(--g-technology)", capability: "var(--g-capability)" };

// Server-rendered graph shown before hydration (and without JavaScript).
export function GraphStatic({ nodes, edges }: { nodes: PositionedNode[]; edges: GraphEdge[] }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const graph = { nodes, edges };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <svg viewBox="0 0 1000 640" className="h-auto w-full" role="img" aria-label="Engineering graph">
          {edges.map((e) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            return <line key={`${e.source}-${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border-strong)" strokeOpacity={0.5} />;
          })}
          {nodes.map((n) => {
            const size = n.type === "system" ? 9 : n.type === "capability" ? 7 : 5 + Math.min(3, n.degree / 2);
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                {n.type === "system" && <rect x={-size} y={-size} width={size * 2} height={size * 2} rx="3" fill={COLOR.system} />}
                {n.type === "capability" && <rect x={-size} y={-size} width={size * 2} height={size * 2} transform="rotate(45)" fill={COLOR.capability} />}
                {n.type === "technology" && <circle r={size} fill={COLOR.technology} />}
                {(n.type === "system" || n.degree >= 4) && (
                  <text y={size + 16} textAnchor="middle" className={`text-[12px] ${n.type === "system" ? "fill-[var(--text)] font-semibold" : "fill-[var(--text-muted)]"}`}>
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="space-y-3 md:hidden">
        {nodes
          .filter((n) => n.type === "technology")
          .map((t) => (
            <li key={t.id} className="text-sm">
              <span className="text-text">{t.label}</span>{" "}
              <span className="text-muted">
                →{" "}
                {nodes
                  .filter((n) => n.type === "system" && neighbours(graph, t.id).has(n.id))
                  .map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ", "}
                      <Link href={nodeHref(s)} className="underline-offset-2 hover:underline">
                        {s.label}
                      </Link>
                    </span>
                  ))}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
