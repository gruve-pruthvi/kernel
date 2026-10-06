import { streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { describeAction, validateAction, type UiAction } from "@/core/actions";
import { buildContext, localAnswer, retrieve, systemPrompt, toSources, type Source } from "@/core/query";
import type { RateLimitResult } from "@/core/ratelimit";
import type { Portfolio } from "@/core/schema";

export const MAX_MESSAGES = 12;
export const MAX_USER_CHARS = 500;
export const MAX_ASSISTANT_CHARS = 1500;
export const MAX_ASSISTANT_TURNS = 6;

export const queryRequestSchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
      .min(1)
      .max(MAX_MESSAGES),
  })
  .refine((b) => b.messages.at(-1)?.role === "user", "last message must be from the user")
  .refine(
    (b) => b.messages.every((m) => m.role !== "user" || m.content.length <= MAX_USER_CHARS),
    `user messages are limited to ${MAX_USER_CHARS} characters`,
  )
  .refine(
    (b) => b.messages.every((m) => m.role !== "assistant" || m.content.length <= MAX_ASSISTANT_CHARS),
    `assistant messages are limited to ${MAX_ASSISTANT_CHARS} characters`,
  )
  .refine((b) => b.messages.filter((m) => m.role === "assistant").length <= MAX_ASSISTANT_TURNS, "too many assistant turns");

export type QueryEvent =
  | { type: "meta"; mode: "ai" | "local"; sources: Source[] }
  | { type: "text"; text: string }
  | { type: "action"; action: UiAction }
  | { type: "suggestion"; action: UiAction }
  | { type: "error"; message: string }
  | { type: "done" };

export interface QueryDeps {
  portfolio: Portfolio;
  limiter: { check(key: string): RateLimitResult };
  getModel: () => LanguageModel | null;
}

const tools = {
  navigate: tool({
    description: "Navigate to a portfolio page: /, /systems, /graph, /trace, /human, /connect or /systems/<slug>.",
    inputSchema: z.object({ path: z.string() }),
  }),
  openSystem: tool({
    description: "Open one system's case study page.",
    inputSchema: z.object({ slug: z.string().describe("system slug from the SYSTEM INDEX") }),
  }),
  highlightGraph: tool({
    description: "Show and highlight nodes in the engineering graph.",
    inputSchema: z.object({
      ids: z.array(z.string()).describe("technology ids, capability ids or system slugs from the CONTEXT"),
    }),
  }),
  filterSystems: tool({
    description: "List the systems that use a technology and/or demonstrate a capability.",
    inputSchema: z.object({ tech: z.string().optional(), capability: z.string().optional() }),
  }),
  switchMode: tool({
    description: "Switch the site between the recruiter view (human) and the terminal (shell).",
    inputSchema: z.object({ mode: z.enum(["human", "shell"]) }),
  }),
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export function clientKey(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = req.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] ?? "anonymous";
}

export async function handleQuery(req: Request, deps: QueryDeps): Promise<Response> {
  const limit = deps.limiter.check(clientKey(req));
  if (!limit.ok) {
    const message =
      limit.reason === "minute"
        ? "You're asking quickly — give it a few seconds."
        : "Daily question limit reached. Explore the systems directly or come back tomorrow.";
    return json(429, { error: message }, { "retry-after": String(limit.retryAfterSec) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Request body must be JSON." });
  }
  const parsed = queryRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? "Invalid request." });

  const { messages } = parsed.data;
  const question = messages[messages.length - 1].content;
  const { portfolio } = deps;
  const results = retrieve(portfolio, question);
  const model = deps.getModel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: QueryEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const sendLocal = () => {
        const local = localAnswer(portfolio, question);
        send({ type: "meta", mode: "local", sources: local.sources });
        send({ type: "text", text: local.text });
        for (const action of local.suggestions) send({ type: "suggestion", action });
      };

      if (!model) {
        sendLocal();
        send({ type: "done" });
        controller.close();
        return;
      }

      let emitted = false;
      let sentText = false;
      const sentActions: UiAction[] = [];
      try {
        const result = streamText({
          model,
          instructions: `${systemPrompt(portfolio)}\n\nCONTEXT:\n${buildContext(portfolio, results)}`,
          messages,
          tools,
          maxRetries: 1,
          abortSignal: req.signal,
        });
        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error;
          if (part.type === "text-delta" && part.text) {
            if (!emitted) send({ type: "meta", mode: "ai", sources: toSources(results) });
            emitted = true;
            sentText = true;
            send({ type: "text", text: part.text });
          } else if (part.type === "tool-call") {
            const action = validateAction({ ...(part.input as object), type: part.toolName }, portfolio);
            if (!action) continue;
            if (!emitted) send({ type: "meta", mode: "ai", sources: toSources(results) });
            emitted = true;
            sentActions.push(action);
            send({ type: "action", action });
          }
        }
        if (!emitted) sendLocal();
        else if (!sentText) {
          // Models often answer "show/open" requests with a bare tool call; say what happened.
          send({ type: "text", text: `${sentActions.map((a) => describeAction(a, portfolio)).join(". ")}.` });
        }
      } catch (err) {
        console.error("[kernel] query model error:", err instanceof Error ? err.message : err);
        if (emitted) {
          send({ type: "error", message: "The answer was interrupted. Try again in a moment." });
          for (const action of localAnswer(portfolio, question).suggestions) send({ type: "suggestion", action });
        }
        else sendLocal();
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
