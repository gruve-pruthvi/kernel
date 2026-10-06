"use client";

import { useSyncExternalStore } from "react";
import { applyThemeColor } from "./theme-color";

export type KernelState = {
  recruiter: boolean;
  theme: "dark" | "light";
  queryOpen: boolean;
  querySeed: string | null;
  queryNonce: number;
};

const initial: KernelState = {
  recruiter: false,
  theme: "dark",
  queryOpen: false,
  querySeed: null,
  queryNonce: 0,
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

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = {
    ...state,
    recruiter: read("kernel:recruiter") === "on",
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

export const kernel = {
  setRecruiter(on: boolean) {
    set({ recruiter: on });
    write("kernel:recruiter", on ? "on" : "off");
    document.documentElement.dataset.recruiter = on ? "on" : "off";
  },
  toggleRecruiter() {
    hydrate();
    kernel.setRecruiter(!state.recruiter);
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
