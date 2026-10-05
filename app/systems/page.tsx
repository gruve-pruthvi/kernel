import type { Metadata } from "next";
import { Suspense } from "react";
import { SystemsExplorer } from "@/components/systems/SystemsExplorer";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getCapabilities, getSystems, getTechnologies } from "@/core/content";

export const metadata: Metadata = { title: "Systems", description: "Engineering case studies you can inspect." };

export default function SystemsPage() {
  return (
    <div className="py-14 sm:py-20">
      <SectionLabel>Systems</SectionLabel>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Things I&apos;ve built, opened up.</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Every system has an architecture you can inspect, the decisions behind it, and a simulated request you can run.
      </p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <SystemsExplorer systems={getSystems()} technologies={getTechnologies()} capabilities={getCapabilities()} />
        </Suspense>
      </div>
    </div>
  );
}
