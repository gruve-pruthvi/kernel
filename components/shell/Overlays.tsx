"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { QueryPanel } from "@/components/query/QueryPanel";
import { kernel } from "@/lib/store";

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
        if (pathname !== "/") router.push("/");
        else document.querySelector<HTMLInputElement>('input[aria-label="Kernel shell input"]')?.focus();
        return;
      }
      if (e.key === "Escape") {
        kernel.closeQuery();
        return;
      }
      if (e.key === "/" && pathname !== "/" && !isTyping(e.target)) {
        e.preventDefault();
        kernel.openQuery();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  return <QueryPanel />;
}
