"use client";

import { useEffect, useMemo, useRef } from "react";
import { portfolio } from "@/core/content";
import { buildGraph } from "@/core/graph";
import { layoutGraph } from "@/core/graph-layout";
import { out, seg } from "@/core/shell/registry";
import { Shell } from "./Shell";

const INTRO = [
  out(
    seg("kernel console", "accent"),
    seg(" — try ", "faint"),
    seg("help", "accent", { run: "help" }),
    seg(" · ", "faint"),
    seg("exit", "accent", { run: "exit" }),
    seg(" closes · ", "faint"),
    seg("fullscreen", "accent", { run: "fullscreen" }),
    seg(" opens the full shell", "faint"),
  ),
];

/** Non-modal drop-down shell over GUI pages. Focus moves into it on open and back to the page on close. */
export default function ConsoleDrawer({ onClose }: { onClose: () => void }) {
  const graph = useMemo(() => layoutGraph(buildGraph(portfolio), { width: 1000, height: 640 }), []);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => returnFocus.current?.focus?.({ preventScroll: true });
  }, []);
  return (
    <div id="kernel-console" role="region" aria-label="Kernel console" className="console-drawer fixed inset-x-0 top-0 z-[45] h-[45vh] min-h-[280px] border-b border-border-strong shadow-2xl">
      <Shell graph={graph} initial={INTRO} variant="console" onExit={onClose} />
    </div>
  );
}
