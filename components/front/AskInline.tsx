"use client";

import { useState } from "react";
import { announcementFor, MAX_CHARS } from "@/components/query/conversation";
import { MessageList } from "@/components/query/MessageList";
import { useConversation } from "@/components/query/useConversation";
import { SectionLabel } from "@/components/ui/SectionLabel";

export function AskInline({ chips, name }: { chips: string[]; name: string }) {
  const { messages, busy, submit, clear } = useConversation({ autoRun: false });
  const [input, setInput] = useState("");
  const send = (q: string) => {
    if (busy || !q.trim()) return;
    setInput("");
    void submit(q);
  };
  const offline = [...messages].reverse().find((m) => m.role === "assistant")?.mode === "local";

  return (
    <section id="ask" aria-labelledby="ask-title" className="mt-20 scroll-mt-20 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <SectionLabel>Ask about me</SectionLabel>
        {offline && (
          <span className="rounded border border-dashed border-border-strong px-1.5 py-0.5 font-mono text-[10px] text-faint" title="AI is unavailable — answering from local search">
            offline mode
          </span>
        )}
        {messages.length > 0 && (
          <button type="button" onClick={clear} disabled={busy} className="ml-auto font-mono text-[11px] text-muted hover:text-text">
            clear
          </button>
        )}
      </div>
      <h2 id="ask-title" className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
        Ask anything — answers come only from {name}&apos;s real work.
      </h2>

      {messages.length > 0 && (
        <div className="mt-5">
          <MessageList messages={messages} />
        </div>
      )}

      {messages.length === 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {chips.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => send(q)} className="rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-border-strong hover:text-text">
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Always mounted, so each finished answer is announced once (not token by token while it streams). */}
      <p aria-live="polite" className="sr-only">
        {announcementFor(messages)}
      </p>

      <form
        className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 focus-within:border-border-strong"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          maxLength={MAX_CHARS}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What has been built with agents?"
          id="ask-input"
          aria-label="Ask about the work"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-contrast disabled:opacity-40">
          Ask
        </button>
      </form>
    </section>
  );
}
