import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

describe("boot CSS contract", () => {
  it("covers the page before hydration and removes the cover after 1.5 s", () => {
    expect(css).toMatch(/:root\[data-boot="on"\] body::after\s*\{[^}]*position:\s*fixed[^}]*animation:\s*kernel-boot-watchdog 0s linear 1\.5s forwards/);
    expect(css).toMatch(/@keyframes kernel-boot-watchdog\s*\{\s*to\s*\{\s*visibility:\s*hidden/);
  });

  it("locks scrolling only while the overlay is live", () => {
    expect(css).toMatch(/:root\[data-boot="live"\] body\s*\{\s*overflow:\s*hidden/);
    expect(css).not.toMatch(/:root\[data-boot="on"\] body\s*\{\s*overflow/);
  });

  it("front-page morph names exist only when the boot overlay is gone", () => {
    expect(css).toMatch(/\.vt-boot\s*\{\s*view-transition-name:\s*var\(--vt\)/);
    expect(css).toMatch(/:root\[data-boot\] \.vt-boot\s*\{\s*view-transition-name:\s*none/);
  });
});
