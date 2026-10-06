"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { bootLog, bootLogItems, decideBoot, HYDRATION_WATCHDOG_MS, type BootDecision, type Mode } from "@/core/boot";
import { portfolio } from "@/core/content";
import { kernel, readBootPrefs } from "@/lib/store";

const LINES = bootLog(portfolio);
const LINE_MS = 120;
const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "human", label: "Just show me the work", hint: "30-second read" },
  { mode: "shell", label: "Give me a shell", hint: "for engineers" },
];
/** Shared names with the recruiter page (.vt-boot) so these lines morph into the hero and the cards. */
const vt = (name: string) => ({ viewTransitionName: name, viewTransitionClass: "boot" }) as CSSProperties;

type Phase = "off" | "log" | "menu";

export function BootOverlay() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("off");
  const [decision, setDecision] = useState<BootDecision | null>(null);
  const [shown, setShown] = useState(0);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [reduced, setReduced] = useState(false);
  const done = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Decide once after hydration; the pre-paint script has already covered the page (data-boot="on").
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.boot !== "on") return;
    const q = new URLSearchParams(window.location.search);
    const d = decideBoot({
      ...readBootPrefs(),
      referrer: document.referrer,
      cmdParam: q.get("cmd"),
      modeParam: q.get("mode"),
      forceBoot: q.get("boot") === "1",
      isMobile: window.matchMedia("(pointer: coarse)").matches,
      lateHydration: performance.now() > HYDRATION_WATCHDOG_MS,
    });
    if (q.get("boot") === "1") window.history.replaceState(null, "", "/");
    if (!d.show) {
      delete root.dataset.boot;
      return;
    }
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time, client-only boot decision */
    setReduced(r);
    setDecision(d);
    setIndex(Math.max(0, OPTIONS.findIndex((o) => o.mode === d.preselect)));
    setLeft(d.countdownMs);
    setShown(r ? LINES.length : 0);
    setPhase(r ? "menu" : "log");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Swap the pre-paint cover for the overlay in the same frame the overlay first paints (no flash of the page).
  useLayoutEffect(() => {
    if (phase !== "off") document.documentElement.dataset.boot = "live";
  }, [phase]);

  const boot = useCallback(
    (mode: Mode) => {
      if (done.current) return;
      done.current = true;
      kernel.setMode(mode);
      const root = document.documentElement;
      if (mode === "shell") {
        // The shell shows these lines as its first transcript rows and clears data-boot once mounted.
        kernel.handOff(bootLogItems(LINES));
        router.push("/shell");
        return;
      }
      const finish = () => {
        flushSync(() => setPhase("off"));
        delete root.dataset.boot;
      };
      const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
      if (!reduced && typeof doc.startViewTransition === "function") doc.startViewTransition(finish);
      else finish();
    },
    [router, reduced],
  );

  // Boot log: one line every 120 ms, then the menu.
  useEffect(() => {
    if (phase !== "log") return;
    const t = setTimeout(() => (shown >= LINES.length ? setPhase("menu") : setShown((n) => n + 1)), LINE_MS);
    return () => clearTimeout(t);
  }, [phase, shown]);

  // Countdown (stopped by arrow keys or hovering the menu, like GRUB).
  useEffect(() => {
    if (phase !== "menu" || stopped || !decision) return;
    if (left <= 0) {
      boot(decision.preselect);
      return;
    }
    const t = setTimeout(() => setLeft((ms) => ms - 100), 100);
    return () => clearTimeout(t);
  }, [phase, stopped, left, decision, boot]);

  useEffect(() => {
    if (phase === "menu") listRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Keys and scroll: Enter boots the highlighted line, ` boots the shell, Esc / scroll boot the recruiter view.
  useEffect(() => {
    if (phase === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return; // let buttons handle their own Enter/Space
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setStopped(true);
        setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : OPTIONS.length - 1)) % OPTIONS.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        boot(OPTIONS[index].mode);
      } else if (e.key === "`") {
        e.preventDefault();
        boot("shell");
      } else if (e.key === "Escape") boot("human");
    };
    const onScroll = () => boot("human");
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
    };
  }, [phase, index, boot]);

  if (phase === "off" || !decision) return null;

  const preselected = OPTIONS.find((o) => o.mode === decision.preselect) ?? OPTIONS[0];
  const seconds = decision.countdownMs / 1000;
  const status = stopped
    ? "countdown stopped"
    : reduced
      ? `starts "${preselected.label}" in ${seconds} seconds`
      : `booting "${preselected.label}" in ${Math.max(1, Math.ceil(left / 1000))}…`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg font-mono text-[13px] leading-[1.7] text-text"
      onPointerDown={(e) => {
        if (phase === "menu" && !menuRef.current?.contains(e.target as Node)) boot("human");
      }}
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => boot("human")}
          className="sr-only rounded border border-border px-3 py-1.5 focus:not-sr-only focus:mb-6 focus:self-start"
        >
          Skip to the recruiter view
        </button>
        <p className="text-accent">KERNEL 1.0 (tty1)</p>
        <ol aria-label="Boot log">
          {LINES.slice(0, shown).map((l) => (
            <li key={l.id} className="break-words">
              <span className="text-[var(--k-store)]">[ ok ] </span>
              <span className="text-muted">{l.label}  </span>
              {l.id === "identity" ? (
                <span style={vt("kernel-name")}>{l.detail}</span>
              ) : l.id === "systems" ? (
                l.slugs.map((s, i) => (
                  <span key={s}>
                    {i > 0 && " "}
                    <span style={vt(`boot-system-${s}`)}>{s}</span>
                  </span>
                ))
              ) : (
                <span>{l.detail}</span>
              )}
            </li>
          ))}
        </ol>

        {phase === "menu" && (
          <div ref={menuRef} className="mt-8" onPointerMove={() => setStopped(true)}>
            <p id="boot-question" className="text-text">
              Who&apos;s at the keyboard?
            </p>
            <div
              ref={listRef}
              role="listbox"
              tabIndex={0}
              aria-labelledby="boot-question"
              aria-activedescendant={`boot-option-${OPTIONS[index].mode}`}
              className="mt-3 rounded outline-none focus-visible:ring-1 focus-visible:ring-border-strong"
            >
              {OPTIONS.map((o, i) => (
                <div
                  key={o.mode}
                  id={`boot-option-${o.mode}`}
                  role="option"
                  aria-selected={i === index}
                  onClick={() => boot(o.mode)}
                  onPointerMove={() => setIndex(i)}
                  className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 rounded px-3 ${i === index ? "bg-accent-soft text-accent" : "text-muted hover:text-text"}`}
                >
                  <span aria-hidden className="w-3">
                    {i === index ? "▸" : ""}
                  </span>
                  <span className="flex-1">{o.label}</span>
                  <span className="text-faint">{o.mode === decision.preselect ? `recommended · ${o.hint}` : o.hint}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-faint">
              <span className="hidden sm:inline">↑↓ choose · enter boot · </span>
              {status}
            </p>
            <p aria-live="polite" className="sr-only">
              {`Choose an interface. "${preselected.label}" starts in ${seconds} seconds unless you choose.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
