import type { Metadata } from "next";
import { AskInline } from "@/components/front/AskInline";
import { Experience } from "@/components/front/Experience";
import { Flagships } from "@/components/front/Flagships";
import { Hero } from "@/components/front/Hero";
import { HowIThink } from "@/components/front/HowIThink";
import { ProofStrip } from "@/components/front/ProofStrip";
import { Stack } from "@/components/front/Stack";
import { portfolio } from "@/core/content";
import { askChips, flagships, proofStats, stackGroups, timeline } from "@/core/front";

const identity = portfolio.identity;

export const metadata: Metadata = { title: { absolute: `${identity.name} — ${identity.role}` }, description: identity.tagline };

export default function FrontPage() {
  return (
    <div className="pb-10">
      <Hero identity={identity} />
      <ProofStrip stats={proofStats(portfolio)} />
      <Flagships systems={flagships(portfolio)} p={portfolio} />
      <AskInline chips={askChips(portfolio)} name={identity.name.split(/\s+/)[0]} />
      <Experience entries={timeline(portfolio)} />
      <Stack groups={stackGroups(portfolio)} />
      <HowIThink identity={identity} />
    </div>
  );
}
