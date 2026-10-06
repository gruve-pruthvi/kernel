import type { MetadataRoute } from "next";
import { getSystems } from "@/core/content";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    ...["/shell", "/systems", "/graph", "/trace", "/connect"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...getSystems().map((s) => ({ url: `${base}/systems/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
