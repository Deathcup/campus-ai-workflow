import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "../../..");

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function modelList(value: string | undefined, fallback: string[]): Array<{ id: string; name: string }> {
  return (value ? value.split(",") : fallback)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
}

export const config = {
  projectRoot,
  host: process.env.HOST ?? "127.0.0.1",
  port: positiveNumber(process.env.PORT, 4100),
  dataDir: path.resolve(projectRoot, process.env.DATA_DIR ?? "data"),
  capabilitiesDir: path.resolve(projectRoot, process.env.CAPABILITIES_DIR ?? "capabilities"),
  databaseUrl: process.env.DATABASE_URL,
  webDistDir: path.resolve(projectRoot, "apps/web/dist"),
  commands: {
    claude: process.env.CLAUDE_COMMAND ?? "claude",
    codeagent: process.env.CODEAGENT_COMMAND ?? "codeagent"
  },
  models: {
    claude: modelList(process.env.CLAUDE_MODELS, ["sonnet", "opus", "fable"]),
    codeagent: modelList(process.env.CODEAGENT_MODELS, [])
  },
  mockAgent: process.env.AGENT_MOCK === "true",
  agentTimeoutMs: positiveNumber(process.env.AGENT_TIMEOUT_MS, 300_000),
  agentMaxBudgetUsd: positiveNumber(process.env.AGENT_MAX_BUDGET_USD, 2),
  knowledgePromptTemplate:
    process.env.KNOWLEDGE_PROMPT_TEMPLATE ?? "请使用 XXX 数据库检索以下知识库：{{knowledge_base_ids}}"
};
