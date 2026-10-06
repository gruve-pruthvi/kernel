"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { kernel } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/systems", label: "Systems" },
  { href: "/graph", label: "Graph" },
  { href: "/trace", label: "Trace" },
  { href: "/human", label: "Human" },
  { href: "/connect", label: "Connect" },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile menu on navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="font-mono text-[13px] font-medium tracking-[0.35em] text-text">
          KERNEL
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                isActive(l.href) ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => kernel.openQuery()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted transition hover:border-border-strong hover:text-text"
          >
            Ask <Kbd>/</Kbd>
          </button>
          <Link
            href="/"
            aria-label="Open the Kernel shell (⌘K)"
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-muted transition hover:bg-surface-2 hover:text-text sm:inline-flex"
          >
            &gt;_ shell <Kbd>⌘K</Kbd>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 md:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav aria-label="Mobile" className="border-t border-border px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-md px-2 py-2 text-sm ${isActive(l.href) ? "text-text" : "text-muted"}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-border pt-3">
            <Link href="/" className="font-mono text-xs text-muted">
              Shell
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
