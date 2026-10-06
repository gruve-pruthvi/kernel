"use client";

import { useSyncExternalStore } from "react";
import { isMode, MENU_KEY, MODE_KEY, type Mode } from "@/core/boot";
import type { OutputItem } from "@/core/shell/types";
import { applyThemeColor } from "./theme-color";

export type KernelState = {
  mode: Mode;
  theme: "dark" | "light";
  queryOpen: boolean;
  querySeed: string | null;
  queryNonce: number;
  /** Boot lines the bootloader hands to /shell so the transcript continues where the overlay stopped. */
  bootHandoff: OutputItem[] | null;
  /** One-line "switching to …" flash shown while changing modes; null when idle. */
  reboot: string | null;
};

const initial: KernelState = {
  mode: "human",
  theme: "dark",
  queryOpen: false,
  querySeed: null,
  queryNonce: 0,
  bootHandoff: null,
  reboot: null,
};

let state = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  remove("kernel:recruiter"); // legacy flag (motion-off recruiter mode), superseded by kernel:mode
  const mode = read(MODE_KEY);
  state = {
    ...state,
    mode: isMode(mode) ? mode : "human",
    theme: read("kernel:theme") === "light" ? "light" : "dark",
  };
}

function set(patch: Partial<KernelState>) {
  hydrate();
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function kernelSnapshot(): KernelState {
  hydrate();
  return state;
}

export function readBootPrefs(): { storedMode: Mode | null; menuSeen: boolean } {
  const mode = read(MODE_KEY);
  return { storedMode: isMode(mode) ? mode : null, menuSeen: read(MENU_KEY) === "seen" };
}

export const kernel = {
  setMode(mode: Mode) {
    set({ mode });
    write(MODE_KEY, mode);
    write(MENU_KEY, "seen");
  },
  handOff(items: OutputItem[]) {
    set({ bootHandoff: items });
  },
  takeHandoff(): OutputItem[] | null {
    hydrate();
    const items = state.bootHandoff;
    if (items) state = { ...state, bootHandoff: null };
    return items;
  },
  setReboot(text: string | null) {
    set({ reboot: text });
  },
  toggleTheme() {
    hydrate();
    const theme = state.theme === "dark" ? "light" : "dark";
    set({ theme });
    write("kernel:theme", theme);
    document.documentElement.dataset.theme = theme;
    applyThemeColor(theme);
  },
  openQuery(seed?: string) {
    hydrate();
    set({ queryOpen: true, querySeed: seed ?? null, queryNonce: state.queryNonce + 1 });
  },
  closeQuery() {
    set({ queryOpen: false, querySeed: null });
  },
};

export function useKernel<T>(selector: (s: KernelState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return selector(state);
    },
    () => selector(initial),
  );
}
