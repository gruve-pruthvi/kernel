"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { actionToHref, type UiAction } from "@/core/actions";
import { kernel } from "./store";

export function useRunAction() {
  const router = useRouter();
  return useCallback(
    (action: UiAction) => {
      if (action.type === "switchMode") kernel.setMode(action.mode);
      const href = actionToHref(action);
      if (href) router.push(href);
    },
    [router],
  );
}
