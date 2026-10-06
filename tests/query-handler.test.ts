import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { portfolio } from "@/core/content";
import { createRateLimiter } from "@/core/ratelimit";
import { clientKey, handleQuery, type QueryEvent } from "@/server/query-handler";

const finish = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  logprobs: undefined,
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
} as const;

function modelWith(chunks: unknown[]) {
  return new MockLanguageModelV4({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doStream: async () => ({ stream: simulateReadableStream({ chunks: chunks as any[] }) }),
  });
}

function request(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost/api/query", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function events(res: Response): Promise<QueryEvent[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as QueryEvent);
}

const limiter = () => createRateLimiter({ perMinute: 100, perDay: 1000 });
const ask = (content: string) => ({ messages: [{ role: "user", content }] });

describe("handleQuery", () => {
  it("rejects invalid bodies with 400", async () => {
    const deps = { portfolio, limiter: limiter(), getModel: () => null };
    expect((await handleQuery(request({}), deps)).status).toBe(400);
    expect((await handleQuery(request(ask("x".repeat(501))), deps)).status).toBe(400);
    expect((await handleQuery(request({ messages: [{ role: "assistant", content: "hi" }] }), deps)).status).toBe(400);
    const tooMany = { messages: Array.from({ length: 13 }, () => ({ role: "user", content: "hi" })) };
    expect((await handleQuery(request(tooMany), deps)).status).toBe(400);
    expect((await handleQuery(request({ messages: [] }), deps)).status).toBe(400);
    expect((await handleQuery(request({ messages: "hi" }), deps)).status).toBe(400);
    const notJson = new Request("http://localhost/api/query", { method: "POST", body: "{nope" });
    expect((await handleQuery(notJson, deps)).status).toBe(400);
  });

  it("rate limits with 429", async () => {
    const deps = { portfolio, limiter: createRateLimiter({ perMinute: 1, perDay: 10 }), getModel: () => null };
    expect((await handleQuery(request(ask("atlas")), deps)).status).toBe(200);
    const res = await handleQuery(request(ask("atlas")), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("answers locally when no model is configured", async () => {
    const res = await handleQuery(request(ask("Tell me about Relay")), { portfolio, limiter: limiter(), getModel: () => null });
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const ev = await events(res);
    expect(ev[0]).toMatchObject({ type: "meta", mode: "local" });
    expect(ev.some((e) => e.type === "text" && e.text.includes("Relay"))).toBe(true);
    expect(ev).toContainEqual({ type: "suggestion", action: { type: "openSystem", slug: "relay" } });
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("streams model text and validated tool calls", async () => {
    const model = modelWith([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Atlas is " },
      { type: "text-delta", id: "t", delta: "a RAG system." },
      { type: "text-end", id: "t" },
      { type: "tool-call", toolCallId: "c1", toolName: "openSystem", input: JSON.stringify({ slug: "atlas" }) },
      finish,
    ]);
    const ev = await events(await handleQuery(request(ask("What is Atlas?")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev[0]).toMatchObject({ type: "meta", mode: "ai" });
    expect(ev.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("")).toBe("Atlas is a RAG system.");
    expect(ev).toContainEqual({ type: "action", action: { type: "openSystem", slug: "atlas" } });
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("drops invalid tool calls", async () => {
    const model = modelWith([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Opening." },
      { type: "text-end", id: "t" },
      { type: "tool-call", toolCallId: "c1", toolName: "openSystem", input: JSON.stringify({ slug: "ghost" }) },
      finish,
    ]);
    const ev = await events(await handleQuery(request(ask("open ghost")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev.some((e) => e.type === "action")).toBe(false);
    expect(ev.some((e) => e.type === "text")).toBe(true);
  });

  it("falls back to local answer when the model stream errors", async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("quota exceeded");
      },
    });
    const ev = await events(await handleQuery(request(ask("Relay")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev.some((e) => e.type === "meta" && e.mode === "local")).toBe(true);
    expect(ev.some((e) => e.type === "text" && e.text.includes("Relay"))).toBe(true);
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("adds a text explanation when the model replies with only a tool call", async () => {
    const model = modelWith([
      { type: "tool-call", toolCallId: "c1", toolName: "openSystem", input: JSON.stringify({ slug: "atlas" }) },
      finish,
    ]);
    const ev = await events(await handleQuery(request(ask("open atlas")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev).toContainEqual({ type: "action", action: { type: "openSystem", slug: "atlas" } });
    const text = ev.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("Atlas");
  });
});

describe("hardening", () => {
  it("prefers x-real-ip, then the last x-forwarded-for hop", () => {
    const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
    expect(clientKey(req({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("9.9.9.9");
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientKey(req({}))).toBe("anonymous");
  });

  it("rejects long or excessive assistant history", async () => {
    const deps = { portfolio, limiter: limiter(), getModel: () => null };
    const long = { messages: [{ role: "assistant", content: "x".repeat(1501) }, { role: "user", content: "hi" }] };
    expect((await handleQuery(request(long), deps)).status).toBe(400);
    const many = {
      messages: [...Array.from({ length: 7 }, () => ({ role: "assistant", content: "a" })), { role: "user", content: "hi" }],
    };
    expect((await handleQuery(request(many), deps)).status).toBe(400);
  });

  it("tool input cannot override the action type", async () => {
    const model = modelWith([
      { type: "tool-call", toolCallId: "c1", toolName: "openSystem", input: JSON.stringify({ slug: "atlas", type: "navigate", path: "/trace" }) },
      finish,
    ]);
    const ev = await events(await handleQuery(request(ask("open atlas")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev).toContainEqual({ type: "action", action: { type: "openSystem", slug: "atlas" } });
  });

  it("sends local suggestions when the provider fails after partial text", async () => {
    const model = modelWith([
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "Relay is " },
      { type: "error", error: new Error("boom") },
    ]);
    const ev = await events(await handleQuery(request(ask("Tell me about Relay")), { portfolio, limiter: limiter(), getModel: () => model }));
    expect(ev.some((e) => e.type === "error")).toBe(true);
    expect(ev).toContainEqual({ type: "suggestion", action: { type: "openSystem", slug: "relay" } });
    expect(ev.at(-1)).toEqual({ type: "done" });
  });
});
