import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AgentKind,
  ChatMessage,
  ChatSession,
  CreateSessionInput,
  KnowledgeBase,
  RuntimeEvent
} from "@campus-ai/contracts";
import type { AgentRuntime, NormalizedCliEvent } from "@campus-ai/agent-runtime";
import { ModuleCatalog, SkillRegistry } from "@campus-ai/skill-registry";
import type { DataStore } from "./store.js";
import { EventBroker } from "./event-broker.js";

type ServiceOptions = {
  dataDir: string;
  agentTimeoutMs: number;
  agentMaxBudgetUsd: number;
  knowledgePromptTemplate: string;
};

export class SessionService {
  private readonly activeRuns = new Map<string, string>();

  constructor(
    private readonly store: DataStore,
    private readonly runtime: AgentRuntime,
    private readonly catalog: ModuleCatalog,
    private readonly skills: SkillRegistry,
    readonly events: EventBroker,
    private readonly options: ServiceOptions
  ) {}

  async recoverInterruptedSessions(): Promise<void> {
    const sessions = await this.store.listSessions();
    for (const session of sessions.filter((item) => item.status === "running")) {
      session.status = "interrupted";
      session.updatedAt = new Date().toISOString();
      await this.store.putSession(session);
    }
  }

  async create(input: CreateSessionInput): Promise<ChatSession> {
    const module = await this.catalog.get(input.moduleId);
    if (!module.enabled) throw new Error("所选模块未启用");
    const runtimeSettings = (await this.store.listApplicationSettings()).find(
      (item) => item.moduleId === input.moduleId
    );
    if (!runtimeSettings) throw new Error("当前应用尚未配置 Agent Runtime，请先在管理设置中配置");
    const bases = await this.resolveKnowledgeBases(input.knowledgeBaseIds);
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: randomUUID(),
      title: input.title?.trim() || `与 ${bases.map((item) => item.name).join("、")} 对话`,
      moduleId: input.moduleId,
      agent: runtimeSettings.agent,
      model: runtimeSettings.model,
      knowledgeBaseIds: input.knowledgeBaseIds,
      status: "ready",
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    await this.store.putSession(session);
    return session;
  }

  async sendMessage(sessionId: string, content: string): Promise<ChatSession> {
    const session = await this.requireSession(sessionId);
    if (this.activeRuns.has(sessionId) || session.status === "running")
      throw new Error("当前会话正在生成回复");
    const descriptors = await this.runtime.inspect();
    if (!descriptors.find((agent) => agent.id === session.agent)?.available) {
      throw new Error(`${session.agent} CLI 当前不可用，请在管理设置中检查命令配置`);
    }

    const now = new Date().toISOString();
    const message: ChatMessage = { id: randomUUID(), role: "user", content, createdAt: now };
    session.messages.push(message);
    session.status = "running";
    session.updatedAt = now;
    await this.store.putSession(session);
    void this.run(session, message).catch(() => undefined);
    return session;
  }

  async cancel(sessionId: string): Promise<void> {
    const runId = this.activeRuns.get(sessionId);
    if (runId) await this.runtime.cancel(runId);
    const session = await this.requireSession(sessionId);
    session.status = "canceled";
    session.updatedAt = new Date().toISOString();
    await this.store.putSession(session);
  }

  private async run(session: ChatSession, userMessage: ChatMessage): Promise<void> {
    const attemptId = randomUUID();
    const runId = attemptId;
    this.activeRuns.set(session.id, runId);
    const attemptDir = path.join(this.options.dataDir, "sessions", session.id, "attempts", attemptId);

    try {
      await mkdir(attemptDir, { recursive: true });
      const module = await this.catalog.get(session.moduleId);
      const knowledgeBases = await this.resolveKnowledgeBases(session.knowledgeBaseIds);
      const staged = await this.skills.stage(session.moduleId, session.agent, attemptDir);
      if (staged.skills.length === 0) throw new Error("当前模块没有启用的 Skill，请先在管理设置中添加");
      const baseSystemPrompt = await readFile(
        this.catalog.resolve(session.moduleId, module.systemPromptFile),
        "utf8"
      );
      const systemPrompt = this.composeSystemPrompt(
        baseSystemPrompt,
        module.constraints,
        knowledgeBases,
        staged.promptFragment
      );
      const systemPromptFile = path.join(attemptDir, "system.md");
      await writeFile(systemPromptFile, systemPrompt, "utf8");
      await writeFile(
        path.join(attemptDir, "request.json"),
        JSON.stringify(
          {
            sessionId: session.id,
            attemptId,
            agent: session.agent,
            model: session.model,
            knowledgeBaseIds: session.knowledgeBaseIds,
            skillIds: staged.skills.map((skill) => skill.id),
            resumeSessionId: session.agentSessionId,
            userMessageId: userMessage.id,
            createdAt: new Date().toISOString()
          },
          null,
          2
        ),
        "utf8"
      );

      await this.emit(session.id, attemptId, "status", {
        status: "preparing",
        message: "会话目录与模块 Skill 已准备完成"
      });
      let streamedText = "";
      const result = await this.runtime.execute(
        {
          runId,
          agent: session.agent,
          model: session.model,
          cwd: attemptDir,
          prompt: userMessage.content,
          systemPromptFile,
          resumeSessionId: session.agentSessionId,
          timeoutMs: this.options.agentTimeoutMs,
          maxBudgetUsd: this.options.agentMaxBudgetUsd,
          allowedTools: module.runtime.allowedTools,
          mcpConfigFile: module.runtime.mcpConfigFile
            ? this.catalog.resolve(session.moduleId, module.runtime.mcpConfigFile)
            : undefined
        },
        async (event) => {
          if (event.type === "text_delta" && typeof event.payload.text === "string")
            streamedText += event.payload.text;
          await this.forwardRuntimeEvent(session.id, attemptId, event);
        }
      );

      const latest = await this.requireSession(session.id);
      if (latest.status === "canceled") return;
      const answer = result.finalText || streamedText || "Agent 已完成，但没有返回文本结果。";
      latest.messages.push({
        id: randomUUID(),
        role: "assistant",
        content: answer,
        attemptId,
        createdAt: new Date().toISOString()
      });
      latest.agentSessionId = result.sessionId ?? latest.agentSessionId;
      latest.status = "succeeded";
      latest.updatedAt = new Date().toISOString();
      await this.store.putSession(latest);
      await writeFile(
        path.join(attemptDir, "result.json"),
        JSON.stringify({ answer, agentSessionId: latest.agentSessionId }, null, 2),
        "utf8"
      );
      await this.emit(session.id, attemptId, "status", { status: "succeeded" });
    } catch (error) {
      const latest = await this.store.getSession(session.id);
      if (latest && latest.status !== "canceled") {
        latest.status = "failed";
        latest.updatedAt = new Date().toISOString();
        latest.messages.push({
          id: randomUUID(),
          role: "system",
          content: error instanceof Error ? error.message : String(error),
          attemptId,
          createdAt: new Date().toISOString()
        });
        await this.store.putSession(latest);
      }
      await this.emit(session.id, attemptId, "error", {
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.activeRuns.delete(session.id);
    }
  }

  private composeSystemPrompt(
    base: string,
    constraints: string[],
    bases: KnowledgeBase[],
    skillPrompt: string
  ): string {
    const ids = bases.map((item) => item.id).join(", ");
    const knowledgeInstruction = this.options.knowledgePromptTemplate.replace("{{knowledge_base_ids}}", ids);
    return [
      base,
      "\n## 本次授权的知识库（不可扩大范围）",
      knowledgeInstruction,
      ...bases.map((item) => `- ${item.name}（ID: ${item.id}）：${item.description || "无描述"}`),
      "\n## 模块约束",
      ...constraints.map((constraint) => `- ${constraint}`),
      "\n## 当前模块 Skill",
      skillPrompt
    ].join("\n");
  }

  private async resolveKnowledgeBases(ids: string[]): Promise<KnowledgeBase[]> {
    const all = await this.store.listKnowledgeBases();
    const byId = new Map(all.filter((item) => item.enabled).map((item) => [item.id, item]));
    const result = ids.map((id) => byId.get(id)).filter((item): item is KnowledgeBase => Boolean(item));
    if (result.length !== ids.length) throw new Error("部分知识库不存在或已停用");
    return result;
  }

  private async requireSession(id: string): Promise<ChatSession> {
    const session = await this.store.getSession(id);
    if (!session) throw new Error("会话不存在");
    return session;
  }

  private async forwardRuntimeEvent(
    sessionId: string,
    attemptId: string,
    event: NormalizedCliEvent
  ): Promise<void> {
    await this.emit(sessionId, attemptId, event.type, event.payload);
  }

  private async emit(
    sessionId: string,
    attemptId: string,
    type: RuntimeEvent["type"],
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: RuntimeEvent = {
      id: randomUUID(),
      sessionId,
      attemptId,
      type,
      payload,
      createdAt: new Date().toISOString()
    };
    await this.store.addEvent(event);
    this.events.publish(event);
  }
}
