"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryPanel } from "@/components/query/QueryPanel";
import { modeForPath } from "@/core/boot";
import { kernel, kernelSnapshot, readBootPrefs, useKernel } from "@/lib/store";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function Overlays() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (pathname !== "/shell") router.push("/shell");
        else document.querySelector<HTMLInputElement>('input[aria-label="Kernel shell input"]')?.focus();
        return;
      }
      if (e.key === "Escape") {
        kernel.closeQuery();
        return;
      }
      if (e.key === "/" && pathname !== "/shell" && !isTyping(e.target)) {
        e.preventDefault();
        kernel.openQuery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  // After the visitor has booted once, remember whichever mode they are using (so the next visit opens there).
  useEffect(() => {
    if (document.documentElement.dataset.boot || !readBootPrefs().menuSeen) return;
    const mode = modeForPath(pathname);
    if (kernelSnapshot().mode !== mode) kernel.setMode(mode);
  }, [pathname]);
  const reboot = useKernel((s) => s.reboot);

  return (
    <>
      <QueryPanel />
      {reboot && (
        <div role="status" className="fixed inset-0 z-[70] grid place-items-center bg-bg font-mono text-sm text-[var(--k-store)]">
          {reboot}
        </div>
      )}
    </>
  );
}
