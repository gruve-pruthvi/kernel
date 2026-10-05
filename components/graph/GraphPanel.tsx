"use client";

import Link from "next/link";
import { neighbours, nodeHref, type Graph, type GraphNodeType } from "@/core/graph";

const TYPE_LABEL: Record<GraphNodeType, string> = { system: "Systems", capability: "Capabilities", technology: "Technologies" };
const ORDER: GraphNodeType[] = ["system", "capability", "technology"];

export function GraphPanel({ graph, focus, onFocus }: { graph: Graph; focus: string[]; onFocus: (id: string | null) => void }) {
  if (focus.length === 0) {
    return (
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Engineering graph</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Every system connects to the technologies it uses and the capabilities it demonstrates. Select any node to trace its
          connections.
        </p>
        <ul className="mt-5 space-y-2 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-[var(--g-system)]" aria-hidden /> System
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rotate-45 bg-[var(--g-capability)]" aria-hidden /> Capability
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[var(--g-technology)]" aria-hidden /> Technology
          </li>
        </ul>
      </div>
    );
  }

  const focused = focus.map((id) => graph.nodes.find((n) => n.id === id)!).filter(Boolean);
  const related = new Set<string>();
  focus.forEach((id) => neighbours(graph, id).forEach((n) => related.add(n)));
  focus.forEach((id) => related.delete(id));
  const relatedNodes = graph.nodes.filter((n) => related.has(n.id));

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            {focused.length === 1 ? focused[0].type : `${focused.length} selected`}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{focused.map((n) => n.label).join(" + ")}</h2>
        </div>
        <button type="button" onClick={() => onFocus(null)} className="font-mono text-xs text-muted hover:text-text" aria-label="Clear selection">
          ×
        </button>
      </div>
      {focused.length === 1 && focused[0].type === "system" && (
        <Link href={nodeHref(focused[0])} className="mt-3 inline-block font-mono text-xs text-accent hover:underline">
          open case study →
        </Link>
      )}
      <div className="mt-5 space-y-4">
        {ORDER.map((type) => {
          const items = relatedNodes.filter((n) => n.type === type);
          if (items.length === 0) return null;
          return (
            <div key={type}>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-faint">{TYPE_LABEL[type]}</p>
              <ul className="flex flex-wrap gap-1.5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onFocus(n.id)}
                      className="rounded border border-border px-2 py-0.5 text-xs text-muted transition hover:border-border-strong hover:text-text"
                    >
                      {n.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
