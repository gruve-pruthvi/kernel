import Link from "next/link";
import { btnGhost } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-28 font-mono sm:px-6">
      <p className="text-sm text-accent">404</p>
      <h1 className="mt-3 text-2xl text-text">route not found</h1>
      <p className="mt-2 text-sm text-muted">
        That path isn&apos;t part of this system. Press <span className="text-text">⌘K</span> for the shell, or head back.
      </p>
      <Link href="/" className={`${btnGhost} mt-8`}>
        cd ~
      </Link>
    </section>
  );
}
