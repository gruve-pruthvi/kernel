import { describe, expect, it } from "vitest";
import { rawPortfolio } from "../content";
import { validatePortfolio } from "@/core/content";

// The rest of the suite runs against tests/fixtures/content. This file checks the real content/ that ships.
describe("content/ (what the site ships)", () => {
  it("passes the schema and integrity checks", () => {
    expect(() => validatePortfolio(rawPortfolio)).not.toThrow();
  });
});
