// PLACEHOLDER — sample system.
import type { System } from "@/core/schema";

export const relay = {
  id: "relay",
  slug: "relay",
  number: 2,
  name: "Relay",
  tagline: "Multi-agent orchestration with tools, memory and checkpoints.",
  featured: true,
  category: "AI · Agents",
  period: "2025",
  status: "production",
  summary:
    "Relay turns a natural-language request into a plan, fans it out to executor agents that call real tools over MCP, and keeps durable state so long tasks survive failures.",
  problem:
    "Teams were stitching scripts and chatbots together for repetitive operational tasks, with no visibility or recovery when a step failed.",
  role: "Engineer — agent runtime, tool integration and state management",
  responsibilities: [
    "Designed planner/executor topology and task contracts",
    "Integrated internal tools as MCP servers",
    "Implemented checkpointing and resumable runs",
  ],
  technologies: ["langgraph", "mcp", "typescript", "python", "redis", "postgres", "llm-apis"],
  capabilities: ["agents", "apis"],
  architecture: {
    nodes: [
      { id: "client", label: "Chat Surface", kind: "client", x: 4, y: 50, description: "Where users describe the task and watch progress." },
      { id: "gateway", label: "Gateway", kind: "service", x: 24, y: 50, description: "Auth, rate limits and run lifecycle API.", tech: ["typescript"] },
      { id: "planner", label: "Planner Agent", kind: "agent", x: 46, y: 50, description: "Breaks the request into typed tasks with dependencies.", tech: ["langgraph"] },
      { id: "executor", label: "Executor Agents", kind: "agent", x: 70, y: 50, description: "Run tasks in parallel and report structured results.", tech: ["langgraph"] },
      { id: "tools", label: "MCP Tool Servers", kind: "external", x: 70, y: 12, description: "Ticketing, email and metrics exposed as MCP tools.", tech: ["mcp"] },
      { id: "memory", label: "State + Memory", kind: "store", x: 70, y: 88, description: "Checkpoints and conversation memory.", tech: ["postgres", "redis"] },
      { id: "model", label: "LLM", kind: "model", x: 94, y: 50, description: "Reasoning for planning and tool selection.", tech: ["llm-apis"] },
    ],
    edges: [
      { from: "client", to: "gateway" },
      { from: "gateway", to: "planner" },
      { from: "planner", to: "executor", label: "tasks" },
      { from: "executor", to: "tools", label: "tool calls" },
      { from: "executor", to: "memory", label: "checkpoint" },
      { from: "executor", to: "model", label: "reason" },
    ],
  },
  decisions: [
    {
      title: "MCP for tool integration",
      context: "Each team owned different internal tools with different auth and APIs.",
      options: ["Custom function wrappers per tool", "Model Context Protocol servers"],
      choice: "Model Context Protocol servers",
      rationale: "One protocol for discovery and invocation; teams could ship tools without touching the agent runtime.",
      status: "accepted",
    },
  ],
  tradeOffs: [{ gained: "Resumable long-running tasks", cost: "Extra writes on every step for checkpoints" }],
  impact: [
    { label: "manual steps removed", value: "3.4k/mo", note: "sample metric" },
    { label: "run success rate", value: "93%", note: "sample metric" },
  ],
  simulation: {
    prompt: "Summarise this week's open incidents and email the on-call lead.",
    steps: [
      { nodeId: "client", title: "REQUEST", detail: "Task submitted", durationMs: 600 },
      { nodeId: "gateway", title: "RUN", detail: "Run r-219 created", durationMs: 600 },
      { nodeId: "planner", title: "PLAN", detail: "3 tasks: fetch incidents → summarise → send email", durationMs: 1000 },
      { nodeId: "executor", title: "EXECUTE", detail: "Task 1/3 dispatched", durationMs: 700 },
      { nodeId: "tools", title: "TOOL", detail: "tickets.search(status=open, since=7d) → 12 results", durationMs: 900 },
      { nodeId: "model", title: "REASON", detail: "Summarising 12 incidents by severity", durationMs: 1000 },
      { nodeId: "memory", title: "CHECKPOINT", detail: "State saved after task 2/3", durationMs: 600 },
      { nodeId: "tools", title: "TOOL", detail: "email.send(to=on-call lead) → delivered", durationMs: 800 },
      { nodeId: "client", title: "DONE", detail: "Run completed in 14.2s", durationMs: 600 },
    ],
  },
  placeholder: true,
} satisfies System;
