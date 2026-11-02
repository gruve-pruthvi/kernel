import type { Capability } from "@/core/schema";

export const capabilities = [
  {
    id: "agents",
    name: "Agentic AI & Multi-Agent Systems",
    description: "LangGraph agent loops that use tools through MCP, check their own results and correct themselves before answering.",
    technologies: ["langgraph", "langchain", "pydantic-ai", "mcp", "llm-apis", "browser-use"],
  },
  {
    id: "rag",
    name: "Retrieval-Augmented Generation",
    description: "Grounding answers in documents: extraction and layout parsing, vectorisation, retrieval from Weaviate and streaming chat on top.",
    technologies: ["langchain", "weaviate", "pymupdf", "layout-parser", "bertopic", "vercel-ai-sdk"],
  },
  {
    id: "llm-serving",
    name: "LLM Inference & Serving",
    description: "Serving LLMs in production with vLLM and TensorRT-LLM and benchmarking end-to-end latency under varying load.",
    technologies: ["vllm", "tensorrt-llm", "kubernetes", "docker"],
  },
  {
    id: "platform",
    name: "Cloud & Kubernetes Platforms",
    description: "Running workloads on Kubernetes and managed cloud, right-sizing pods and autoscaling so compute isn't left idle.",
    technologies: ["kubernetes", "docker", "azure", "azure-functions", "azure-fabric", "aws", "aws-amplify", "gcp"],
  },
  {
    id: "apis",
    name: "Backend Services & APIs",
    description: "Putting AI behind secure, authenticated endpoints with careful secrets handling.",
    technologies: ["fastapi", "nodejs", "python", "typescript", "javascript", "go", "cpp", "postgres", "redis", "firebase"],
  },
  {
    id: "product-ui",
    name: "AI Product Interfaces",
    description: "Real-time chat and dashboard interfaces that make AI systems usable by non-technical people.",
    technologies: ["nextjs", "react", "typescript", "vercel-ai-sdk"],
  },
] satisfies Capability[];
