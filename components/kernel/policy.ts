// Pure UI policy for the shell — unit-tested, imported by Shell.tsx.

export function splitRows<T extends { live?: boolean }>(rows: T[]): { settled: T[]; live: T[] } {
  return { settled: rows.filter((r) => !r.live), live: rows.filter((r) => r.live) };
}

export const optionId = (listId: string, index: number) => `${listId}-${index}`;

export function comboboxProps(
  menu: { items: unknown[]; index: number } | null,
  listId: string,
): { role: "combobox"; "aria-expanded": boolean; "aria-controls"?: string; "aria-activedescendant"?: string; "aria-autocomplete": "list" } {
  return {
    role: "combobox",
    "aria-expanded": Boolean(menu),
    ...(menu ? { "aria-controls": listId } : {}),
    ...(menu && menu.index >= 0 ? { "aria-activedescendant": optionId(listId, menu.index) } : {}),
    "aria-autocomplete": "list",
  };
}

export type MobileKeyId = "tab" | "up" | "cdup" | "ls" | "help" | "clear" | "cancel";

export function mobileKeys(busy: boolean): { id: MobileKeyId; label: string; disabled: boolean }[] {
  const keys: { id: MobileKeyId; label: string }[] = [
    { id: "tab", label: "Tab" },
    { id: "up", label: "↑" },
    { id: "cdup", label: "cd .." },
    { id: "ls", label: "ls" },
    { id: "help", label: "help" },
    { id: "clear", label: "clear" },
  ];
  return [
    ...keys.map((k) => ({ ...k, disabled: busy })),
    ...(busy ? [{ id: "cancel" as const, label: "^C", disabled: false }] : []),
  ];
}

/**
 * Characters to reveal this frame for the typewriter: a steady base rate plus a share of the backlog,
 * so short answers visibly type and large bursts catch up within about a second.
 */
export function drainCount(buffered: number, elapsedMs: number, baseCps = 60, tauMs = 200): number {
  if (buffered <= 0) return 0;
  const n = Math.ceil((baseCps * elapsedMs) / 1000 + (buffered * elapsedMs) / tauMs);
  return Math.min(buffered, Math.max(1, n));
}
