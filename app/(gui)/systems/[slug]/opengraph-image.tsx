import { getSystem, getSystems } from "@/core/content";
import { systemNumber } from "@/core/format";
import { OG_SIZE, shareCard } from "@/lib/og";

export const alt = "A system in the Kernel portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getSystems().map((s) => ({ slug: s.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSystem(slug) ?? getSystems()[0];
  const impact = s.impact?.[0];
  return shareCard({
    eyebrow: `SYSTEM / ${systemNumber(s.number)} · ${s.status.toUpperCase()}`,
    title: s.name,
    subtitle: s.tagline,
    prompt: `open ${s.slug}`,
    footer: impact ? `${impact.value} ${impact.label}` : s.category,
  });
}
