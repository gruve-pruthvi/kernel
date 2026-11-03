import type { System } from "@/core/schema";

export const operator = {
  id: "operator",
  slug: "operator",
  number: 8,
  name: "Agentic AI Operator",
  tagline: "A browser agent for web automation across Google, OpenAI and Anthropic models.",
  featured: false,
  category: "AI · Agents",
  period: "2025",
  status: "production",
  summary:
    "A browser agent system that extends the browser-use framework for AI-powered web automation, with support for Google, OpenAI and Anthropic models, a custom browser with persistent sessions, and HD screen recording.",
  problem: "Browser automation needed to work with any major model provider, keep sessions between runs, and record what the agent actually did.",
  context: "Personal project.",
  role: "Solo builder",
  responsibilities: [
    "Extended browser-use for AI-powered web automation",
    "Integrated Google, OpenAI and Anthropic as interchangeable providers",
    "Built custom browser support with persistent sessions",
    "Added HD screen recording of agent runs",
  ],
  technologies: ["python", "browser-use", "llm-apis"],
  capabilities: ["agents"],
  architecture: {
    nodes: [
      { id: "task", label: "Task", kind: "client", x: 4, y: 50, description: "What the agent should do on the web." },
      { id: "agent", label: "Browser Agent", kind: "agent", x: 30, y: 50, description: "browser-use agent that plans and acts on web pages.", tech: ["browser-use"] },
      { id: "models", label: "LLM Providers", kind: "model", x: 30, y: 12, description: "Google, OpenAI or Anthropic, chosen per run.", tech: ["llm-apis"] },
      { id: "browser", label: "Custom Browser", kind: "external", x: 64, y: 50, description: "The browser the agent drives." },
      { id: "session", label: "Sessions", kind: "store", x: 92, y: 22, description: "Persistent sessions, so logins survive between runs." },
      { id: "recorder", label: "Recorder", kind: "service", x: 92, y: 80, description: "HD screen recording of every run." },
    ],
    edges: [
      { from: "task", to: "agent", label: "goal" },
      { from: "agent", to: "models", label: "reason" },
      { from: "agent", to: "browser", label: "act" },
      { from: "browser", to: "session", label: "persist" },
      { from: "browser", to: "recorder", label: "record" },
    ],
  },
  decisions: [],
  placeholder: false,
} satisfies System;
