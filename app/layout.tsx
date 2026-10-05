import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { RecruiterSummary } from "@/components/recruiter/RecruiterSummary";
import { Overlays } from "@/components/shell/Overlays";
import { getIdentity } from "@/core/content";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

const identity = getIdentity();

export const metadata: Metadata = {
  title: { default: "Kernel", template: "%s · Kernel" },
  description: `${identity.role}. ${identity.tagline}`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
  ],
};

// Runs before paint: restores theme + recruiter mode, and arms the boot sequence on first home visit.
const bootScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("kernel:theme");if(t)d.dataset.theme=t;var r=s.getItem("kernel:recruiter")==="on";if(r)d.dataset.recruiter="on";var m=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(location.pathname==="/"&&!r&&!m&&!s.getItem("kernel:booted"))d.dataset.boot="pending";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only rounded bg-accent px-3 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <RecruiterSummary />
          {children}
        </main>
        <Footer />
        <Overlays />
      </body>
    </html>
  );
}
