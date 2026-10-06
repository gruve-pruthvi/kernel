import { describe, expect, it } from "vitest";
import { THEME_COLORS, themeColorFor } from "@/lib/theme-color";

describe("themeColorFor", () => {
  it("follows the site theme, defaulting to dark", () => {
    expect(themeColorFor("light")).toBe(THEME_COLORS.light);
    expect(themeColorFor("dark")).toBe(THEME_COLORS.dark);
    expect(themeColorFor(null)).toBe(THEME_COLORS.dark);
  });
});
