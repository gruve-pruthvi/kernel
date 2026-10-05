"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { describeAction, validateAction, type UiAction } from "@/core/actions";
import { portfolio } from "@/core/content";
import { SUGGESTED_QUESTIONS, type Source } from "@/core/query";
import { kernel, useKernel } from "@/lib/store";
import { useRunAction } from "@/lib/use-run-action";
import type { QueryEvent } from "@/server/query-handler";
import { Markdown } from "./Markdown";
import { createLineDecoder } from "./stream";

const MAX_CHARS = 500;

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  actions?: UiAction[];
  suggestions?: UiAction[];
  mode?: "ai" | "local";
  error?: string;
  pending?: boolean;
};

export function QueryPanel() {
  const open = useKernel((s) => s.queryOpen);
  const seed = useKernel((s) => s.querySeed);
  const nonce = useKernel((s) => s.queryNonce);
  const runAction = useRunAction();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const handledNonce = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms));

  const submit = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_CHARS);
      if (!question || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setInput("");

      const history = [
        ...messagesRef.current
          .filter((m) => m.content && !m.error)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        { role: "user" as const, content: question },
      ].slice(-12);
      while (history.length > 1 && history[0].role !== "user") history.shift();

      setMessages((ms) => [...ms, { role: "user", content: question }, { role: "assistant", content: "", pending: true }]);
      let ranAction = false;

      const onEvent = (e: QueryEvent) => {
        if (e.type === "meta") updateLast((m) => ({ ...m, mode: e.mode, sources: e.sources }));
        else if (e.type === "text") updateLast((m) => ({ ...m, content: m.content + e.text }));
        else if (e.type === "action") {
          const action = validateAction(e.action, portfolio);
          if (!action) return;
          ranAction = true;
          runAction(action);
          updateLast((m) => ({ ...m, actions: [...(m.actions ?? []), action] }));
        } else if (e.type === "suggestion") {
          const action = validateAction(e.action, portfolio);
          if (action) updateLast((m) => ({ ...m, suggestions: [...(m.suggestions ?? []), action] }));
        } else if (e.type === "error") updateLast((m) => ({ ...m, error: e.message }));
      };

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          updateLast((m) => ({ ...m, error: data.error ?? "Something went wrong. Try again." }));
        } else {
          const reader = res.body.getReader();
          const textDecoder = new TextDecoder();
          const lines = createLineDecoder(onEvent);
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            lines.push(textDecoder.decode(value, { stream: true }));
          }
          lines.flush();
        }
      } catch {
        updateLast((m) => ({ ...m, error: "Network error — check your connection and try again." }));
      } finally {
        updateLast((m) => ({ ...m, pending: false }));
        busyRef.current = false;
        setBusy(false);
        if (ranAction && window.matchMedia("(max-width: 767px)").matches) kernel.closeQuery();
      }
    },
    [runAction],
  );

  useEffect(() => {
    if (open && seed && nonce !== handledNonce.current) {
      handledNonce.current = nonce;
      void submit(seed);
    }
  }, [open, seed, nonce, submit]);

  return (
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
            aria-label="Ask Kernel"
            className="fixed inset-0 z-50 flex flex-col border-border bg-bg shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[460px] md:border-l"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text">Query</p>
              {messages.some((m) => m.mode === "local") && (
                <span
                  className="rounded border border-dashed border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-faint"
                  title="AI is unavailable — answering from local search"
                >
                  offline mode
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {messages.length > 0 && (
                  <button type="button" onClick={() => setMessages([])} className="rounded px-2 py-1 font-mono text-[11px] text-muted hover:text-text" disabled={busy}>
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
                          onClick={() => void submit(q)}
                          className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-muted transition hover:border-border-strong hover:text-text"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ol className="space-y-5">
                  {messages.map((m, i) => (
                    <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                      {m.role === "user" ? (
                        <p className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm text-text">{m.content}</p>
                      ) : (
                        <div className="text-sm leading-relaxed text-muted">
                          {m.content ? <Markdown text={m.content} /> : m.pending ? <p className="cursor-blink text-accent">▍</p> : null}
                          {m.actions?.map((a, j) => (
                            <p key={j} className="mt-2 font-mono text-[11px] text-accent">
                              ↳ {describeAction(a, portfolio)}
                            </p>
                          ))}
                          {m.suggestions && m.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {m.suggestions.map((a, j) => (
                                <button
                                  key={j}
                                  type="button"
                                  onClick={() => runAction(a)}
                                  className="rounded border border-accent/40 px-2 py-1 font-mono text-[11px] text-accent hover:bg-accent-soft"
                                >
                                  {describeAction(a, portfolio).replace(/^Opened/, "Open").replace(/^Highlighted/, "Highlight").replace(/^Went to/, "Go to")}
                                </button>
                              ))}
                            </div>
                          )}
                          {m.sources && m.sources.length > 0 && !m.pending && (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-faint">sources</span>
                              {m.sources.slice(0, 4).map((s) => (
                                <Link key={`${s.kind}:${s.id}`} href={s.href} className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-text">
                                  {s.title}
                                </Link>
                              ))}
                            </div>
                          )}
                          {m.error && <p className="mt-2 text-sm text-[var(--k-model)]">{m.error}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <form
              className="shrink-0 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
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
                      void submit(input);
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
  );
}
