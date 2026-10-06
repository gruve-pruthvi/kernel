import type { Metadata } from "next";
import { Shell } from "@/components/kernel/Shell";
import { portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";
import { welcome } from "@/core/shell/welcome";

export const metadata: Metadata = { title: "Shell", description: "The Kernel terminal: explore the portfolio with ls, cd, grep, man, run and plain-English questions." };

export default function ShellPage() {
  const graph = layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 });
  return (
    <main id="main">
      <h1 className="sr-only">
        {portfolio.identity.name} — {portfolio.identity.role}
      </h1>
      <Shell graph={graph} initial={welcome(portfolio)} />
    </main>
  );
}
