import { describe, expect, it } from "vitest";
import { createLineDecoder } from "@/components/query/stream";
import type { QueryEvent } from "@/server/query-handler";

describe("createLineDecoder", () => {
  it("handles events split across chunks and ignores junk", () => {
    const events: QueryEvent[] = [];
    const d = createLineDecoder((e) => events.push(e));
    d.push('{"type":"text","te');
    d.push('xt":"hi"}\n\n{not json}\n{"type":"do');
    d.push('ne"}');
    d.flush();
    expect(events).toEqual([{ type: "text", text: "hi" }, { type: "done" }]);
  });
});
