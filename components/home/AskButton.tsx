"use client";

import { btnGhost } from "@/components/ui/styles";
import { kernel } from "@/lib/store";

export function AskButton({ label = "Ask Kernel", seed }: { label?: string; seed?: string }) {
  return (
    <button type="button" onClick={() => kernel.openQuery(seed)} className={btnGhost}>
      {label}
    </button>
  );
}
