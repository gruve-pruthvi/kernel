import { getIdentity, getSystems, portfolio } from "@/core/content";
import { OG_SIZE, shareCard } from "@/lib/og";

export const alt = "Kernel — an interactive engineering portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const id = getIdentity();
  const runnable = getSystems().find((s) => s.simulation) ?? getSystems()[0];
  return shareCard({
    eyebrow: id.role.toUpperCase(),
    title: id.name,
    subtitle: id.tagline,
    prompt: runnable ? `run ${runnable.slug}` : "ls systems",
    footer: `${portfolio.systems.length} systems · ${portfolio.capabilities.length} capabilities`,
  });
}
