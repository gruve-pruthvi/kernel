import type { System } from "@/core/schema";

export const infraCopilot = {
  id: "infra-copilot",
  slug: "infra-copilot",
  number: 6,
  name: "Infra Copilot",
  tagline: "A chat-based control room for your local Docker and Kubernetes.",
  featured: false,
  category: "AI · DevOps",
  period: "2026 — present",
  status: "prototype",
  summary:
    "Infra Copilot lets you ask things like \"why is this container restarting?\" and answers with evidence from the logs, events and stats. It can also deploy or fix things, with safety enforced on the server and a dry-run mode as a backstop, plus a live dashboard that finds wasted resources such as idle containers and orphan volumes.",
  problem:
    "Finding out why a container keeps restarting means digging through logs, events and stats by hand, and fixing it means typing commands that are easy to get wrong.",
  context: "Personal project.",
  role: "Solo builder",
  responsibilities: [
    "Built the chat agent that reads logs, events and stats and answers with evidence",
    "Enforced safety on the server, with a dry-run mode as a backstop, for deploys and fixes",
    "Built a live dashboard of the local setup",
    "Added detection of wasted resources: idle containers and orphan volumes",
  ],
  technologies: ["docker", "kubernetes", "llm-apis"],
  capabilities: ["agents", "platform", "product-ui"],
  architecture: {
    nodes: [
      { id: "chat", label: "Chat + Dashboard", kind: "client", x: 4, y: 50, description: "Ask questions in chat; watch the live dashboard." },
      { id: "agent", label: "Copilot Agent", kind: "agent", x: 26, y: 50, description: "Decides what evidence it needs, gathers it and explains the answer." },
      { id: "llm", label: "LLM", kind: "model", x: 26, y: 12, description: "Reasons over the gathered evidence.", tech: ["llm-apis"] },
      { id: "guard", label: "Safety Layer", kind: "service", x: 50, y: 86, description: "Server-side checks on every deploy or fix, with dry-run mode as a backstop." },
      { id: "tools", label: "Infra Tools", kind: "service", x: 56, y: 46, description: "Reads logs, events and stats; deploys and fixes when allowed." },
      { id: "docker", label: "Docker", kind: "external", x: 92, y: 14, description: "Local containers and volumes.", tech: ["docker"] },
      { id: "k8s", label: "Kubernetes", kind: "external", x: 92, y: 62, description: "Local cluster.", tech: ["kubernetes"] },
      { id: "waste", label: "Waste Finder", kind: "service", x: 60, y: 10, description: "Finds idle containers and orphan volumes." },
    ],
    edges: [
      { from: "chat", to: "agent" },
      { from: "agent", to: "llm", label: "reason" },
      { from: "agent", to: "tools", label: "inspect" },
      { from: "agent", to: "guard", label: "act" },
      { from: "guard", to: "tools", label: "allowed · dry-run" },
      { from: "tools", to: "docker" },
      { from: "tools", to: "k8s" },
      { from: "waste", to: "docker", label: "scan" },
    ],
  },
  decisions: [
    {
      title: "Enforce safety on the server, not in the prompt",
      context: "The copilot can deploy and change things, and a model can be wrong or be talked into acting.",
      options: ["Trust the model to ask before acting", "Enforce checks server-side, with a dry-run mode as a backstop"],
      choice: "Enforce checks server-side, with a dry-run mode as a backstop",
      rationale: "A rule in the prompt is a suggestion; a check on the server holds even when the model gets it wrong.",
      status: "accepted",
    },
  ],
  simulation: {
    prompt: "Why is this container restarting?",
    steps: [
      { nodeId: "chat", title: "REQUEST", detail: "Question asked in chat", durationMs: 700 },
      { nodeId: "agent", title: "PLAN", detail: "Needs logs, events and stats", durationMs: 800 },
      { nodeId: "tools", title: "LOGS", detail: "Reads the container's recent logs", durationMs: 900 },
      { nodeId: "docker", title: "EVENTS", detail: "Reads restart events and resource stats", durationMs: 900 },
      { nodeId: "llm", title: "REASON", detail: "Matches the evidence to a likely cause", durationMs: 1000 },
      { nodeId: "agent", title: "ANSWER", detail: "Cause explained with the log lines and events behind it", durationMs: 900 },
      { nodeId: "chat", title: "RESPONSE", detail: "Answer shown, with a fix offered as a dry run", durationMs: 700 },
    ],
  },
  placeholder: false,
} satisfies System;
