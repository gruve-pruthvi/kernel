import type { System } from "@/core/schema";

export const fathom = {
  id: "fathom",
  slug: "fathom",
  number: 5,
  name: "Fathom",
  tagline: "Plain-English questions over a Microsoft Fabric data lake, behind security guardrails.",
  featured: false,
  category: "AI · Data access",
  period: "2025 — 2026",
  status: "production",
  summary:
    "Fathom lets non-technical users query a Microsoft Fabric data lake in plain English. A secure tool pipeline built on AWS Amplify and Azure Functions runs the database queries for them, with several security guardrails plus careful authentication and secrets handling.",
  problem: "Non-technical users couldn't query the data lake themselves; every question needed someone who could write the query.",
  context: "Client project at Gruve.",
  role: "Architect and developer",
  responsibilities: [
    "Architected the secure tool pipeline on AWS Amplify and Azure Functions",
    "Implemented multiple security guardrails, plus authentication and secrets handling",
    "Automated database queries so non-technical users can ask in plain English",
    "Reduced latency through an optimised architecture",
  ],
  technologies: ["aws-amplify", "aws", "azure-functions", "azure", "azure-fabric", "llm-apis"],
  capabilities: ["agents", "platform", "apis"],
  architecture: {
    nodes: [
      { id: "user", label: "Business User", kind: "client", x: 4, y: 50, description: "Asks questions about the data in plain English." },
      { id: "app", label: "App", kind: "service", x: 26, y: 50, description: "Front end hosted on AWS Amplify, with authentication.", tech: ["aws-amplify"] },
      { id: "guard", label: "Guardrails", kind: "agent", x: 50, y: 18, description: "Security checks on what can be asked and what runs." },
      { id: "llm", label: "LLM", kind: "model", x: 76, y: 18, description: "Turns the question into a tool call.", tech: ["llm-apis"] },
      { id: "tools", label: "Tool Functions", kind: "service", x: 60, y: 82, description: "Azure Functions that run the queries, with secrets kept out of the client.", tech: ["azure-functions"] },
      { id: "lake", label: "Data Lake", kind: "store", x: 94, y: 82, description: "Microsoft Fabric data lake.", tech: ["azure-fabric"] },
    ],
    edges: [
      { from: "user", to: "app" },
      { from: "app", to: "guard", label: "check" },
      { from: "guard", to: "llm", label: "allowed" },
      { from: "llm", to: "tools", label: "tool call" },
      { from: "tools", to: "lake", label: "query" },
    ],
  },
  decisions: [],
  placeholder: false,
} satisfies System;
