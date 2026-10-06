import { afterEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { Analytics } from "@/components/shell/Analytics";
import { portfolio } from "@/core/content";
import { siteUrl } from "@/lib/site";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL without a trailing slash", () => {
    expect(siteUrl()).toBe("http://localhost:3000");
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev/";
    expect(siteUrl()).toBe("https://kernel.example.dev");
  });
});

describe("sitemap", () => {
  it("lists the shell, gui pages and every system", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev";
    const urls = sitemap().map((e) => e.url);
    for (const path of ["", "/systems", "/graph", "/trace", "/human", "/connect"]) expect(urls).toContain(`https://kernel.example.dev${path}`);
    for (const s of portfolio.systems) expect(urls).toContain(`https://kernel.example.dev/systems/${s.slug}`);
  });
});

describe("robots", () => {
  it("allows crawling except the API and points at the sitemap", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kernel.example.dev";
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: "/api/" });
    expect(r.sitemap).toBe("https://kernel.example.dev/sitemap.xml");
  });
});

describe("Analytics", () => {
  it("renders nothing unless configured", () => {
    expect(Analytics()).toBeNull();
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "kernel.example.dev";
    expect(Analytics()).not.toBeNull();
  });
});
