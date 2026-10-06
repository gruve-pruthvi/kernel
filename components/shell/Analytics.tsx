import Script from "next/script";

/** Privacy-friendly analytics (Plausible): no cookies, nothing personal. Off unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <>
      <Script id="plausible-queue" strategy="afterInteractive">
        {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};"}
      </Script>
      <Script defer data-domain={domain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
    </>
  );
}
