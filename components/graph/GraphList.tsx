"use client";

import { useState } from "react";
import { neighbours, type Graph, type GraphNodeType } from "@/core/graph";

const SECTIONS: { type: GraphNodeType; label: string }[] = [
  { type: "system", label: "Systems" },
  { type: "capability", label: "Capabilities" },
  { type: "technology", label: "Technologies" },
];

export function GraphList({ graph, focus, onFocus }: { graph: Graph; focus: string[]; onFocus: (id: string | null) => void }) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter nodes…"
        aria-label="Filter graph nodes"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-faint"
      />
      {SECTIONS.map(({ type, label }) => {
        const items = graph.nodes.filter((n) => n.type === type && (!q || n.label.toLowerCase().includes(q)));
        if (items.length === 0) return null;
        return (
          <section key={type} className="mt-6">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">{label}</h2>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {items.map((n) => {
                const open = focus.includes(n.id);
                const linked = graph.nodes.filter((x) => neighbours(graph, n.id).has(x.id));
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => onFocus(open ? null : n.id)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm ${open ? "text-accent" : "text-text"}`}
                    >
                      {n.label}
                      <span className="font-mono text-[11px] text-faint">{linked.length}</span>
                    </button>
                    {open && (
                      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                        {linked.map((x) => (
                          <button
                            key={x.id}
                            type="button"
                            onClick={() => onFocus(x.id)}
                            className="rounded border border-border px-2 py-0.5 text-xs text-muted"
                          >
                            {x.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
