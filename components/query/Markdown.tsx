function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-2 space-y-1.5">
          {list.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent" aria-hidden>
                ›
              </span>
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) {
      list.push(line.replace(/^\s*[-*] /, ""));
      continue;
    }
    flushList();
    if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-2">{inline(line)}</p>);
  }
  flushList();
  return <>{blocks}</>;
}
