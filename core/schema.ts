import { z } from "zod";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase kebab-case");
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");

export const TECH_CATEGORIES = ["ai", "backend", "frontend", "cloud", "data", "devops", "language"] as const;
export const NODE_KINDS = ["client", "service", "agent", "model", "store", "queue", "external"] as const;

export const technologySchema = z.object({
  id,
  name: z.string().min(1),
  category: z.enum(TECH_CATEGORIES),
});

export const capabilitySchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string().min(1),
  technologies: z.array(id),
});

export const architectureNodeSchema = z.object({
  id,
  label: z.string().min(1),
  kind: z.enum(NODE_KINDS),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  description: z.string().min(1),
  tech: z.array(id).optional(),
});

export const architectureEdgeSchema = z.object({
  from: id,
  to: id,
  label: z.string().optional(),
});

export const decisionSchema = z.object({
  title: z.string().min(1),
  context: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
  choice: z.string().min(1),
  rationale: z.string().min(1),
  status: z.enum(["accepted", "revisited"]),
});

export const simulationSchema = z.object({
  prompt: z.string().min(1),
  steps: z
    .array(
      z.object({
        nodeId: id,
        title: z.string().min(1),
        detail: z.string().min(1),
        durationMs: z.number().int().positive().max(10000),
      }),
    )
    .min(1),
});

export const systemSchema = z.object({
  id,
  slug: id,
  number: z.number().int().positive(),
  name: z.string().min(1),
  tagline: z.string().min(1),
  featured: z.boolean(),
  category: z.string().min(1),
  period: z.string().optional(),
  status: z.enum(["production", "prototype", "archived"]),
  summary: z.string().min(1),
  problem: z.string().min(1),
  context: z.string().optional(),
  role: z.string().min(1),
  responsibilities: z.array(z.string().min(1)),
  technologies: z.array(id),
  capabilities: z.array(id),
  architecture: z.object({
    nodes: z.array(architectureNodeSchema).min(1),
    edges: z.array(architectureEdgeSchema),
  }),
  decisions: z.array(decisionSchema),
  challenges: z.array(z.string().min(1)).optional(),
  tradeOffs: z.array(z.object({ gained: z.string().min(1), cost: z.string().min(1) })).optional(),
  impact: z
    .array(z.object({ label: z.string().min(1), value: z.string().min(1), note: z.string().optional() }))
    .optional(),
  simulation: simulationSchema.optional(),
  benchmarks: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().optional(),
        context: z.string().optional(),
        measuredAt: yearMonth.optional(),
        source: z.string().optional(),
      }),
    )
    .optional(),
  links: z
    .object({ repo: z.string().optional(), demo: z.string().optional(), writeup: z.string().optional() })
    .optional(),
  placeholder: z.boolean(),
});

export const commitSchema = z.object({
  hash: z.string().regex(/^[0-9a-f]{7}$/, "use a 7-char lowercase hex hash"),
  message: z.string().min(1),
  date: yearMonth,
  body: z.string().optional(),
  systems: z.array(id).optional(), // system slugs
});

export const experienceSchema = z.object({
  id,
  organisation: z.string().min(1),
  role: z.string().min(1),
  start: yearMonth,
  end: yearMonth.optional(),
  summary: z.string().min(1),
  branch: z.string().min(1),
  commits: z.array(commitSchema),
});

export const identitySchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  tagline: z.string().min(1),
  summary: z.string().min(1),
  location: z.string().optional(),
  availability: z.string().optional(),
  links: z.object({
    email: z.string().min(3),
    github: z.string().optional(),
    linkedin: z.string().optional(),
    resume: z.string().optional(),
  }),
  principles: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })),
  human: z.object({ about: z.string().min(1), interests: z.array(z.string().min(1)) }),
  placeholder: z.boolean(),
});

export const portfolioSchema = z.object({
  identity: identitySchema,
  technologies: z.array(technologySchema),
  capabilities: z.array(capabilitySchema),
  systems: z.array(systemSchema),
  experience: z.array(experienceSchema),
});

export type TechCategory = (typeof TECH_CATEGORIES)[number];
export type NodeKind = (typeof NODE_KINDS)[number];
export type Technology = z.infer<typeof technologySchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type ArchitectureNode = z.infer<typeof architectureNodeSchema>;
export type ArchitectureEdge = z.infer<typeof architectureEdgeSchema>;
export type Architecture = z.infer<typeof systemSchema>["architecture"];
export type Decision = z.infer<typeof decisionSchema>;
export type Simulation = z.infer<typeof simulationSchema>;
export type SimulationStep = Simulation["steps"][number];
export type System = z.infer<typeof systemSchema>;
export type Commit = z.infer<typeof commitSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
