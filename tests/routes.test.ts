import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { INTERNAL_ROUTES } from "@/core/actions";

describe("redirects", () => {
  it("sends old shell deep links to /shell and /human to the front door", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({ source: "/", has: [{ type: "query", key: "cmd" }], destination: "/shell", permanent: false });
    expect(redirects).toContainEqual({ source: "/human", destination: "/#human", permanent: true });
  });
});

describe("internal routes", () => {
  it("include the shell and no longer list /human", () => {
    expect(INTERNAL_ROUTES).toContain("/shell");
    expect(INTERNAL_ROUTES).not.toContain("/human");
  });
});
