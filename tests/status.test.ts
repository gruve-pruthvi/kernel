import { describe, expect, it } from "vitest";
import { statusResponse } from "@/server/status";

describe("statusResponse", () => {
  it("reports whether a key is configured without exposing it", async () => {
    const off = statusResponse({});
    expect(off.headers.get("cache-control")).toBe("no-store");
    expect(await off.json()).toEqual({ ai: false });
    const on = statusResponse({ GEMINI_API_KEY: "secret-123" });
    const body = await on.text();
    expect(JSON.parse(body)).toEqual({ ai: true });
    expect(body).not.toContain("secret-123");
  });
});
