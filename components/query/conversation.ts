import { validateAction, type UiAction } from "@/core/actions";
import type { Source } from "@/core/query";
import type { Portfolio } from "@/core/schema";
import type { QueryEvent } from "@/server/query-handler";

export const MAX_CHARS = 500;

export type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  actions?: UiAction[];
  suggestions?: UiAction[];
  mode?: "ai" | "local";
  error?: string;
  pending?: boolean;
};

export type Turn = { role: "user" | "assistant"; content: string };

/** Conversation sent to /api/query: no failed turns, last 12, starting with the visitor. */
export function historyFor(messages: Message[], question: string): Turn[] {
  const history: Turn[] = [
    ...messages.filter((m) => m.content && !m.error).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) })),
    { role: "user" as const, content: question },
  ].slice(-12);
  while (history.length > 1 && history[0].role !== "user") history.shift();
  return history;
}

/** Folds one streamed event into the assistant message. With autoRun off, actions are offered as suggestions instead. */
export function applyEvent(m: Message, e: QueryEvent, p: Portfolio, autoRun = true): Message {
  switch (e.type) {
    case "meta":
      return { ...m, mode: e.mode, sources: e.sources };
    case "text":
      return { ...m, content: m.content + e.text };
    case "action":
    case "suggestion": {
      const a = validateAction(e.action, p);
      if (!a) return m;
      return e.type === "action" && autoRun
        ? { ...m, actions: [...(m.actions ?? []), a] }
        : { ...m, suggestions: [...(m.suggestions ?? []), a] };
    }
    case "error":
      return { ...m, error: e.message };
    default:
      return m;
  }
}
