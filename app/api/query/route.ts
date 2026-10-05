import { createGoogle } from "@ai-sdk/google";
import { portfolio } from "@/core/content";
import { createRateLimiter } from "@/core/ratelimit";
import { handleQuery } from "@/server/query-handler";

const DEFAULT_MODEL = "gemini-flash-latest";
export const maxDuration = 30;

const limiter = createRateLimiter({ perMinute: 10, perDay: 60 });

export async function POST(req: Request) {
  return handleQuery(req, {
    portfolio,
    limiter,
    getModel: () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return null;
      return createGoogle({ apiKey })(process.env.GEMINI_MODEL || DEFAULT_MODEL);
    },
  });
}
