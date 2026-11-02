import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FrontPage from "@/app/(gui)/page";
import { portfolio } from "@/core/content";
import { ProofStrip } from "@/components/front/ProofStrip";
import { askChips, flagships } from "@/core/front";

describe("front page SSR", () => {
  it("server-renders the recruiter view with real content and the morph hooks", () => {
    const html = renderToString(<FrontPage />);
    expect(html).toContain(portfolio.identity.name);
    expect(html).toContain(portfolio.identity.role);
    expect(html).toContain('id="human"');
    expect(html).toContain('id="ask"');
    for (const chip of askChips(portfolio)) expect(html).toContain(chip.replace(/'/g, "&#x27;"));
    expect(html).toContain("--vt:kernel-name");
    for (const s of flagships(portfolio)) {
      expect(html).toContain(`--vt:boot-system-${s.slug}`);
      expect(html).toContain(`href="/systems/${s.slug}"`);
    }
  });
});

describe("ProofStrip", () => {
  const stat = (slug: string) => ({ value: "70%", label: "faster", slug });

  it("sizes its grid to the number of stats so no empty cells show", () => {
    expect(renderToString(<ProofStrip stats={[stat("a")]} />)).toContain("sm:grid-cols-1");
    expect(renderToString(<ProofStrip stats={[stat("a"), stat("b")]} />)).toContain("sm:grid-cols-2");
    expect(renderToString(<ProofStrip stats={[stat("a"), stat("b"), stat("c")]} />)).toContain("sm:grid-cols-3");
    expect(renderToString(<ProofStrip stats={[stat("a")]} />)).not.toContain("sm:grid-cols-3");
  });
});
