import type { QueryEvent } from "@/server/query-handler";

export function createLineDecoder(onEvent: (e: QueryEvent) => void) {
  let buffer = "";
  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      onEvent(JSON.parse(line) as QueryEvent);
    } catch {
      /* ignore malformed line */
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        emit(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    },
    flush() {
      emit(buffer);
      buffer = "";
    },
  };
}
