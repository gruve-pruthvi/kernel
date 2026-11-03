import type { Identity } from "@/core/schema";

export const identity = {
  name: "Pruthvi Parade",
  role: "Software Engineer · AI Infrastructure & Agentic AI",
  tagline: "I build agentic AI systems and the infrastructure that serves them.",
  summary:
    "Software engineer with 4+ years building AI applications, from multi-agent NL2SQL and enterprise RAG to serving LLMs in production. Currently an SDE II on AI infrastructure at AI Fabrik, deploying, benchmarking and right-sizing models on Kubernetes. Looking for my next role building AI infrastructure or agentic systems.",
  location: "Pune, India",
  availability: "Open to AI infrastructure & agentic AI roles",
  links: {
    email: "parade.pruthvi@gmail.com",
    github: "https://github.com/Pruthvi-Parade",
    linkedin: "https://www.linkedin.com/in/pruthvi-parade-2040b0248",
    resume: "/resume.pdf",
  },
  principles: [
    {
      title: "Agents should check their own work",
      body: "A generated query gets run, read and corrected before anyone sees it. Sequel's self-correcting loop is built on that idea.",
    },
    {
      title: "Measure before you tune",
      body: "Benchmark latency and utilisation under real load first, then right-size. Serving configs change on evidence, not guesses.",
    },
    {
      title: "Guardrails are part of the product",
      body: "Authentication, secrets handling and safety checks belong in the first design: Fathom's guardrails, Infra Copilot's approval gateway.",
    },
    {
      title: "Private data stays private",
      body: "If it can run on the user's machine, it should. Meeting Copilot transcribes on the laptop, so call audio never leaves it.",
    },
  ],
  human: {
    about:
      "Away from the keyboard I'm usually at a hackathon or on a basketball court. I've taken part in several hackathons and basketball tournaments, and hosted my college's cultural fest.",
    interests: ["Basketball", "Hackathons", "Hosting events", "Side projects"],
  },
  placeholder: false,
} satisfies Identity;
