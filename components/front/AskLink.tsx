"use client";

/** "Ask about me →": scrolls to the Ask box and puts the cursor in its input. */
export function AskLink() {
  return (
    <a
      href="#ask"
      onClick={() => requestAnimationFrame(() => document.getElementById("ask-input")?.focus({ preventScroll: true }))}
      className="inline-flex items-center px-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline"
    >
      Ask about me →
    </a>
  );
}
