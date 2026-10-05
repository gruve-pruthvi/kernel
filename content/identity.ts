// PLACEHOLDER — replace every value with your real details.
import type { Identity } from "@/core/schema";

export const identity = {
  name: "Your Name",
  role: "Software Engineer · AI Systems",
  tagline: "I build systems that reason, retrieve, orchestrate and act.",
  summary:
    "Sample summary — replace in content/identity.ts. An engineer focused on agentic AI, retrieval systems and the cloud platforms that run them, who cares about evidence over claims.",
  location: "City, Country",
  availability: "Open to new opportunities",
  links: {
    email: "you@example.com",
    github: "https://github.com/your-handle",
    linkedin: "https://www.linkedin.com/in/your-handle",
    resume: "/resume.pdf",
  },
  principles: [
    {
      title: "Evidence over claims",
      body: "Show the architecture, the trade-offs and the numbers. A diagram you can inspect beats a paragraph of adjectives.",
    },
    {
      title: "Function before spectacle",
      body: "Interaction should carry information. If an animation doesn't explain something, it goes.",
    },
    {
      title: "Complexity must be earned",
      body: "Start with the simplest system that could work, measure it, and add moving parts only when the data demands it.",
    },
    {
      title: "Make failure boring",
      body: "Fallbacks, retries and clear errors are features. The best incident is the one users never notice.",
    },
  ],
  human: {
    about:
      "Sample text — replace in content/identity.ts. Outside of work I like taking systems apart to see how they think, reading about distributed systems, and long walks without a phone.",
    interests: ["Distributed systems", "Developer tooling", "Photography", "Chess", "Hiking"],
  },
  placeholder: true,
} satisfies Identity;
