import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FrontPage from "@/app/(gui)/page";
import { portfolio } from "@/core/content";
import { flagships } from "@/core/front";

describe("front page SSR", () => {
  it("server-renders the recruiter view with real content and the morph hooks", () => {
    const html = renderToString(<FrontPage />);
    expect(html).toContain(portfolio.identity.name);
    expect(html).toContain(portfolio.identity.role);
    expect(html).toContain('id="human"');
    expect(html).toContain('id="ask-slot"');
    expect(html).toContain("--vt:kernel-name");
    for (const s of flagships(portfolio)) {
      expect(html).toContain(`--vt:boot-system-${s.slug}`);
      expect(html).toContain(`href="/systems/${s.slug}"`);
    }
  });
});
