// PLACEHOLDER — edit to match your real stack.
import type { Technology } from "@/core/schema";

export const technologies = [
  { id: "python", name: "Python", category: "language" },
  { id: "typescript", name: "TypeScript", category: "language" },
  { id: "langgraph", name: "LangGraph", category: "ai" },
  { id: "langchain", name: "LangChain", category: "ai" },
  { id: "llm-apis", name: "LLM APIs", category: "ai" },
  { id: "mcp", name: "MCP", category: "ai" },
  { id: "fastapi", name: "FastAPI", category: "backend" },
  { id: "nextjs", name: "Next.js", category: "frontend" },
  { id: "react", name: "React", category: "frontend" },
  { id: "postgres", name: "PostgreSQL", category: "data" },
  { id: "weaviate", name: "Weaviate", category: "data" },
  { id: "redis", name: "Redis", category: "data" },
  { id: "kafka", name: "Kafka", category: "data" },
  { id: "docker", name: "Docker", category: "devops" },
  { id: "kubernetes", name: "Kubernetes", category: "devops" },
  { id: "terraform", name: "Terraform", category: "devops" },
  { id: "azure", name: "Azure", category: "cloud" },
  { id: "aws", name: "AWS", category: "cloud" },
] satisfies Technology[];
