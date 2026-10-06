"use client";

import { usePathname, useRouter } from "next/navigation";
import { modeForPath, type Mode } from "@/core/boot";
import { switchMode } from "@/lib/mode";
import { useMotionAllowed } from "@/lib/use-motion-allowed";

const LABEL: Record<Mode, string> = { human: "human", shell: "shell" };

export function ModeSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const motion = useMotionAllowed();
  const current = modeForPath(pathname);
  return (
    <div role="radiogroup" aria-label="Interface" className={`inline-flex items-center rounded-full border border-border p-0.5 font-mono text-[11px] ${className}`}>
      {(["human", "shell"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={current === m}
          title={m === "human" ? "Recruiter view" : "Terminal"}
          onClick={() => current !== m && void switchMode(m, router, motion)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${current === m ? "bg-accent-soft text-accent" : "text-muted hover:text-text"}`}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${current === m ? "bg-accent" : "bg-faint"}`} />
          {LABEL[m]}
        </button>
      ))}
    </div>
  );
}
