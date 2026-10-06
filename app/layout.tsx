import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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

// Runs before paint: restores theme + recruiter mode and sets the browser chrome colour from the site theme.
const themeScript = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem("kernel:theme");if(t)d.dataset.theme=t;if(s.getItem("kernel:recruiter")==="on")d.dataset.recruiter="on";var m=document.createElement("meta");m.name="theme-color";m.content=t==="light"?"#f6f4ef":"#0e0f11";document.head.appendChild(m);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <a
          href="#main"
          className="sr-only rounded bg-accent px-3 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <Overlays />
      </body>
    </html>
  );
}
