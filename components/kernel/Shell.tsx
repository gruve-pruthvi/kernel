"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { createLineDecoder } from "@/components/query/stream";
import { validateAction, type UiAction } from "@/core/actions";
import { getSystem, portfolio } from "@/core/content";
import type { GraphEdge } from "@/core/graph";
import type { PositionedNode } from "@/core/graph-layout";
import { commandName } from "@/core/shell/analytics";
import { COMMANDS } from "@/core/shell/commands";
import { autosuggest, commonPrefix, complete, describeCandidates, type MenuItem } from "@/core/shell/complete";
import { parseDeepLink } from "@/core/shell/deeplink";
import { execute, HISTORY_LIMIT, initialState } from "@/core/shell/execute";
import { explain, explainLines } from "@/core/shell/explain";
import { buildFs, parseCwd, pathOf } from "@/core/shell/fs";
import { out, seg } from "@/core/shell/registry";
import { styleLine } from "@/core/shell/style";
import type { Effect, HistoryEntry, OutputItem, RuntimeEnv, Seg, ShellState, View } from "@/core/shell/types";
import { bootLines } from "@/core/shell/welcome";
import { ModeSwitch } from "@/components/shell/ModeSwitch";
import { track } from "@/lib/analytics";
import { switchMode } from "@/lib/mode";
import { kernel, useKernel } from "@/lib/store";
import { useMotionAllowed } from "@/lib/use-motion-allowed";
import type { QueryEvent } from "@/server/query-handler";
import { blockWhileBusy, escapeAction, tabDecision } from "./keys";
import { comboboxProps, createTypewriter, mobileKeys, optionId, splitRows, type MobileKeyId } from "./policy";
import { PromptText, Transcript, type Row } from "./Transcript";
import { ViewPane } from "./ViewPane";

const HISTORY_KEY = "kernel:history";
const BOOT_KEY = "kernel:booted";
const CWD_KEY = "kernel:cwd";
const LIST_ID = "kernel-completions";
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is HistoryEntry => typeof e?.command === "string" && typeof e?.at === "number")
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  } catch {
    /* storage unavailable — history stays in memory */
  }
}

const answerLine = (text: string, suffix: Seg[] = []): OutputItem => ({
  line: [seg("▸ ", "accent"), ...(text || "…").split("\n").flatMap((l, i) => [...(i ? [seg("\n")] : []), ...styleLine(l)]), ...suffix],
});

type Pane = { view: View; activeId: string | null } | null;
type Search = { query: string; skip: number };
type Ai = RuntimeEnv["ai"];

export function Shell({
  graph,
  initial,
  variant = "page",
  onExit,
}: {
  graph: { nodes: PositionedNode[]; edges: GraphEdge[] };
  initial: OutputItem[];
  variant?: "page" | "console";
  onExit?: () => void;
}) {
  const router = useRouter();
  const motion = useMotionAllowed();
  const theme = useKernel((s) => s.theme);
  const motionRef = useRef(motion);

  const idRef = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() => initial.map((item, i) => ({ id: i + 1, kind: "item", item })));
  const stateRef = useRef<ShellState>(initialState(0));
  const [cwd, setCwd] = useState<string[]>([]);
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [histCursor, setHistCursor] = useState<number | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  const [menu, setMenu] = useState<{ items: MenuItem[]; index: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [pane, setPaneState] = useState<Pane>(null);
  const [ai, setAi] = useState<Ai>("unknown");
  const [clock, setClock] = useState("");
  const envRef = useRef<RuntimeEnv>({ theme: "dark", motion: "full", mode: "shell", surface: "page", ai: "unknown", pane: null });
  const cancel = useRef<{ cancelled: boolean; abort?: AbortController; onCancel?: () => void }>({ cancelled: false });
  const aiHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    motionRef.current = motion;
    envRef.current = {
      theme,
      motion: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full",
      mode: "shell",
      surface: variant,
      ai,
      pane: pane?.view.type ?? null,
    };
  }, [motion, theme, ai, pane, variant]);

  /** Pane open/close/switch animates (view transition); activeId changes during a simulation do not. */
  const showPane = useCallback((next: Pane) => startTransition(() => setPaneState(next)), []);

  const add = useCallback((items: OutputItem[], live = false) => {
    const created: Row[] = items.map((item) => ({ id: ++idRef.current, kind: "item", item, ...(live ? { live } : {}) }));
    setRows((r) => [...r, ...created]);
    return created.map((c) => c.id);
  }, []);

  const replace = useCallback((id: number, item: OutputItem, live = false) => {
    setRows((r) => r.map((row) => (row.id === id ? { id, kind: "item", item, ...(live ? { live } : {}) } : row)));
  }, []);

  const typeOut = useCallback(
    async (items: OutputItem[]) => {
      if (!motionRef.current || items.length < 3) {
        add(items);
        return;
      }
      const delay = Math.min(20, 400 / items.length);
      for (const item of items) {
        if (cancel.current.cancelled) return;
        add([item]);
        await sleep(delay);
      }
    },
    [add],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [rows, busy, search, menu]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const setCaretAt = (pos: number) => {
    setCaret(pos);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  // ---------- effects ----------

  const playSimulation = useCallback(
    async (slug: string) => {
      const system = getSystem(slug);
      if (!system?.simulation) return;
      const W = 12;
      showPane({ view: { type: "architecture", slug }, activeId: null });
      add([out(seg("▶ ", "accent"), seg(system.name, "heading"), seg(`  "${system.simulation.prompt}"`, "muted"))]);
      const t0 = performance.now();
      for (const step of system.simulation.steps) {
        if (cancel.current.cancelled) break;
        setPaneState({ view: { type: "architecture", slug }, activeId: step.nodeId });
        const label = seg(`  [${step.title}]`.padEnd(15), "accent");
        const [rowId] = add([out(label, seg("─".repeat(W), "faint"), seg(`  ${step.detail}`, "muted"))], true);
        const bar = (filled: number, done: boolean) =>
          out(label, seg("━".repeat(filled), "accent"), seg("─".repeat(W - filled), "faint"), seg(`  ${step.detail}`, done ? "text" : "muted"));
        const frames = motionRef.current ? W : 1;
        let filled = 0;
        for (let f = 1; f <= frames; f++) {
          if (cancel.current.cancelled) break;
          if (motionRef.current) await sleep((step.durationMs * 0.7) / frames);
          filled = Math.round((f / frames) * W);
          replace(rowId, bar(filled, false), true);
        }
        replace(rowId, bar(filled, filled === W)); // settle into the log at its real progress
      }
      setPaneState({ view: { type: "architecture", slug }, activeId: null });
      if (cancel.current.cancelled) add([out(seg("^C interrupted", "error"))]);
      else {
        stateRef.current = { ...stateRef.current, stats: { ...stateRef.current.stats, simulations: stateRef.current.stats.simulations + 1 } };
        add([out(seg(`  ✓ completed in ${((performance.now() - t0) / 1000).toFixed(1)}s`, "ok"), seg("  (simulated walkthrough)", "faint"))]);
      }
    },
    [add, replace, showPane],
  );

  const applyAction = useCallback(
    (raw: UiAction) => {
      const a = validateAction(raw, portfolio);
      if (!a) {
        if (process.env.NODE_ENV !== "production") console.debug("[kernel] dropped action", raw);
        return;
      }
      if (a.type === "openSystem") showPane({ view: { type: "architecture", slug: a.slug }, activeId: null });
      else if (a.type === "highlightGraph") showPane({ view: { type: "graph", focus: a.ids }, activeId: null });
      else if (a.type === "filterSystems") showPane({ view: { type: "graph", focus: [a.tech ? `tech:${a.tech}` : `cap:${a.capability}`] }, activeId: null });
      else if (a.type === "navigate") {
        const system = /^\/systems\/([a-z0-9-]+)$/.exec(a.path);
        if (system) showPane({ view: { type: "architecture", slug: system[1] }, activeId: null });
        else {
          const page = a.path.replace(/^\//, "") || "systems";
          add([out(seg("  → ", "faint"), seg(`gui ${page}`, "accent", { run: `gui ${page}` }), seg(" to open it visually", "faint"))]);
        }
      } else add([out(seg("  → ", "faint"), seg(a.mode === "human" ? "human" : "pwd", "accent", { run: a.mode === "human" ? "human" : "pwd" }), seg(a.mode === "human" ? " for the recruiter view" : " — you are already in the shell", "faint"))]);
    },
    [add, showPane],
  );

  const ask = useCallback(
    async (question: string) => {
      const session = cancel.current;
      const abort = new AbortController();
      session.abort = abort;
      const [rowId] = add([out(seg("▸ ", "accent"), seg("thinking…", "faint"))], true);
      let sources: string[] = [];
      // Typewriter: steady reveal that catches up with bursts; stop() guarantees no later writes.
      const tw = createTypewriter({
        write: (shown) => replace(rowId, answerLine(shown), true),
        nextFrame,
        instant: () => !motionRef.current,
        now: () => performance.now(),
      });
      session.onCancel = () => void tw.stop();
      const interrupted = async () => {
        await tw.stop();
        replace(rowId, answerLine(tw.shown, [seg(" ^C", "faint")]));
        aiHistory.current.pop();
      };

      aiHistory.current = [...aiHistory.current, { role: "user" as const, content: question.slice(0, 500) }].slice(-10);
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: aiHistory.current }),
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          await tw.stop();
          replace(rowId, out(seg("▸ ", "error"), seg(data.error ?? "query failed — try again", "error")));
          aiHistory.current.pop();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const lines = createLineDecoder((e: QueryEvent) => {
          if (e.type === "meta") {
            setAi(e.mode === "ai" ? "online" : "offline");
            sources = e.sources.slice(0, 4).map((s) => s.title);
          } else if (e.type === "text") tw.push(e.text);
          else if (e.type === "action" || e.type === "suggestion") applyAction(e.action);
          else if (e.type === "error") add([out(seg(e.message, "error"))]);
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lines.push(decoder.decode(value, { stream: true }));
        }
        lines.flush();
        await tw.end();
        if (session.cancelled) return interrupted();
        const received = tw.received;
        replace(rowId, answerLine(received));
        if (received) aiHistory.current = [...aiHistory.current, { role: "assistant" as const, content: received.slice(0, 1500) }];
        else aiHistory.current.pop();
        if (sources.length) add([out(seg(`  sources: ${sources.join(" · ")}`, "faint"))]);
        add(explainLines(explain(portfolio, question)));
      } catch {
        if (session.cancelled) return interrupted();
        await tw.stop();
        replace(rowId, out(seg("▸ ", "error"), seg("network error — try again", "error")));
        aiHistory.current.pop();
      }
    },
    [add, applyAction, replace],
  );

  const perform = useCallback(
    async (e: Effect) => {
      switch (e.type) {
        case "openView":
          showPane({ view: e.view, activeId: null });
          return;
        case "closeView":
          showPane(null);
          return;
        case "navigate":
          // A hard load lets pre-paint scripts run (reboot needs the bootloader's cover).
          if (e.hard) window.location.assign(e.href);
          else router.push(e.href);
          return;
        case "download": {
          const a = document.createElement("a");
          a.href = e.href;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        case "simulate":
          return playSimulation(e.slug);
        case "ask":
          return ask(e.question);
        case "clear":
          setRows([]);
          return;
        case "mode":
          void switchMode(e.mode, router, motionRef.current);
          return;
        case "exit":
          if (onExit) onExit();
          else void switchMode("human", router, motionRef.current);
          return;
      }
    },
    [ask, onExit, playSimulation, router, showPane],
  );

  const run = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      cancel.current = { cancelled: false };
      // Capture before execute(): the updater runs later, after stateRef has moved on.
      const promptRow: Row = { id: ++idRef.current, kind: "prompt", cwd: stateRef.current.cwd, text: raw };
      setRows((r) => [...r, promptRow]);
      setInput("");
      setCaret(0);
      setHistCursor(null);
      setSearch(null);
      setMenu(null);
      const name = commandName(raw);
      if (name) track("command", { command: name });
      try {
        const res = execute(raw, stateRef.current, portfolio, Date.now(), { env: envRef.current });
        stateRef.current = res.state;
        setCwd(res.state.cwd);
        setHistoryList(res.state.history.map((h) => h.command));
        saveHistory(res.state.history);
        try {
          window.sessionStorage.setItem(CWD_KEY, JSON.stringify(res.state.cwd));
        } catch {
          /* ignore */
        }
        await typeOut(res.output);
        for (const effect of res.effects) {
          if (cancel.current.cancelled) break;
          await perform(effect);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    },
    [perform, typeOut],
  );

  const cancelRunning = () => {
    cancel.current.cancelled = true;
    cancel.current.onCancel?.();
    cancel.current.abort?.abort();
  };

  // ---------- boot, AI status, deep links ----------

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let savedCwd: string | null = null;
    try {
      savedCwd = window.sessionStorage.getItem(CWD_KEY);
    } catch {
      /* ignore */
    }
    const cwd0 = parseCwd(savedCwd, buildFs(portfolio));
    stateRef.current = { ...initialState(Date.now(), loadHistory()), cwd: cwd0 };
    setCwd(cwd0);
    const restored = stateRef.current.history.map((h) => h.command);
    const link = parseDeepLink(variant === "console" ? "" : window.location.search);
    // Boot lines handed over by the bootloader continue the transcript instead of replaying the boot animation.
    const handoff = variant === "page" ? kernel.takeHandoff() : null;
    if (handoff) {
      const handed: Row[] = handoff.map((item) => ({ id: ++idRef.current, kind: "item", item }));
      setRows((r) => [...handed, ...r]);
    }
    if (variant === "page") delete document.documentElement.dataset.boot; // the bootloader keeps the page covered until the shell is up
    let firstVisit = false;
    if (variant === "page") {
      try {
        firstVisit = !handoff && !window.sessionStorage.getItem(BOOT_KEY);
        window.sessionStorage.setItem(BOOT_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fetch("/api/status")
      .then((r) => r.json() as Promise<{ ai?: boolean }>)
      .then((d) => setAi(d.ai ? "online" : "offline"))
      .catch(() => {});
    void (async () => {
      setHistoryList(restored);
      if (firstVisit && !reduced && link.commands.length === 0) {
        busyRef.current = true;
        setBusy(true);
        let skipped = false;
        const skip = () => {
          skipped = true;
        };
        window.addEventListener("keydown", skip, { once: true });
        const boot = bootLines(portfolio);
        for (let i = 0; i < boot.length; i++) {
          const row: Row = { id: ++idRef.current, kind: "item", item: boot[i] };
          setRows((r) => [...r.slice(0, i), row, ...r.slice(i)]);
          if (!skipped) await sleep(160);
        }
        window.removeEventListener("keydown", skip);
        busyRef.current = false;
        setBusy(false);
      }
      for (const notice of link.notices) add([out(seg(notice, "faint"))]);
      for (const command of link.commands) await run(command);
      inputRef.current?.focus({ preventScroll: true });
    })();
  }, [add, run, variant]);

  // ---------- input ----------

  const candidates = useMemo(() => (search || !input ? [] : complete(input, cwd, portfolio, COMMANDS)), [input, cwd, search]);
  // fish-style: newest matching history entry first, then the first completion candidate
  const suggestion = caret === input.length && !menu ? autosuggest(input, historyList, candidates) : "";
  const searchMatch = useMemo(() => {
    if (!search || !search.query) return null;
    const hits = [...historyList].reverse().filter((c) => c.includes(search.query));
    return hits.length ? hits[Math.min(search.skip, hits.length - 1)] : null;
  }, [search, historyList]);

  // zsh-style: complete, extend to the common prefix, then open a menu that Tab / Shift+Tab cycles through.
  const completeNow = (back = false) => {
    if (menu) {
      const n = menu.items.length;
      const index = menu.index < 0 ? (back ? n - 1 : 0) : (menu.index + (back ? -1 : 1) + n) % n;
      setMenu({ ...menu, index });
      setInput(menu.items[index].value);
      setCaretAt(menu.items[index].value.length);
      return;
    }
    if (candidates.length === 1) {
      setInput(candidates[0]);
      setCaretAt(candidates[0].length);
    } else if (candidates.length > 1) {
      const prefix = commonPrefix(candidates);
      if (prefix.length > input.length) {
        setInput(prefix);
        setCaretAt(prefix.length);
      } else {
        setMenu({ items: describeCandidates(candidates, cwd, portfolio, COMMANDS), index: -1 });
      }
    }
  };

  const pickFromMenu = (item: MenuItem) => {
    setMenu(null);
    setInput(item.value);
    setCaretAt(item.value.length);
    inputRef.current?.focus({ preventScroll: true });
  };

  const historyPrev = () => {
    if (historyList.length === 0) return;
    const i = histCursor === null ? historyList.length - 1 : Math.max(0, histCursor - 1);
    setHistCursor(i);
    setInput(historyList[i]);
    setCaretAt(historyList[i].length);
  };

  const historyNext = () => {
    if (histCursor === null) return;
    const i = histCursor + 1;
    const next = i >= historyList.length ? "" : historyList[i];
    setHistCursor(i >= historyList.length ? null : i);
    setInput(next);
    setCaretAt(next.length);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    const lower = k.toLowerCase();
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;

    if ((e.metaKey || e.ctrlKey) && lower === "k") {
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      return;
    }
    if (ctrl && lower === "c") {
      e.preventDefault();
      if (busyRef.current) cancelRunning();
      else {
        setRows((r) => [...r, { id: ++idRef.current, kind: "prompt", cwd, text: `${search ? "" : input}^C` }]);
        setInput("");
        setCaret(0);
        setSearch(null);
      }
      return;
    }
    if (busyRef.current) {
      if (blockWhileBusy({ key: k, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey })) e.preventDefault();
      return;
    }
    if (k === "Escape") {
      e.nativeEvent.stopImmediatePropagation();
      const layer = escapeAction({ menu: Boolean(menu), search: Boolean(search), pane: Boolean(pane), console: variant === "console" });
      if (layer === "menu") setMenu(null);
      else if (layer === "search") setSearch(null);
      else if (layer === "pane") showPane(null);
      else if (layer === "exit") onExit?.();
      return;
    }
    if (menu) {
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        completeNow(k === "ArrowUp");
        return;
      }
      if (k === "Enter" && menu.index >= 0) {
        e.preventDefault();
        setMenu(null);
        return;
      }
      if (k !== "Tab" && !["Shift", "Control", "Alt", "Meta"].includes(k)) setMenu(null);
    }
    if (search) {
      if (ctrl && lower === "r") {
        e.preventDefault();
        setSearch({ ...search, skip: search.skip + 1 });
      } else if (ctrl && lower === "g") {
        e.preventDefault();
        setSearch(null);
      } else if (k === "Enter") {
        e.preventDefault();
        const match = searchMatch;
        setSearch(null);
        if (match) void run(match);
      } else if (k === "ArrowRight" || k === "ArrowLeft" || k === "Tab") {
        e.preventDefault();
        const match = searchMatch ?? "";
        setSearch(null);
        setInput(match);
        setCaretAt(match.length);
      }
      return;
    }
    if (ctrl) {
      if (lower === "r") return void (e.preventDefault(), setSearch({ query: "", skip: 0 }));
      if (lower === "l") return void (e.preventDefault(), setRows([]));
      if (lower === "a") return void (e.preventDefault(), setCaretAt(0));
      if (lower === "e") return void (e.preventDefault(), setCaretAt(input.length));
      if (lower === "u") {
        e.preventDefault();
        setInput(input.slice(caret));
        setCaretAt(0);
        return;
      }
      if (lower === "w") {
        e.preventDefault();
        const before = input.slice(0, caret).replace(/\S+\s*$/, "");
        setInput(before + input.slice(caret));
        setCaretAt(before.length);
        return;
      }
    }
    if (k === "q" && !input && pane?.view.type === "reader") {
      e.preventDefault();
      showPane(null);
    } else if (k === "Enter") {
      e.preventDefault();
      void run(input);
    } else if (k === "Tab") {
      if (tabDecision({ input, menuOpen: Boolean(menu), busy: busyRef.current }) === "pass") return;
      e.preventDefault();
      completeNow(e.shiftKey);
    } else if ((k === "ArrowRight" || k === "End") && suggestion) {
      e.preventDefault();
      setInput(input + suggestion);
      setCaretAt((input + suggestion).length);
    } else if (k === "ArrowUp") {
      e.preventDefault();
      historyPrev();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      historyNext();
    }
  };

  const syncCaret = () => setCaret(inputRef.current?.selectionStart ?? input.length);
  const runFromClick = (command: string) => void run(command);
  const { settled, live } = splitRows(rows);
  const keyActions: Record<MobileKeyId, () => void> = {
    tab: () => completeNow(),
    up: historyPrev,
    cdup: () => runFromClick("cd .."),
    ls: () => runFromClick("ls"),
    help: () => runFromClick("help"),
    clear: () => setRows([]),
    cancel: cancelRunning,
  };

  return (
    <div className={`${variant === "page" ? "fixed inset-0 z-30" : "h-full"} flex flex-col bg-bg font-mono text-[13px] leading-[1.65] text-text`}>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] text-faint">
        <span className="size-2.5 rounded-full bg-[var(--k-model)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-queue)]" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-[var(--k-store)]" aria-hidden="true" />
        <span className="ml-3 truncate">kernel — {pathOf(cwd)}</span>
        {variant === "page" ? (
          <ModeSwitch className="ml-auto" />
        ) : (
          <>
            <span className="ml-auto hidden sm:inline">esc or ` to close</span>
            <button type="button" onClick={() => router.push("/shell")} className="hover:text-text" aria-label="Open the full shell">
              ⤢
            </button>
          </>
        )}
        <button type="button" onClick={kernel.toggleTheme} className="hover:text-text" aria-label="Toggle theme">
          ◐
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6"
          onMouseUp={() => {
            if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
          }}
        >
          <div role="log" aria-live="polite" aria-label="Kernel shell output">
            <Transcript rows={settled} onRun={runFromClick} />
          </div>
          {live.length > 0 && (
            <div aria-hidden="true">
              <Transcript rows={live} onRun={runFromClick} />
            </div>
          )}
          <label className="relative block whitespace-pre-wrap break-all">
            <span className={busy ? "invisible" : undefined}>
              {search ? (
                <>
                  <span className="text-faint">(reverse-i-search)`</span>
                  <span>{search.query}</span>
                  <span className="text-faint">&apos;: </span>
                  <span>{searchMatch ?? ""}</span>
                  <span className="cursor-blink bg-accent"> </span>
                </>
              ) : (
                <>
                  <PromptText cwd={cwd} />
                  <span>{input.slice(0, caret)}</span>
                  <span className="cursor-blink bg-accent text-accent-contrast">{input[caret] ?? " "}</span>
                  <span>{input.slice(caret + 1)}</span>
                  {suggestion && <span className="text-faint">{suggestion}</span>}
                </>
              )}
            </span>
            <input
              ref={inputRef}
              value={search ? search.query : input}
              onChange={(e) => {
                if (search) {
                  setSearch({ query: e.target.value, skip: 0 });
                  return;
                }
                setInput(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
                setHistCursor(null);
                setMenu(null);
              }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onClick={syncCaret}
              onSelect={syncCaret}
              readOnly={busy}
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="go"
              aria-label="Kernel shell input"
              {...comboboxProps(menu, LIST_ID)}
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
          </label>
          {menu && (
            <div id={LIST_ID} role="listbox" aria-label="Completions" className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-4 border-t border-border pt-1">
              {menu.items.map((item, i) => (
                <button
                  key={item.value}
                  id={optionId(LIST_ID, i)}
                  type="button"
                  role="option"
                  aria-selected={i === menu.index}
                  onPointerDown={(ev) => ev.preventDefault()}
                  onClick={() => pickFromMenu(item)}
                  className={`flex min-w-0 gap-2 rounded-sm px-1 text-left ${i === menu.index ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                >
                  <span className={i === menu.index ? "text-accent" : "text-text"}>{item.label}</span>
                  <span className="truncate text-faint">{item.detail}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {pane && (
          <ViewTransition name="kernel-pane">
            <div className="h-[42%] shrink-0 border-t border-border md:h-auto md:w-[46%] md:min-w-[420px] md:border-t-0">
              <ViewPane view={pane.view} activeId={pane.activeId} graph={graph} onClose={() => showPane(null)} onRun={runFromClick} />
            </div>
          </ViewTransition>
        )}
      </div>

      <div className="hidden shrink-0 gap-1.5 overflow-x-auto border-t border-border px-2 py-1.5 [@media(pointer:coarse)]:flex" aria-label="Shell keys">
        {mobileKeys(busy).map((key) => (
          <button
            key={key.id}
            type="button"
            disabled={key.disabled}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              keyActions[key.id]();
              inputRef.current?.focus({ preventScroll: true });
            }}
            className={`shrink-0 rounded border px-2.5 py-1 text-[12px] disabled:opacity-40 ${key.id === "cancel" ? "border-accent text-accent" : "border-border text-muted"}`}
          >
            {key.label}
          </button>
        ))}
      </div>

      <div className="flex h-6 shrink-0 items-center gap-3 bg-surface-2 px-3 text-[11px]">
        <span className="bg-accent px-1.5 text-accent-contrast">kernel</span>
        <span className="text-text">0:shell{pane ? "" : "*"}</span>
        {pane && <span className="text-text">1:{pane.view.type === "reader" ? "less" : "view"}*</span>}
        <span className="ml-auto hidden text-muted sm:inline">{pathOf(cwd)}</span>
        <span className={ai === "offline" ? "text-[var(--k-queue)]" : "text-[var(--k-store)]"}>ai:{ai}</span>
        <span className="text-muted">{clock}</span>
      </div>
    </div>
  );
}
