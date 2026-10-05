import { getIdentity } from "@/core/content";
import { Kbd } from "@/components/ui/Kbd";

export function Footer() {
  const identity = getIdentity();
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono">
          KERNEL · {identity.name} · {new Date().getFullYear()}
        </p>
        <p className="flex items-center gap-2">
          <Kbd>/</Kbd> ask <span aria-hidden>·</span> <Kbd>⌘K</Kbd> shell
        </p>
      </div>
    </footer>
  );
}
