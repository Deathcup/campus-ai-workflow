import { z } from "zod";

export const AgentKindSchema = z.enum(["claude", "codeagent"]);
export type AgentKind = z.infer<typeof AgentKindSchema>;

export const KnowledgeBaseSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(""),
  version: z.string().min(1).max(40),
  instructions: z.string().min(1),
  supportingFiles: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Skill = z.infer<typeof SkillSchema>;

export const UpsertSkillInputSchema = SkillSchema.pick({
  name: true,
  description: true,
  version: true,
  instructions: true,
  supportingFiles: true,
  enabled: true
});
export type UpsertSkillInput = z.infer<typeof UpsertSkillInputSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
  attemptId: z.string().optional()
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const SessionStatusSchema = z.enum([
  "ready",
  "running",
  "succeeded",
  "failed",
  "canceled",
  "interrupted"
]);
export const ChatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  moduleId: z.string(),
  agent: AgentKindSchema,
  model: z.string().max(120).optional(),
  knowledgeBaseIds: z.array(z.string()).min(1),
  status: SessionStatusSchema,
  agentSessionId: z.string().optional(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const CreateSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  moduleId: z.string().default("knowledge-qa"),
  knowledgeBaseIds: z.array(z.string()).min(1).max(20)
});
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

export const ApplicationRuntimeSettingsSchema = z.object({
  moduleId: z.string(),
  agent: AgentKindSchema,
  model: z.string().trim().min(1).max(120).optional(),
  updatedAt: z.string()
});
export type ApplicationRuntimeSettings = z.infer<typeof ApplicationRuntimeSettingsSchema>;

export const UpdateApplicationRuntimeSettingsSchema = ApplicationRuntimeSettingsSchema.pick({
  agent: true,
  model: true
});
export type UpdateApplicationRuntimeSettings = z.infer<typeof UpdateApplicationRuntimeSettingsSchema>;

export const SendMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(50_000)
});

export const TaskKindSchema = z.enum(["security-scan", "code-review"]);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskStatusSchema = z.enum([
  "queued",
  "preparing",
  "running",
  "waiting_user",
  "confirmed",
  "rejected",
  "failed",
  "canceled",
  "interrupted"
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const SecurityScanTaskInputSchema = z.object({
  kind: z.literal("security-scan"),
  repositoryUrl: z.string().trim().min(1).max(2_000),
  branch: z.string().trim().min(1).max(240)
});
export const CodeReviewTaskInputSchema = z.object({
  kind: z.literal("code-review"),
  mergeRequestUrl: z.url().max(2_000)
});
export const CreateAgentTaskInputSchema = z.discriminatedUnion("kind", [
  SecurityScanTaskInputSchema,
  CodeReviewTaskInputSchema
]);
export type CreateAgentTaskInput = z.infer<typeof CreateAgentTaskInputSchema>;

export const TaskBaselineSchema = z.object({
  repositoryUrl: z.string(),
  requestedRef: z.string(),
  commitSha: z.string(),
  baseSha: z.string().optional(),
  changeUrl: z.string().optional()
});
export type TaskBaseline = z.infer<typeof TaskBaselineSchema>;

export const TaskFindingSchema = z.object({
  id: z.string().min(1).max(160),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  category: z.string().max(120).optional(),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(20_000),
  file: z.string().max(2_000).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  evidence: z.string().max(20_000).optional(),
  recommendation: z.string().max(20_000).optional()
});
export type TaskFinding = z.infer<typeof TaskFindingSchema>;

export const TaskArtifactSchema = z.object({
  path: z.string(),
  name: z.string(),
  mediaType: z.string(),
  size: z.number().int().nonnegative()
});
export type TaskArtifact = z.infer<typeof TaskArtifactSchema>;

export const AgentTaskResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  taskKind: TaskKindSchema,
  summary: z.string().min(1).max(20_000),
  verdict: z.enum(["pass", "attention", "required_changes"]),
  findings: z.array(TaskFindingSchema).max(2_000).default([]),
  metrics: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
});
export type AgentTaskResult = z.infer<typeof AgentTaskResultSchema>;

export const TaskDecisionSchema = z.object({
  action: z.enum(["confirm", "reject"]),
  note: z.string().trim().max(5_000).default(""),
  decidedAt: z.string()
});
export type TaskDecision = z.infer<typeof TaskDecisionSchema>;

export const DecideTaskInputSchema = TaskDecisionSchema.omit({ decidedAt: true });
export type DecideTaskInput = z.infer<typeof DecideTaskInputSchema>;

export const AgentTaskSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  kind: TaskKindSchema,
  title: z.string(),
  input: CreateAgentTaskInputSchema,
  agent: AgentKindSchema,
  model: z.string().max(120).optional(),
  status: TaskStatusSchema,
  progress: z.string().optional(),
  attemptId: z.string().optional(),
  agentSessionId: z.string().optional(),
  baseline: TaskBaselineSchema.optional(),
  result: AgentTaskResultSchema.optional(),
  reportMarkdown: z.string().optional(),
  artifacts: z.array(TaskArtifactSchema).default([]),
  decision: TaskDecisionSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional()
});
export type AgentTask = z.infer<typeof AgentTaskSchema>;

export const RuntimeEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  attemptId: z.string(),
  type: z.enum(["status", "text_delta", "tool", "result", "error"]),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});
export type RuntimeEvent = z.infer<typeof RuntimeEventSchema>;

export const ModuleManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().default("sparkles"),
  enabled: z.boolean().default(true),
  capabilityVersion: z.string(),
  experience: z.enum(["conversation", "task"]).default("task"),
  taskKind: TaskKindSchema.optional(),
  systemPromptFile: z.string(),
  skillDirectory: z.string(),
  constraints: z.array(z.string()).default([]),
  runtime: z
    .object({
      allowedTools: z.array(z.string()).default(["Read", "Glob", "Grep", "WebFetch", "WebSearch"]),
      mcpConfigFile: z.string().optional()
    })
    .default({ allowedTools: ["Read", "Glob", "Grep", "WebFetch", "WebSearch"] })
});
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

export type AgentDescriptor = {
  id: AgentKind;
  name: string;
  command: string;
  available: boolean;
  protocol: "claude-cli-stream-json";
  models: Array<{ id: string; name: string }>;
};
