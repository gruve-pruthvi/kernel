"use client";

import { useEffect } from "react";

const LINES = [
  "KERNEL v1.0",
  "loading systems ............ ok",
  "connecting engineering graph  ok",
  "indexing decisions .......... ok",
  "starting query interface .... ok",
  "✓ ready",
];

function finish() {
  try {
    window.localStorage.setItem("kernel:booted", "1");
  } catch {
    /* ignore */
  }
  delete document.documentElement.dataset.boot;
}

export function BootSequence() {
  useEffect(() => {
    if (document.documentElement.dataset.boot !== "pending") return;
    const timer = window.setTimeout(finish, 2500);
    const skip = () => finish();
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  return (
    <div
      className="boot-overlay fixed inset-0 z-[60] items-center justify-center bg-bg"
      aria-hidden="true"
      data-testid="boot"
    >
      <div className="w-[min(420px,calc(100vw-32px))] font-mono text-[13px] leading-7">
        {LINES.map((l, i) => (
          <p
            key={l}
            className={`boot-line ${i === 0 ? "text-accent" : i === LINES.length - 1 ? "text-text" : "text-muted"}`}
            style={{ animationDelay: `${i * 0.28}s` }}
          >
            {l}
          </p>
        ))}
        <p className="boot-line mt-4 text-[11px] text-faint" style={{ animationDelay: "0.4s" }}>
          press any key to skip
        </p>
      </div>
    </div>
  );
}
