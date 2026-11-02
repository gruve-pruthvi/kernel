import type { System } from "@/core/schema";

export const meetingCopilot = {
  id: "meeting-copilot",
  slug: "meeting-copilot",
  number: 7,
  name: "Meeting Copilot",
  tagline: "An invisible AI sidekick for Teams, Zoom and Meet calls that never sends your audio anywhere.",
  featured: false,
  category: "AI · Productivity",
  period: "2025",
  status: "prototype",
  summary:
    "Meeting Copilot transcribes calls locally, spots questions as they're asked, and suggests answers from your own documents in an overlay that stays out of screen shares. When the call ends it captures the action items and writes the summary. Audio and transcripts never leave your machine.",
  problem: "In live calls you get asked things you have to look up, and most meeting assistants send your audio and transcripts to the cloud.",
  context: "Personal project.",
  role: "Solo builder",
  responsibilities: [
    "Built local, on-device transcription for Teams, Zoom and Meet calls",
    "Detected questions in the live transcript and suggested answers from the user's documents",
    "Built an overlay that stays out of screen shares",
    "Generated action items and a summary when the call ends",
  ],
  technologies: [],
  capabilities: ["rag", "product-ui"],
  architecture: {
    nodes: [
      { id: "audio", label: "Call Audio", kind: "client", x: 4, y: 50, description: "Audio from a Teams, Zoom or Meet call." },
      { id: "stt", label: "Local Transcription", kind: "model", x: 26, y: 50, description: "Transcribes on the machine; nothing is uploaded." },
      { id: "spotter", label: "Question Spotter", kind: "agent", x: 50, y: 18, description: "Notices questions as they're asked." },
      { id: "docs", label: "Your Documents", kind: "store", x: 76, y: 18, description: "The user's own documents, searched for answers." },
      { id: "overlay", label: "Overlay", kind: "client", x: 94, y: 50, description: "Suggested answers in an overlay that stays out of screen shares." },
      { id: "notes", label: "Summary & Actions", kind: "service", x: 50, y: 84, description: "Action items and a written summary when the call ends." },
    ],
    edges: [
      { from: "audio", to: "stt" },
      { from: "stt", to: "spotter", label: "transcript" },
      { from: "spotter", to: "docs", label: "search" },
      { from: "docs", to: "overlay", label: "suggest" },
      { from: "stt", to: "notes", label: "call ends" },
    ],
  },
  decisions: [
    {
      title: "Process everything on the machine",
      context: "Calls contain sensitive conversations, and users are rightly wary of tools that record them.",
      options: ["Send audio to a cloud transcription service", "Transcribe and process locally"],
      choice: "Transcribe and process locally",
      rationale: "If audio and transcripts never leave the machine, there's nothing to leak and no recording to explain.",
      status: "accepted",
    },
  ],
  placeholder: false,
} satisfies System;
