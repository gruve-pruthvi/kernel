import type { System } from "@/core/schema";

export const meetingCopilot = {
  id: "meeting-copilot",
  slug: "meeting-copilot",
  number: 7,
  name: "Meeting Copilot",
  tagline: "An invisible AI sidekick for Teams, Zoom and Meet calls, with transcription that never leaves your machine.",
  featured: false,
  category: "AI · Productivity",
  period: "2025",
  status: "production",
  summary:
    "Meeting Copilot is a native desktop app that transcribes calls locally with whisper.cpp, spots questions as they're asked, and suggests answers from your own documents in an overlay that stays out of screen shares. When the call ends it captures the action items and writes the summary. Audio never leaves your machine; only text goes to the OpenAI API, using your own key.",
  problem: "In live calls you get asked things you have to look up, and most meeting assistants upload your audio to the cloud.",
  context: "Personal project. Local-first: a Rust/Tauri desktop app with a Python sidecar on 127.0.0.1.",
  role: "Solo builder",
  responsibilities: [
    "Built the Tauri desktop shell as a Rust Cargo workspace: audio-capture, whisper-engine and ipc-schema crates",
    "Captured mic plus system audio (cpal, ScreenCaptureKit on macOS, WASAPI on Windows) as 16 kHz mono",
    "Ran whisper.cpp locally through whisper-rs, with voice-activity detection and a ring buffer",
    "Built the Python FastAPI sidecar: classify, retrieve, suggest, action items and summary over a typed event bus",
    "Kept Rust and Python in step with one shared IPC schema that both sides are tested against",
  ],
  technologies: ["rust", "tauri", "whisper-cpp", "react", "vite", "typescript", "python", "fastapi", "uv", "sqlite", "lancedb", "llm-apis"],
  capabilities: ["rag", "product-ui", "apis"],
  architecture: {
    nodes: [
      { id: "audio", label: "Audio Capture", kind: "client", x: 4, y: 50, description: "Mic via cpal plus system loopback via ScreenCaptureKit (macOS) or WASAPI (Windows), as 16 kHz mono.", tech: ["rust"] },
      { id: "whisper", label: "Whisper Engine", kind: "model", x: 26, y: 50, description: "whisper.cpp via whisper-rs, ggml-small.en, with VAD and a ring buffer. Fully local.", tech: ["whisper-cpp", "rust"] },
      { id: "shell", label: "Tauri Shell", kind: "service", x: 48, y: 16, description: "Rust desktop shell; talks to the sidecar through a shared, tested IPC schema.", tech: ["tauri", "rust"] },
      { id: "overlay", label: "Overlay", kind: "client", x: 78, y: 6, description: "Vite + React overlay that stays out of screen shares.", tech: ["vite", "react"] },
      { id: "sidecar", label: "Python Sidecar", kind: "service", x: 52, y: 62, description: "FastAPI on 127.0.0.1 (/ws, /health): classify → retrieve → suggest → action items → summary, over a typed event bus.", tech: ["fastapi", "python"] },
      { id: "store", label: "SQLite + LanceDB", kind: "store", x: 92, y: 44, description: "Local storage and vector search over your documents.", tech: ["sqlite", "lancedb"] },
      { id: "llm", label: "OpenAI API", kind: "model", x: 84, y: 92, description: "Reasoning and embeddings, using your own key. Receives text only, never audio.", tech: ["llm-apis"] },
    ],
    edges: [
      { from: "audio", to: "whisper" },
      { from: "whisper", to: "shell", label: "transcript" },
      { from: "shell", to: "overlay", label: "suggestions" },
      { from: "shell", to: "sidecar", label: "IPC · /ws" },
      { from: "sidecar", to: "store", label: "retrieve" },
      { from: "sidecar", to: "llm", label: "text" },
    ],
  },
  decisions: [
    {
      title: "Keep audio on the machine",
      context: "Calls contain sensitive conversations, and users are rightly wary of tools that record them.",
      options: ["Send audio to a cloud transcription service", "Transcribe locally with whisper.cpp and send only text onward"],
      choice: "Transcribe locally with whisper.cpp and send only text onward",
      rationale: "Audio is the most sensitive and the heaviest data; transcribing locally means it never leaves the laptop, and the LLM only sees the text it needs.",
      status: "accepted",
    },
  ],
  placeholder: false,
} satisfies System;
