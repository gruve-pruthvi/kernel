import Link from "next/link";

const tones = {
  default: "border-border text-muted hover:text-text hover:border-border-strong",
  accent: "border-accent/40 text-accent",
};

export function Tag({
  children,
  href,
  tone = "default",
}: {
  children: React.ReactNode;
  href?: string;
  tone?: keyof typeof tones;
}) {
  const cls = `inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] transition ${tones[tone]}`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}
