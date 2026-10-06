import { describe, expect, it } from "vitest";
import { deepLinkFor, parseDeepLink, splitCommands } from "@/core/shell/deeplink";

describe("parseDeepLink", () => {
  it("returns one command", () => {
    expect(parseDeepLink("?cmd=man%20atlas")).toEqual({ commands: ["man atlas"], notices: [] });
  });
  it("returns nothing for missing or blank cmd", () => {
    expect(parseDeepLink("")).toEqual({ commands: [], notices: [] });
    expect(parseDeepLink("?cmd=%20%20")).toEqual({ commands: [], notices: [] });
  });
  it("truncates each command to 200 characters with a notice", () => {
    const res = parseDeepLink(`?cmd=${"a".repeat(10_000)}`);
    expect(res.commands).toEqual(["a".repeat(200)]);
    expect(res.notices).toEqual(["deep link: commands longer than 200 characters were truncated"]);
  });
  it("caps at 5 commands with a notice", () => {
    const res = parseDeepLink(`?cmd=${encodeURIComponent(Array(20).fill("pwd").join(";"))}`);
    expect(res.commands).toHaveLength(5);
    expect(res.notices).toEqual(["deep link: skipped 15 more commands (limit 5)"]);
  });
  it("deep links split on unquoted semicolons only", () => {
    expect(splitCommands(`echo "a;b"; pwd`)).toEqual([`echo "a;b"`, " pwd"]);
    expect(parseDeepLink(`?cmd=${encodeURIComponent(`echo 'x;y';pwd;;`)}`).commands).toEqual([`echo 'x;y'`, "pwd"]);
  });
  it("builds links", () => {
    expect(deepLinkFor("grep -i rag .")).toBe("/shell?cmd=grep%20-i%20rag%20.");
  });
});
