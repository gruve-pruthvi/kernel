import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { Graph, GraphEdge, GraphNode } from "./graph";

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  degree: number;
}

type SimNode = GraphNode & SimulationNodeDatum & { degree: number };

export function layoutGraph(
  g: Graph,
  size: { width: number; height: number },
): { nodes: PositionedNode[]; edges: GraphEdge[] } {
  const degree = new Map<string, number>();
  for (const e of g.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  const nodes: SimNode[] = g.nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 }));
  const links = g.edges.map((e) => ({ source: e.source, target: e.target }));
  const cx = size.width / 2;
  const cy = size.height / 2;

  forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, { source: string; target: string }>(links)
        .id((d) => d.id)
        .distance((l) => ((l.source as unknown as SimNode).type === "system" ? 90 : 70))
        .strength(0.6),
    )
    .force("charge", forceManyBody<SimNode>().strength((d) => (d.type === "system" ? -520 : -240)))
    .force("collide", forceCollide<SimNode>((d) => (d.type === "technology" ? 26 : 34)))
    .force("center", forceCenter(cx, cy))
    .force("x", forceX<SimNode>(cx).strength(0.06))
    .force("y", forceY<SimNode>(cy).strength(0.1))
    .stop()
    .tick(400);

  const pad = 40;
  const xs = nodes.map((n) => n.x ?? cx);
  const ys = nodes.map((n) => n.y ?? cy);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scaleX = (size.width - pad * 2) / Math.max(1, maxX - minX);
  const scaleY = (size.height - pad * 2) / Math.max(1, maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (size.width - (maxX - minX) * scale) / 2;
  const offsetY = (size.height - (maxY - minY) * scale) / 2;

  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      ref: n.ref,
      label: n.label,
      degree: n.degree,
      x: Math.round(((n.x ?? cx) - minX) * scale + offsetX),
      y: Math.round(((n.y ?? cy) - minY) * scale + offsetY),
    })),
    edges: g.edges.map((e) => ({ source: e.source, target: e.target })),
  };
}
