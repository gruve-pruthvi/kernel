// PLACEHOLDER — sample system.
import type { System } from "@/core/schema";

export const beacon = {
  id: "beacon",
  slug: "beacon",
  number: 3,
  name: "Beacon",
  tagline: "An ops copilot that explains incidents from live telemetry.",
  featured: true,
  category: "Cloud · AI",
  period: "2024",
  status: "prototype",
  summary:
    "Beacon answers 'why is this slow?' in chat by querying metrics, logs and infrastructure-as-code, then explaining the likely cause with links to evidence.",
  problem:
    "On-call engineers jumped between five dashboards to correlate an alert with a deploy or config change.",
  role: "Engineer — agent design and cloud integration",
  responsibilities: [
    "Built read-only telemetry tools with strict scopes",
    "Correlated alerts with deploys and Terraform changes",
  ],
  technologies: ["azure", "kubernetes", "terraform", "python", "fastapi", "llm-apis", "kafka"],
  capabilities: ["platform", "agents", "data-pipelines"],
  architecture: {
    nodes: [
      { id: "chat", label: "Slack / Teams", kind: "client", x: 4, y: 50, description: "Engineers ask questions where they already work." },
      { id: "api", label: "Copilot API", kind: "service", x: 24, y: 50, description: "Session handling and permission checks.", tech: ["fastapi"] },
      { id: "agent", label: "Ops Agent", kind: "agent", x: 46, y: 50, description: "Plans which telemetry to query and builds the explanation." },
      { id: "metrics", label: "Metrics & Logs", kind: "external", x: 70, y: 12, description: "Read-only queries against monitoring.", tech: ["azure"] },
      { id: "iac", label: "IaC Repository", kind: "store", x: 70, y: 50, description: "Terraform state and recent changes.", tech: ["terraform"] },
      { id: "events", label: "Event Stream", kind: "queue", x: 70, y: 88, description: "Alerts and deploy events.", tech: ["kafka"] },
      { id: "model", label: "LLM", kind: "model", x: 94, y: 50, description: "Turns evidence into a concise explanation.", tech: ["llm-apis"] },
    ],
    edges: [
      { from: "chat", to: "api" },
      { from: "api", to: "agent" },
      { from: "agent", to: "metrics", label: "query" },
      { from: "agent", to: "iac", label: "diff" },
      { from: "events", to: "agent", label: "alerts" },
      { from: "agent", to: "model", label: "explain" },
    ],
  },
  decisions: [
    {
      title: "Read-only tools by design",
      context: "An AI with write access to production is a risk nobody would approve.",
      options: ["Allow remediation actions", "Read-only with suggested commands"],
      choice: "Read-only with suggested commands",
      rationale: "Fast adoption with zero blast radius; humans run the fix.",
      status: "accepted",
    },
  ],
  impact: [{ label: "time to first hypothesis", value: "-60%", note: "sample metric" }],
  simulation: {
    prompt: "Why did checkout latency spike at 14:05?",
    steps: [
      { nodeId: "chat", title: "ASK", detail: "Question from on-call engineer", durationMs: 600 },
      { nodeId: "api", title: "SESSION", detail: "Scopes: read-only · prod", durationMs: 500 },
      { nodeId: "events", title: "ALERTS", detail: "p95 latency alert at 14:04 · deploy at 14:01", durationMs: 800 },
      { nodeId: "agent", title: "PLAN", detail: "Correlate deploy with latency and error rate", durationMs: 800 },
      { nodeId: "metrics", title: "QUERY", detail: "p95 820ms (+310%) · DB connections saturated", durationMs: 900 },
      { nodeId: "iac", title: "DIFF", detail: "Connection pool reduced 50 → 10 in last change", durationMs: 900 },
      { nodeId: "model", title: "EXPLAIN", detail: "Likely cause: pool size change in deploy #418", durationMs: 1000 },
      { nodeId: "chat", title: "ANSWER", detail: "Explanation + evidence links posted", durationMs: 600 },
    ],
  },
  placeholder: true,
} satisfies System;
