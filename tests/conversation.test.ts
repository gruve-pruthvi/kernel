import { describe, expect, it } from "vitest";
import { applyEvent, historyFor, type Message } from "@/components/query/conversation";
import { portfolio } from "@/core/content";

const blank: Message = { role: "assistant", content: "", pending: true };
const slug = portfolio.systems[0].slug;

describe("applyEvent", () => {
  it("accumulates text and metadata", () => {
    let m = applyEvent(blank, { type: "meta", mode: "local", sources: [] }, portfolio);
    m = applyEvent(m, { type: "text", text: "Hel" }, portfolio);
    m = applyEvent(m, { type: "text", text: "lo" }, portfolio);
    expect(m).toMatchObject({ content: "Hello", mode: "local", sources: [] });
  });

  it("records valid actions; drops invalid ones", () => {
    const m = applyEvent(blank, { type: "action", action: { type: "openSystem", slug } }, portfolio);
    expect(m.actions).toEqual([{ type: "openSystem", slug }]);
    expect(applyEvent(blank, { type: "action", action: { type: "openSystem", slug: "nope" } }, portfolio)).toEqual(blank);
  });

  it("without autoRun, actions become suggestions (the page never navigates on its own)", () => {
    const m = applyEvent(blank, { type: "action", action: { type: "openSystem", slug } }, portfolio, false);
    expect(m.actions).toBeUndefined();
    expect(m.suggestions).toEqual([{ type: "openSystem", slug }]);
  });

  it("keeps errors", () => {
    expect(applyEvent(blank, { type: "error", message: "rate limited" }, portfolio).error).toBe("rate limited");
  });
});

describe("historyFor", () => {
  it("drops errored turns, trims to 12 and starts with the user", () => {
    const msgs: Message[] = [
      { role: "assistant", content: "hi" },
      { role: "user", content: "q1" },
      { role: "assistant", content: "", error: "boom" },
      { role: "assistant", content: "a1" },
    ];
    expect(historyFor(msgs, "q2")).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
    const many: Message[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const h = historyFor(many, "last");
    expect(h.length).toBeLessThanOrEqual(12);
    expect(h[0].role).toBe("user");
    expect(h.at(-1)).toEqual({ role: "user", content: "last" });
  });
});
