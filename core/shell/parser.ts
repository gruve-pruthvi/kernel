export interface Word {
  value: string;
  quoted: boolean;
}

export type Token = { type: "word"; word: Word } | { type: "pipe" } | { type: "semi" };

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let current = "";
  let quoted = false;
  let started = false;
  let quote: '"' | "'" | null = null;

  const flush = () => {
    if (started) tokens.push({ type: "word", word: { value: current, quoted } });
    current = "";
    quoted = false;
    started = false;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < input.length) current += input[++i];
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      quoted = true;
      started = true;
    } else if (ch === "\\" && i + 1 < input.length) {
      current += input[++i];
      started = true;
    } else if (/\s/.test(ch)) {
      flush();
    } else if (ch === "|" || ch === ";") {
      flush();
      tokens.push({ type: ch === "|" ? "pipe" : "semi" });
    } else {
      current += ch;
      started = true;
    }
  }
  flush();
  return tokens;
}

export interface Stage {
  name: string;
  argv: Word[];
}

export function parse(input: string): { ok: true; pipelines: Stage[][] } | { ok: false; error: string } {
  const lists: Token[][] = [[]];
  for (const t of lex(input)) {
    if (t.type === "semi") lists.push([]);
    else lists[lists.length - 1].push(t);
  }

  const pipelines: Stage[][] = [];
  for (const list of lists) {
    const stages: Word[][] = [[]];
    for (const t of list) {
      if (t.type === "pipe") stages.push([]);
      else if (t.type === "word") stages[stages.length - 1].push(t.word);
    }
    if (stages.length === 1 && stages[0].length === 0) continue;
    if (stages.some((s) => s.length === 0)) return { ok: false, error: "syntax error near unexpected token '|'" };
    pipelines.push(stages.map((ws) => ({ name: ws[0].value, argv: ws.slice(1) })));
  }
  return { ok: true, pipelines };
}

export function expandHistory(
  input: string,
  history: string[],
): { ok: true; line: string; expanded: boolean } | { ok: false; error: string } {
  let out = "";
  let inSingle = false;
  let expanded = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") inSingle = !inSingle;
    if (ch !== "!" || inSingle) {
      out += ch;
      continue;
    }
    if (input[i + 1] === "!") {
      const last = history[history.length - 1];
      if (last === undefined) return { ok: false, error: "!!: event not found" };
      out += last;
      expanded = true;
      i++;
      continue;
    }
    const digits = /^\d+/.exec(input.slice(i + 1));
    if (digits) {
      const n = Number(digits[0]);
      const entry = n >= 1 ? history[n - 1] : undefined;
      if (entry === undefined) return { ok: false, error: `!${digits[0]}: event not found` };
      out += entry;
      expanded = true;
      i += digits[0].length;
      continue;
    }
    out += ch;
  }
  return { ok: true, line: out, expanded };
}

export interface FlagDef {
  short?: string;
  value?: boolean;
  singleDash?: boolean;
  placeholder?: string;
  describe: string;
}
export type FlagSpec = Record<string, FlagDef>;
export type Flags = Record<string, string | true>;

export function parseFlags(
  argv: Word[],
  spec: FlagSpec = {},
): { ok: true; args: string[]; flags: Flags } | { ok: false; error: string } {
  const args: string[] = [];
  const flags: Flags = {};
  const entries = Object.entries(spec);

  for (let i = 0; i < argv.length; i++) {
    const { value: v, quoted } = argv[i];
    if (quoted || v === "-" || !v.startsWith("-") || /^-\d/.test(v)) {
      args.push(v);
      continue;
    }
    if (v === "--") {
      args.push(...argv.slice(i + 1).map((a) => a.value));
      break;
    }
    if (v.startsWith("--")) {
      const body = v.slice(2);
      const eq = body.indexOf("=");
      const name = eq >= 0 ? body.slice(0, eq) : body;
      const inlineValue = eq >= 0 ? body.slice(eq + 1) : undefined;
      const def = spec[name];
      if (!def) return { ok: false, error: `unknown flag --${name}` };
      if (def.value) {
        const val = inlineValue ?? argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `--${name} needs a value` };
        flags[name] = val;
      } else {
        if (inlineValue !== undefined) return { ok: false, error: `--${name} takes no value` };
        flags[name] = true;
      }
      continue;
    }
    const long = entries.find(([name, def]) => def.singleDash && `-${name}` === v);
    if (long) {
      const [name, def] = long;
      if (def.value) {
        const val = argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `-${name} needs a value` };
        flags[name] = val;
      } else flags[name] = true;
      continue;
    }
    const cluster = v.slice(1);
    for (let j = 0; j < cluster.length; j++) {
      const c = cluster[j];
      const entry = entries.find(([, def]) => def.short === c);
      if (!entry) return { ok: false, error: `unknown flag -${c}` };
      const [name, def] = entry;
      if (def.value) {
        const val = cluster.slice(j + 1) || argv[++i]?.value;
        if (val === undefined || val === "") return { ok: false, error: `-${c} needs a value` };
        flags[name] = val;
        break;
      }
      flags[name] = true;
    }
  }
  return { ok: true, args, flags };
}
