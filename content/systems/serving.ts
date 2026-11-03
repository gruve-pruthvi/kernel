import type { System } from "@/core/schema";

export const serving = {
  id: "serving",
  slug: "serving",
  number: 1,
  name: "LLM Serving Platform",
  tagline: "Production LLM serving on Kubernetes with vLLM and TensorRT-LLM.",
  featured: true,
  category: "AI Infra · Serving",
  period: "Apr 2026 — present",
  status: "production",
  summary:
    "AI Fabrik's client-facing inference platform: LLMs served in production on vLLM and TensorRT-LLM, containerised with Docker, orchestrated on Kubernetes and exposed through secure API endpoints, with several models running at once. Latency is benchmarked under load, and deployments and autoscaling are right-sized from utilisation data.",
  problem:
    "Clients need their models served reliably behind secure endpoints, several at a time, with predictable latency and without paying for GPUs that sit idle.",
  context: "AI Fabrik: client-facing inference platform.",
  role: "SDE II, AI Infra: deployment, serving, benchmarking and cost",
  responsibilities: [
    "Deployed and served LLMs in production with vLLM and TensorRT-LLM",
    "Containerised the models with Docker and orchestrated them on Kubernetes behind secure API endpoints",
    "Benchmarked end-to-end inference latency under varying load and found the bottlenecks",
    "Analysed GPU/CPU and pod-level utilisation, then right-sized deployments and autoscaling policies",
    "Own model lifecycle, uptime and availability for client-facing inference",
  ],
  technologies: ["vllm", "tensorrt-llm", "docker", "kubernetes"],
  capabilities: ["llm-serving", "platform"],
  architecture: {
    nodes: [
      { id: "client", label: "Client Apps", kind: "client", x: 4, y: 50, description: "Client applications sending inference requests." },
      { id: "api", label: "Secure API", kind: "service", x: 26, y: 50, description: "Authenticated endpoints that front every served model." },
      { id: "vllm", label: "vLLM", kind: "model", x: 50, y: 14, description: "Model servers running on vLLM.", tech: ["vllm"] },
      { id: "trt", label: "TensorRT-LLM", kind: "model", x: 50, y: 86, description: "Model servers running on TensorRT-LLM.", tech: ["tensorrt-llm"] },
      { id: "k8s", label: "Kubernetes", kind: "service", x: 50, y: 50, description: "Schedules the model pods; deployments and autoscaling policies right-sized from utilisation data.", tech: ["kubernetes", "docker"] },
      { id: "metrics", label: "Latency & Usage", kind: "service", x: 92, y: 50, description: "End-to-end latency benchmarks under load, plus GPU/CPU and pod-level utilisation." },
    ],
    edges: [
      { from: "client", to: "api" },
      { from: "api", to: "vllm", label: "route" },
      { from: "api", to: "trt", label: "route" },
      { from: "k8s", to: "vllm", label: "scale" },
      { from: "k8s", to: "trt", label: "scale" },
      { from: "vllm", to: "metrics", label: "measure" },
      { from: "trt", to: "metrics", label: "measure" },
    ],
  },
  decisions: [],
  impact: [
    { label: "faster responses", value: "15–25%", note: "end-to-end response time, after tuning serving configs" },
    { label: "less idle compute cost", value: "15–25%", note: "after right-sizing deployments and autoscaling" },
  ],
  benchmarks: [
    {
      metric: "p95 time to first token",
      value: "410 → 340",
      unit: "ms",
      context: "28 concurrent users, 8B model, 1× A100",
      measuredAt: "2026-07",
      source: "vLLM benchmark_serving",
    },
  ],
  placeholder: false,
} satisfies System;
