import type { GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";

const COLOR = { system: "var(--g-system)", technology: "var(--g-technology)", capability: "var(--g-capability)" };

export function HeroGraph({ nodes, edges }: { nodes: PositionedNode[]; edges: GraphEdge[] }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg
      viewBox="0 0 1000 640"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.35] [mask-image:radial-gradient(ellipse_at_70%_40%,black_20%,transparent_70%)]"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {edges.map((e) => {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) return null;
        return <line key={`${e.source}-${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border-strong)" strokeWidth="1" />;
      })}
      {nodes.map((n, i) => (
        <circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={n.type === "system" ? 5 : 3}
          fill={COLOR[n.type]}
          className={n.type === "system" ? "pulse-ring motion-optional" : undefined}
          style={n.type === "system" ? { animationDelay: `${i * 0.4}s`, animationDuration: "3s" } : undefined}
        />
      ))}
    </svg>
  );
}
