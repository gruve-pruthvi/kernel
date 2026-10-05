// PLACEHOLDER — sample system. Replace with a real project or delete and unregister in ./index.ts.
import type { System } from "@/core/schema";

export const atlas = {
  id: "atlas",
  slug: "atlas",
  number: 1,
  name: "Atlas",
  tagline: "Document intelligence that answers with cited sources.",
  featured: true,
  category: "AI · Retrieval",
  period: "2024 — 2025",
  status: "production",
  summary:
    "Atlas lets analysts ask questions across tens of thousands of contracts and reports and get answers grounded in the exact passages they came from.",
  problem:
    "Analysts spent hours searching shared drives for clauses and figures. Keyword search missed paraphrases; a plain chatbot hallucinated.",
  context: "Sample context — internal tool for a legal and finance team, documents in PDF and scanned formats.",
  role: "Lead engineer — retrieval, orchestration and evaluation",
  responsibilities: [
    "Designed the hybrid retrieval pipeline and chunking strategy",
    "Built the LangGraph orchestration with routing and verification",
    "Set up evaluation datasets and citation checks",
  ],
  technologies: ["python", "langgraph", "langchain", "weaviate", "fastapi", "llm-apis", "azure", "redis"],
  capabilities: ["rag", "agents", "apis"],
  architecture: {
    nodes: [
      { id: "ui", label: "Analyst UI", kind: "client", x: 4, y: 50, description: "Web app where analysts ask questions and inspect cited passages." },
      { id: "api", label: "Query API", kind: "service", x: 24, y: 50, description: "FastAPI service: auth, streaming responses, request tracing.", tech: ["fastapi"] },
      { id: "cache", label: "Answer Cache", kind: "store", x: 24, y: 88, description: "Semantic cache of recent answers keyed by normalised question.", tech: ["redis"] },
      { id: "router", label: "Query Router", kind: "agent", x: 46, y: 50, description: "Classifies intent and picks a retrieval strategy.", tech: ["langgraph"] },
      { id: "retriever", label: "Hybrid Retriever", kind: "service", x: 68, y: 14, description: "BM25 + vector search fused with reciprocal rank fusion.", tech: ["langchain"] },
      { id: "vector", label: "Vector Store", kind: "store", x: 94, y: 14, description: "Embeddings and metadata for ~40k documents.", tech: ["weaviate"] },
      { id: "llm", label: "LLM", kind: "model", x: 68, y: 86, description: "Generates the answer from retrieved context only.", tech: ["llm-apis"] },
      { id: "verifier", label: "Citation Verifier", kind: "agent", x: 94, y: 86, description: "Checks every claim maps to a retrieved passage before responding." },
    ],
    edges: [
      { from: "ui", to: "api" },
      { from: "api", to: "cache", label: "lookup" },
      { from: "api", to: "router", label: "miss" },
      { from: "router", to: "retriever", label: "search" },
      { from: "retriever", to: "vector", label: "top-k" },
      { from: "router", to: "llm", label: "generate" },
      { from: "llm", to: "verifier", label: "verify" },
    ],
  },
  decisions: [
    {
      title: "Hybrid retrieval over pure vector search",
      context: "Contract questions often hinge on exact terms (clause numbers, party names) that embeddings blur.",
      options: ["Vector search only", "BM25 keyword search only", "Hybrid with reciprocal rank fusion"],
      choice: "Hybrid with reciprocal rank fusion",
      rationale: "Keyword recall for exact terms plus semantic recall for paraphrases; fusion needed no extra model.",
      status: "accepted",
    },
    {
      title: "Graph orchestration instead of a linear chain",
      context: "Different questions need different paths: lookups, comparisons, and 'not found' answers.",
      options: ["Single prompt chain", "Graph with explicit routing and verification"],
      choice: "Graph with explicit routing and verification",
      rationale: "Explicit nodes made behaviour testable and let us add a verification step without rewriting.",
      status: "accepted",
    },
  ],
  challenges: [
    "Scanned PDFs with inconsistent layouts broke naive chunking",
    "Keeping answers grounded when retrieval returned weak matches",
  ],
  tradeOffs: [
    { gained: "Grounded, auditable answers", cost: "~400ms extra latency for verification" },
    { gained: "Lower model spend via answer cache", cost: "Cache invalidation on document updates" },
  ],
  impact: [
    { label: "faster answers", value: "-72%", note: "sample metric" },
    { label: "documents indexed", value: "40k+", note: "sample metric" },
    { label: "grounded answers", value: "96%", note: "sample metric" },
  ],
  simulation: {
    prompt: "What are the termination clauses in the 2023 vendor contracts?",
    steps: [
      { nodeId: "ui", title: "REQUEST", detail: "Question received from analyst", durationMs: 700 },
      { nodeId: "api", title: "API", detail: "Authenticated · trace id k-4821", durationMs: 600 },
      { nodeId: "cache", title: "CACHE", detail: "Semantic cache lookup — miss", durationMs: 600 },
      { nodeId: "router", title: "ROUTER", detail: "Intent: clause_lookup · strategy: hybrid", durationMs: 800 },
      { nodeId: "retriever", title: "RETRIEVAL", detail: "BM25 + vector search across 2,413 chunks", durationMs: 1000 },
      { nodeId: "vector", title: "TOP-K", detail: "6 chunks · scores 0.94, 0.91, 0.88 …", durationMs: 800 },
      { nodeId: "llm", title: "GENERATE", detail: "Drafting answer from 6 cited passages", durationMs: 1100 },
      { nodeId: "verifier", title: "VERIFY", detail: "6/6 claims grounded — citations attached", durationMs: 800 },
      { nodeId: "ui", title: "RESPONSE", detail: "Answer streamed with sources", durationMs: 700 },
    ],
  },
  links: { repo: "https://github.com/your-handle/atlas" },
  placeholder: true,
} satisfies System;
