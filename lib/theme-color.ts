export const THEME_COLORS = { dark: "#0e0f11", light: "#f6f4ef" } as const;

export function themeColorFor(theme: string | null): string {
  return theme === "light" ? THEME_COLORS.light : THEME_COLORS.dark;
}

/** Keeps the browser chrome colour in step with the site theme (not the OS preference). */
export function applyThemeColor(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = themeColorFor(theme);
}
