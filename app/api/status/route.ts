import { statusResponse } from "@/server/status";

export const dynamic = "force-dynamic";

export function GET() {
  return statusResponse({ GEMINI_API_KEY: process.env.GEMINI_API_KEY });
}
