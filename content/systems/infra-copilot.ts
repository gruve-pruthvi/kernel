import type { System } from "@/core/schema";

export const infraCopilot = {
  id: "infra-copilot",
  slug: "infra-copilot",
  number: 2,
  name: "Infra Copilot",
  tagline: "Describe a project and it builds the infrastructure locally, then helps you run and debug it.",
  featured: true,
  category: "AI · DevOps",
  period: "Aug 2026 — Oct 2026",
  status: "production",
  summary:
    "Infra Copilot is a chat-based control room for your local Docker and Kubernetes. Describe a project and what it needs, and it builds the infrastructure for you locally. Ask things like \"why is this container restarting?\" and it answers with evidence from the logs, events and stats. It deploys and fixes things too, with every tool call going through an approval and audit gateway and a dry-run mode as a backstop. A live dashboard finds wasted resources such as idle containers and orphan volumes.",
  problem:
    "Standing up local infrastructure for a project means writing and wiring container configs by hand; when something breaks, finding out why means digging through logs, events and stats, and fixing it means typing commands that are easy to get wrong.",
  context: "Personal project. Targets Docker Desktop and Kubernetes (read-only).",
  role: "Solo builder",
  responsibilities: [
    "Built the pydantic-ai agent, switchable between Anthropic, OpenAI and Gemini models",
    "Turned a project description into locally built infrastructure, deployed through the same gated tools",
    "Wired Docker, Kubernetes and monitoring in as MCP stdio servers",
    "Built the ToolGateway: approval, auditing and argument redaction for every tool call, with a dry-run mode",
    "Streamed chat over SSE and pushed dashboard updates over WebSocket from a background monitor loop",
    "Built the Vite + React dashboard that surfaces idle containers and orphan volumes",
  ],
  technologies: ["python", "fastapi", "uv", "pydantic-ai", "mcp", "llm-apis", "react", "vite", "typescript", "docker", "kubernetes"],
  capabilities: ["agents", "platform", "product-ui", "apis"],
  architecture: {
    nodes: [
      { id: "ui", label: "Web App", kind: "client", x: 4, y: 50, description: "Vite + React chat and live dashboard.", tech: ["vite", "react", "typescript"] },
      { id: "api", label: "API", kind: "service", x: 26, y: 50, description: "FastAPI backend: REST, SSE for streamed chat, WebSocket /ws/events for dashboard pushes.", tech: ["fastapi"] },
      { id: "agent", label: "Agent", kind: "agent", x: 48, y: 16, description: "pydantic-ai agent that gathers evidence and explains the answer.", tech: ["pydantic-ai"] },
      { id: "llm", label: "LLM", kind: "model", x: 76, y: 6, description: "Anthropic, OpenAI or Gemini, switchable.", tech: ["llm-apis"] },
      { id: "gateway", label: "ToolGateway", kind: "service", x: 50, y: 52, description: "Approves, audits and redacts the arguments of every tool call; dry-run mode as a backstop." },
      { id: "mcp", label: "MCP Servers", kind: "service", x: 82, y: 52, description: "MCP stdio servers for Docker, Kubernetes and monitoring.", tech: ["mcp"] },
      { id: "targets", label: "Docker + K8s", kind: "external", x: 96, y: 86, description: "Docker Desktop, and Kubernetes read-only.", tech: ["docker", "kubernetes"] },
      { id: "monitor", label: "Monitor Loop", kind: "service", x: 30, y: 90, description: "Background loop that watches the targets and feeds the event bus that drives dashboard pushes." },
    ],
    edges: [
      { from: "ui", to: "api" },
      { from: "api", to: "agent", label: "chat · SSE" },
      { from: "agent", to: "llm", label: "reason" },
      { from: "agent", to: "gateway", label: "tool call" },
      { from: "gateway", to: "mcp", label: "approved" },
      { from: "mcp", to: "targets", label: "inspect · act" },
      { from: "monitor", to: "api", label: "event bus · WS" },
    ],
  },
  decisions: [
    {
      title: "Enforce safety in a gateway, not in the prompt",
      context: "The copilot can change things, and a model can be wrong or be talked into acting.",
      options: ["Trust the model to ask before acting", "Route every tool call through a gateway that approves, audits and redacts, with a dry-run mode"],
      choice: "Route every tool call through a gateway that approves, audits and redacts, with a dry-run mode",
      rationale: "A rule in the prompt is a suggestion; a check in the gateway holds even when the model gets it wrong, and the audit log shows exactly what ran.",
      status: "accepted",
    },
  ],
  simulation: {
    prompt: "Why is this container restarting?",
    steps: [
      { nodeId: "ui", title: "REQUEST", detail: "Question asked in chat", durationMs: 700 },
      { nodeId: "api", title: "STREAM", detail: "Chat stream opened over SSE", durationMs: 700 },
      { nodeId: "agent", title: "PLAN", detail: "Needs logs, events and stats", durationMs: 800 },
      { nodeId: "gateway", title: "GATEWAY", detail: "Read-only calls approved · arguments redacted · audited", durationMs: 900 },
      { nodeId: "mcp", title: "TOOLS", detail: "Docker MCP server reads logs, events and stats", durationMs: 900 },
      { nodeId: "llm", title: "REASON", detail: "Matches the evidence to a likely cause", durationMs: 1000 },
      { nodeId: "agent", title: "ANSWER", detail: "Cause explained with the log lines and events behind it", durationMs: 900 },
      { nodeId: "ui", title: "RESPONSE", detail: "Answer streamed in, with a fix offered as a dry run", durationMs: 700 },
    ],
  },
  placeholder: false,
} satisfies System;
