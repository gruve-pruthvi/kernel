import type { Metadata } from "next";
import { Suspense } from "react";
import { GraphStatic } from "@/components/graph/GraphStatic";
import { SkillGraph } from "@/components/graph/SkillGraph";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";

export const metadata: Metadata = { title: "Graph", description: "Technologies, capabilities and systems as one connected map." };

export default function GraphPage() {
  const { nodes, edges } = layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 });
  return (
    <div className="py-14 sm:py-20">
      <SectionLabel>Graph</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Skills, with receipts.</h1>
      <p className="mt-3 max-w-2xl text-muted">No logo walls. Every technology links to the systems that prove it.</p>
      <div className="mt-10">
        <Suspense fallback={<GraphStatic nodes={nodes} edges={edges} />}>
          <SkillGraph nodes={nodes} edges={edges} />
        </Suspense>
      </div>
    </div>
  );
}
