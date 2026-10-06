"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SUGGESTED_QUESTIONS } from "@/core/query";
import { kernel, useKernel } from "@/lib/store";
import { useRunAction } from "@/lib/use-run-action";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import { MAX_CHARS } from "./conversation";
import { MessageList } from "./MessageList";
import { useConversation } from "./useConversation";

export function QueryPanel() {
  const open = useKernel((s) => s.queryOpen);
  const seed = useKernel((s) => s.querySeed);
  const nonce = useKernel((s) => s.queryNonce);
  const runAction = useRunAction();
  const motionAllowed = useMotionAllowed();
  const returnFocus = useRef<HTMLElement | null>(null);

  const { messages, busy, submit, clear } = useConversation({
    autoRun: true,
    onAction: runAction,
    onSettled: (ranAction) => {
      if (ranAction && window.matchMedia("(max-width: 767px)").matches) kernel.closeQuery();
    },
  });
  const [input, setInput] = useState("");
  const send = (q: string) => {
    if (busy || !q.trim()) return;
    setInput("");
    void submit(q);
  };
  const handledNonce = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Dialog focus: move in on open, return to where the visitor was on close.
  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else if (returnFocus.current) {
      returnFocus.current.focus?.();
      returnFocus.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (open && seed && nonce !== handledNonce.current) {
      handledNonce.current = nonce;
      setInput(""); // a seeded question replaces any half-typed draft, as before
      void submit(seed);
    }
  }, [open, seed, nonce, submit]);

  return (
    <MotionConfig reducedMotion={motionAllowed ? "never" : "always"}>
      <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="query-backdrop"
            className="fixed inset-0 z-40 bg-black/30 md:bg-black/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={kernel.closeQuery}
            aria-hidden
          />
          <motion.div
            key="query-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Ask Kernel"
            className="fixed inset-0 z-50 flex flex-col border-border bg-bg shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[460px] md:border-l"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">Query</p>
              {[...messages].reverse().find((m) => m.role === "assistant")?.mode === "local" && (
                <span
                  className="rounded border border-dashed border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-faint"
                  title="AI is unavailable — answering from local search"
                >
                  offline mode
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {messages.length > 0 && (
                  <button type="button" onClick={clear} className="rounded px-2 py-1 font-mono text-[11px] text-muted hover:text-text" disabled={busy}>
                    clear
                  </button>
                )}
                <button type="button" onClick={kernel.closeQuery} aria-label="Close" className="grid size-8 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text">
                  ×
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
              {messages.length === 0 ? (
                <div>
                  <p className="text-sm leading-relaxed text-muted">
                    Ask anything about the systems, stack or experience here. Answers come only from this portfolio — and Kernel will
                    open the relevant pages for you.
                  </p>
                  <ul className="mt-5 space-y-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => send(q)}
                          className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted transition hover:border-border-strong hover:text-text"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <MessageList messages={messages} onSuggestion={runAction} />
              )}
            </div>

            <form
              className="shrink-0 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 focus-within:border-border-strong">
                <textarea
                  ref={inputRef}
                  value={input}
                  maxLength={MAX_CHARS}
                  rows={1}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask about systems, stack, experience…"
                  aria-label="Your question"
                  className="max-h-32 min-h-6 flex-1 resize-none bg-transparent text-sm text-text outline-none placeholder:text-faint"
                />
                <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-contrast disabled:opacity-40">
                  Ask
                </button>
              </div>
              <p className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
                <span>Enter to send · Esc to close</span>
                <span>
                  {input.length}/{MAX_CHARS}
                </span>
              </p>
            </form>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </MotionConfig>
  );
}
