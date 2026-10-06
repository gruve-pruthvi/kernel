"use client";

import Link from "next/link";
import { actionToHref, describeAction, type UiAction } from "@/core/actions";
import { portfolio } from "@/core/content";
import { kernel } from "@/lib/store";
import type { Message } from "./conversation";
import { Markdown } from "./Markdown";

const suggestionLabel = (a: UiAction) =>
  describeAction(a, portfolio).replace(/^Opened/, "Open").replace(/^Highlighted/, "Highlight").replace(/^Went to/, "Go to").replace(/^Switched to/, "Switch to");
const suggestionClass = "rounded border border-accent/40 px-2 py-1 font-mono text-[11px] text-accent hover:bg-accent-soft";

export function MessageList({ messages, onSuggestion }: { messages: Message[]; onSuggestion?: (a: UiAction) => void }) {
  return (
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
                  {m.suggestions.map((a, j) =>
                    onSuggestion ? (
                      <button key={j} type="button" onClick={() => onSuggestion(a)} className={suggestionClass}>
                        {suggestionLabel(a)}
                      </button>
                    ) : (
                      <Link
                        key={j}
                        href={actionToHref(a) ?? "/"}
                        onClick={() => a.type === "switchMode" && kernel.setMode(a.mode)}
                        className={suggestionClass}
                      >
                        {suggestionLabel(a)}
                      </Link>
                    ),
                  )}
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
  );
}
