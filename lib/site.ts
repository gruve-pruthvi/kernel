export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/+$/, "");
}
