"use client";

import { useEffect } from "react";
import { kernel, useKernel } from "@/lib/store";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function Overlays() {
  const commandOpen = useKernel((s) => s.commandOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (commandOpen) kernel.closeCommand();
        else kernel.openCommand();
        return;
      }
      if (e.key === "Escape") {
        kernel.closeCommand();
        kernel.closeQuery();
        return;
      }
      if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        kernel.openQuery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen]);

  return null;
}
