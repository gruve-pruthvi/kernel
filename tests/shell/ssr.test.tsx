import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Transcript, type Row } from "@/components/kernel/Transcript";
import { portfolio } from "@/core/content";
import { handleOf, welcome } from "@/core/shell/welcome";

describe("shell transcript SSR", () => {
  it("server-renders the welcome screen with identity and systems", () => {
    const rows: Row[] = welcome(portfolio).map((item, i) => ({ id: i + 1, kind: "item", item }));
    const html = renderToString(<Transcript rows={rows} onRun={() => {}} />);
    expect(html).toContain(handleOf(portfolio));
    expect(html).toContain(portfolio.identity.role);
    for (const s of portfolio.systems) expect(html).toContain(`>${s.slug}<`);
    expect(html).toContain("<button");
  });

  it("renders prompt rows", () => {
    const html = renderToString(<Transcript rows={[{ id: 1, kind: "prompt", cwd: ["systems"], text: "ls" }]} onRun={() => {}} />);
    expect(html).toContain("~/systems");
    expect(html).toContain("ls");
  });
});
