export function SampleTag({ show }: { show: boolean }) {
  if (!show || process.env.NODE_ENV === "production") return null;
  return (
    <span className="rounded border border-dashed border-border-strong px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
      sample content
    </span>
  );
}
