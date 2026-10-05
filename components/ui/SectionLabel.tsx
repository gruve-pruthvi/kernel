export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] uppercase tracking-[0.2em] text-faint ${className}`}>{children}</p>;
}
