import { describe, expect, it } from "vitest";
import { modeForPath } from "@/core/boot";
import { portfolio } from "@/core/content";
import { buildFs, parseCwd } from "@/core/shell/fs";

describe("modeForPath", () => {
  it("maps routes to modes", () => {
    expect(modeForPath("/shell")).toBe("shell");
    expect(modeForPath("/shell/")).toBe("shell");
    for (const p of ["/", "/systems", "/systems/atlas", "/graph", "/shellfish"]) expect(modeForPath(p), p).toBe("human");
  });
});

describe("parseCwd", () => {
  const root = buildFs(portfolio);
  const slug = portfolio.systems[0].slug;

  it("restores a directory that still exists", () => {
    expect(parseCwd(JSON.stringify(["systems"]), root)).toEqual(["systems"]);
    expect(parseCwd(JSON.stringify(["systems", slug]), root)).toEqual(["systems", slug]);
  });

  it("parseCwd rejects unknown or malformed paths", () => {
    for (const raw of [null, "", "garbage", "{}", "[1]", JSON.stringify(["nope"]), JSON.stringify(["systems", ".."]), JSON.stringify(["systems/x"])]) {
      expect(parseCwd(raw, root), String(raw)).toEqual([]);
    }
  });
});
