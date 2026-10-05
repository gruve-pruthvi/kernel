"use client";

import { useState } from "react";

export function CopyButton({ value, label = "copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
      className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted transition hover:border-border-strong hover:text-text"
      aria-live="polite"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
