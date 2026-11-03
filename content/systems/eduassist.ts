import type { System } from "@/core/schema";

export const eduassist = {
  id: "eduassist",
  slug: "eduassist",
  number: 6,
  name: "EduAssist",
  tagline: "Turns PDFs into structured learning modules automatically.",
  featured: false,
  category: "AI · Document processing",
  period: "Jul 2024 — Dec 2024",
  status: "production",
  summary:
    "EduAssist extracts content from PDFs with PyMuPDF and Layout Parser, vectorises it, and uses BERTopic topic modelling to generate structured learning modules for an educational platform.",
  problem: "Course material arrived as PDFs, and turning it into structured learning modules was manual work.",
  context: "Built at CloudRedux for an educational platform.",
  role: "Engineer",
  responsibilities: [
    "Engineered PDF extraction with PyMuPDF and Layout Parser",
    "Vectorised the extracted content",
    "Applied BERTopic for automated topic modelling",
    "Generated structured learning modules from the topics",
  ],
  technologies: ["python", "pymupdf", "layout-parser", "bertopic"],
  capabilities: ["rag"],
  architecture: {
    nodes: [
      { id: "pdf", label: "PDFs", kind: "client", x: 4, y: 50, description: "Course material uploaded as PDFs." },
      { id: "extract", label: "Extraction", kind: "service", x: 28, y: 50, description: "PyMuPDF and Layout Parser pull text and structure out of each page.", tech: ["pymupdf", "layout-parser"] },
      { id: "vectors", label: "Vectorisation", kind: "service", x: 52, y: 18, description: "Turns extracted content into vectors." },
      { id: "topics", label: "Topic Model", kind: "model", x: 52, y: 82, description: "BERTopic groups the content into topics.", tech: ["bertopic"] },
      { id: "modules", label: "Learning Modules", kind: "client", x: 90, y: 50, description: "Structured modules published to the education platform." },
    ],
    edges: [
      { from: "pdf", to: "extract" },
      { from: "extract", to: "vectors", label: "content" },
      { from: "vectors", to: "topics", label: "embeddings" },
      { from: "topics", to: "modules", label: "structure" },
    ],
  },
  decisions: [],
  placeholder: false,
} satisfies System;
