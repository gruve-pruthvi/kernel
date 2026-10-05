// PLACEHOLDER — sample system.
import type { System } from "@/core/schema";

export const ledger = {
  id: "ledger",
  slug: "ledger",
  number: 4,
  name: "Ledger",
  tagline: "Event pipeline with replay and dead-lettering.",
  featured: false,
  category: "Data",
  period: "2023",
  status: "production",
  summary: "Ledger ingests product events, enriches them and lands them in Postgres for reporting, with safe replay.",
  problem: "Batch exports were a day late and silently dropped malformed events.",
  role: "Engineer — pipeline design and operations",
  responsibilities: ["Designed topic layout and consumer groups", "Added dead-letter handling and replay tooling"],
  technologies: ["kafka", "postgres", "python", "docker", "aws"],
  capabilities: ["data-pipelines", "platform"],
  architecture: {
    nodes: [
      { id: "services", label: "Services", kind: "client", x: 4, y: 40, description: "Product services emitting events." },
      { id: "stream", label: "Kafka", kind: "queue", x: 28, y: 40, description: "Partitioned topics per domain.", tech: ["kafka"] },
      { id: "processor", label: "Stream Processor", kind: "service", x: 52, y: 40, description: "Validates, enriches and batches writes.", tech: ["python"] },
      { id: "warehouse", label: "Postgres", kind: "store", x: 76, y: 20, description: "Reporting tables.", tech: ["postgres"] },
      { id: "dlq", label: "Dead-letter Queue", kind: "queue", x: 76, y: 80, description: "Malformed events kept for inspection and replay." },
      { id: "dash", label: "Dashboards", kind: "client", x: 96, y: 20, description: "Near-real-time reporting." },
    ],
    edges: [
      { from: "services", to: "stream" },
      { from: "stream", to: "processor" },
      { from: "processor", to: "warehouse", label: "batch write" },
      { from: "processor", to: "dlq", label: "invalid" },
      { from: "warehouse", to: "dash" },
    ],
  },
  decisions: [
    {
      title: "Dead-letter instead of drop",
      context: "Malformed events were being discarded without trace.",
      options: ["Drop and log", "Dead-letter queue with replay"],
      choice: "Dead-letter queue with replay",
      rationale: "Nothing is lost; fixes can be replayed once the producer is corrected.",
      status: "accepted",
    },
  ],
  impact: [{ label: "events/day", value: "2M", note: "sample metric" }],
  placeholder: true,
} satisfies System;
