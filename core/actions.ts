import { z } from "zod";
import { buildGraph, resolveNodeId } from "./graph";
import type { Portfolio } from "./schema";

export const uiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), path: z.string().min(1).max(200) }),
  z.object({ type: z.literal("openSystem"), slug: z.string().min(1) }),
  z.object({ type: z.literal("highlightGraph"), ids: z.array(z.string().min(1)).min(1).max(20) }),
  z.object({ type: z.literal("filterSystems"), tech: z.string().optional(), capability: z.string().optional() }),
  z.object({ type: z.literal("toggleRecruiter"), on: z.boolean() }),
]);

export type UiAction = z.infer<typeof uiActionSchema>;

export const INTERNAL_ROUTES = ["/", "/systems", "/graph", "/trace", "/human", "/connect"] as const;

function isInternalPath(path: string, p: Portfolio): boolean {
  if ((INTERNAL_ROUTES as readonly string[]).includes(path)) return true;
  const match = /^\/systems\/([a-z0-9-]+)$/.exec(path);
  return Boolean(match && p.systems.some((s) => s.slug === match[1]));
}

export function validateAction(raw: unknown, p: Portfolio): UiAction | null {
  const parsed = uiActionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data;

  switch (a.type) {
    case "navigate":
      return isInternalPath(a.path, p) ? a : null;
    case "openSystem":
      return p.systems.some((s) => s.slug === a.slug) ? a : null;
    case "highlightGraph": {
      const g = buildGraph(p);
      const ids = [...new Set(a.ids.map((id) => resolveNodeId(g, id)).filter((id): id is string => Boolean(id)))];
      return ids.length > 0 ? { type: "highlightGraph", ids } : null;
    }
    case "filterSystems": {
      if (!a.tech && !a.capability) return null;
      if (a.tech && !p.technologies.some((t) => t.id === a.tech)) return null;
      if (a.capability && !p.capabilities.some((c) => c.id === a.capability)) return null;
      return {
        type: "filterSystems",
        ...(a.tech ? { tech: a.tech } : {}),
        ...(a.capability ? { capability: a.capability } : {}),
      };
    }
    case "toggleRecruiter":
      return a;
  }
}

export function actionToHref(a: UiAction): string | null {
  switch (a.type) {
    case "navigate":
      return a.path;
    case "openSystem":
      return `/systems/${a.slug}`;
    case "highlightGraph":
      return `/graph?focus=${encodeURIComponent(a.ids.join(","))}`;
    case "filterSystems": {
      const params = new URLSearchParams();
      if (a.tech) params.set("tech", a.tech);
      if (a.capability) params.set("capability", a.capability);
      return `/systems?${params.toString()}`;
    }
    case "toggleRecruiter":
      return null;
  }
}

export function describeAction(a: UiAction, p: Portfolio): string {
  switch (a.type) {
    case "navigate":
      return `Went to ${a.path}`;
    case "openSystem":
      return `Opened ${p.systems.find((s) => s.slug === a.slug)?.name ?? a.slug}`;
    case "highlightGraph": {
      const g = buildGraph(p);
      const labels = a.ids.map((id) => g.nodes.find((n) => n.id === id)?.label ?? id);
      return labels.length <= 2
        ? `Highlighted ${labels.join(" and ")} in the graph`
        : `Highlighted ${labels.length} nodes in the graph`;
    }
    case "filterSystems": {
      const parts = [
        a.tech && p.technologies.find((t) => t.id === a.tech)?.name,
        a.capability && p.capabilities.find((c) => c.id === a.capability)?.name,
      ].filter(Boolean);
      return `Filtered systems by ${parts.join(" + ")}`;
    }
    case "toggleRecruiter":
      return `Recruiter mode ${a.on ? "on" : "off"}`;
  }
}
