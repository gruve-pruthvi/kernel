// PLACEHOLDER — capabilities group technologies into things you can do.
import type { Capability } from "@/core/schema";

export const capabilities = [
  {
    id: "rag",
    name: "Retrieval-Augmented Generation",
    description: "Grounding model answers in private data with hybrid retrieval, re-ranking and citation checks.",
    technologies: ["langchain", "weaviate", "postgres", "llm-apis"],
  },
  {
    id: "agents",
    name: "Agent Orchestration",
    description: "Designing multi-step, tool-using agents with explicit state, checkpoints and human hand-offs.",
    technologies: ["langgraph", "mcp", "llm-apis"],
  },
  {
    id: "platform",
    name: "Cloud Platform Engineering",
    description: "Shipping and operating services on managed cloud with infrastructure as code.",
    technologies: ["azure", "aws", "kubernetes", "terraform", "docker"],
  },
  {
    id: "data-pipelines",
    name: "Data Pipelines",
    description: "Event-driven ingestion and processing with replay, dead-lettering and observability.",
    technologies: ["kafka", "postgres", "python"],
  },
  {
    id: "apis",
    name: "API Design",
    description: "Typed, versioned APIs with streaming responses and sensible failure modes.",
    technologies: ["fastapi", "typescript", "postgres"],
  },
  {
    id: "product-ui",
    name: "Product Interfaces",
    description: "Fast, accessible interfaces that make complex systems understandable.",
    technologies: ["nextjs", "react", "typescript"],
  },
] satisfies Capability[];
