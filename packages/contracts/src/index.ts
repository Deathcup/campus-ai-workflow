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
