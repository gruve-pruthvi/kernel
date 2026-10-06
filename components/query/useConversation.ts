"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateAction, type UiAction } from "@/core/actions";
import { portfolio } from "@/core/content";
import type { QueryEvent } from "@/server/query-handler";
import { applyEvent, historyFor, MAX_CHARS, type Message } from "./conversation";
import { createLineDecoder } from "./stream";

export function useConversation(opts: { autoRun: boolean; onAction?: (a: UiAction) => void; onSettled?: (ranAction: boolean) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const optsRef = useRef(opts);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    optsRef.current = opts;
  });

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms));

  const submit = useCallback(async (raw: string) => {
    const question = raw.trim().slice(0, MAX_CHARS);
    if (!question || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const history = historyFor(messagesRef.current, question);
    setMessages((ms) => [...ms, { role: "user", content: question }, { role: "assistant", content: "", pending: true }]);
    const { autoRun, onAction } = optsRef.current;
    let ranAction = false;

    const onEvent = (e: QueryEvent) => {
      if (e.type === "action" || e.type === "suggestion") {
        const action = validateAction(e.action, portfolio);
        if (!action) {
          if (process.env.NODE_ENV !== "production") console.debug(`[kernel] dropped ${e.type}`, e.action);
          return;
        }
        if (e.type === "action" && autoRun) {
          ranAction = true;
          onAction?.(action);
        }
      }
      updateLast((m) => applyEvent(m, e, portfolio, autoRun));
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
      optsRef.current.onSettled?.(ranAction);
    }
  }, []);

  const clear = useCallback(() => setMessages([]), []);
  return { messages, busy, submit, clear };
}
