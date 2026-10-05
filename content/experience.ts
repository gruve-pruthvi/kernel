// PLACEHOLDER — each role is a "branch"; achievements are "commits".
import type { Experience } from "@/core/schema";

export const experience = [
  {
    id: "example-labs",
    organisation: "Example Labs",
    role: "Software Engineer — AI Systems",
    start: "2024-06",
    summary: "Sample role — building retrieval and agent systems used by internal teams.",
    branch: "feat/ai-systems",
    commits: [
      {
        hash: "7f3b2d1",
        message: "feat: introduce multi-agent orchestration with Relay",
        date: "2025-09",
        body: "Planner/executor agents with MCP tools and checkpointed state.",
        systems: ["relay"],
      },
      {
        hash: "c4e8a90",
        message: "perf: cut retrieval latency with hybrid search + answer cache",
        date: "2025-05",
        systems: ["atlas"],
      },
      {
        hash: "a1c9e42",
        message: "feat: ship Atlas document intelligence to production",
        date: "2025-03",
        body: "Hybrid retrieval, graph-based orchestration and citation checks.",
        systems: ["atlas"],
      },
    ],
  },
  {
    id: "sample-cloud",
    organisation: "Sample Cloud Co.",
    role: "Software Engineer",
    start: "2022-07",
    end: "2024-05",
    summary: "Sample role — platform and data engineering for a cloud product.",
    branch: "feat/cloud-platform",
    commits: [
      {
        hash: "3d2f6b8",
        message: "feat: prototype Beacon, an ops copilot over telemetry",
        date: "2024-02",
        systems: ["beacon"],
      },
      {
        hash: "9a0e1c7",
        message: "feat: build event pipeline processing 2M events/day",
        date: "2023-06",
        systems: ["ledger"],
      },
      {
        hash: "5b7c3e2",
        message: "chore: migrate services to Kubernetes",
        date: "2022-11",
      },
    ],
  },
  {
    id: "example-university",
    organisation: "Example University",
    role: "B.Tech, Computer Science",
    start: "2018-08",
    end: "2022-05",
    summary: "Sample education entry.",
    branch: "main",
    commits: [
      {
        hash: "0d4c8f1",
        message: "feat: final-year project on semantic search",
        date: "2022-03",
      },
      {
        hash: "e1f2a3b",
        message: "init: first commit",
        date: "2018-08",
        body: "Started with C, data structures and too much coffee.",
      },
    ],
  },
] satisfies Experience[];
