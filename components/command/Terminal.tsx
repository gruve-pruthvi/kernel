"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { complete, runCommand, type OutputLine } from "@/core/command";
import { portfolio } from "@/core/content";
import { kernel, useKernel } from "@/lib/store";
import { useRunAction } from "@/lib/use-run-action";

type Line = OutputLine | { kind: "input"; text: string };

const WELCOME: Line[] = [
  { kind: "accent", text: "KERNEL command interface" },
  { kind: "muted", text: "type help to list commands · Tab completes · ↑↓ history" },
];

const KIND_CLASS: Record<Line["kind"], string> = {
  text: "text-text",
  muted: "text-faint",
  accent: "text-accent",
  error: "text-[var(--k-model)]",
  link: "text-text underline decoration-border-strong underline-offset-2 hover:decoration-accent",
  input: "text-muted",
};

export function Terminal() {
  const open = useKernel((s) => s.commandOpen);
  const recruiter = useKernel((s) => s.recruiter);
  const runAction = useRunAction();
  const [lines, setLines] = useState<Line[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const execute = (raw: string) => {
    const value = raw.trim();
    setInput("");
    setCursor(null);
    if (!value) {
      setLines((l): Line[] => [...l, { kind: "input", text: "" }]);
      return;
    }
    setHistory((h) => (h[h.length - 1] === value ? h : [...h, value].slice(-50)));
    const result = runCommand(value, portfolio, { recruiter });
    if (result.clear) {
      setLines([]);
      return;
    }
    setLines((l): Line[] => [...l, { kind: "input" as const, text: value }, ...result.lines].slice(-400));
    if (result.ask) {
      kernel.openQuery(result.ask);
      return;
    }
    result.actions.forEach(runAction);
    if (result.actions.some((a) => a.type !== "toggleRecruiter")) {
      window.setTimeout(kernel.closeCommand, 350);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      execute(input);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const options = complete(input, portfolio);
      if (options.length === 1) setInput(options[0]);
      else if (options.length > 1) {
        setLines((l): Line[] => [...l, { kind: "input", text: input }, { kind: "muted", text: options.map((o) => o.trim().split(" ").pop()).join("   ") }]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === null) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(null);
        setInput("");
      } else {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="term-backdrop"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={kernel.closeCommand}
            aria-hidden
          />
          <motion.div
            key="term"
            role="dialog"
            aria-modal="true"
            aria-label="Command terminal"
            className="fixed inset-x-3 top-[10vh] z-50 mx-auto flex max-h-[70vh] max-w-2xl flex-col overflow-hidden rounded-xl border border-border-strong bg-[var(--bg)] shadow-2xl"
            initial={{ y: -8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[var(--k-model)]" aria-hidden />
              <span className="size-2.5 rounded-full bg-[var(--k-queue)]" aria-hidden />
              <span className="size-2.5 rounded-full bg-[var(--k-store)]" aria-hidden />
              <p className="ml-3 font-mono text-[11px] text-faint">kernel — zsh</p>
              <button type="button" onClick={kernel.closeCommand} className="ml-auto font-mono text-[11px] text-faint hover:text-text" aria-label="Close terminal">
                esc
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-6" aria-live="polite">
              {lines.map((l, i) =>
                l.kind === "input" ? (
                  <p key={i} className="whitespace-pre-wrap text-muted">
                    <span className="text-accent">kernel</span> <span className="text-faint">~ $</span> {l.text}
                  </p>
                ) : l.kind === "link" && l.href ? (
                  l.href.startsWith("/") ? (
                    <Link key={i} href={l.href} onClick={kernel.closeCommand} className={`block whitespace-pre-wrap ${KIND_CLASS.link}`}>
                      {l.text}
                    </Link>
                  ) : (
                    <a key={i} href={l.href} target="_blank" rel="noreferrer" className={`block whitespace-pre-wrap ${KIND_CLASS.link}`}>
                      {l.text}
                    </a>
                  )
                ) : l.href ? (
                  <Link key={i} href={l.href} onClick={kernel.closeCommand} className={`block whitespace-pre-wrap hover:text-accent ${KIND_CLASS[l.kind]}`}>
                    {l.text}
                  </Link>
                ) : (
                  <p key={i} className={`min-h-6 whitespace-pre-wrap ${KIND_CLASS[l.kind]}`}>
                    {l.text}
                  </p>
                ),
              )}
              <label className="flex items-center gap-2">
                <span className="shrink-0">
                  <span className="text-accent">kernel</span> <span className="text-faint">~ $</span>
                </span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  aria-label="Command"
                  className="flex-1 bg-transparent text-text caret-[var(--accent)] outline-none"
                />
              </label>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
