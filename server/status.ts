export function statusResponse(env: { GEMINI_API_KEY?: string }): Response {
  return new Response(JSON.stringify({ ai: Boolean(env.GEMINI_API_KEY) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
