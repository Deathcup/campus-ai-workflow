import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AgentTaskResultSchema,
  AgentTaskSchema,
  type AgentTask,
  type CreateAgentTaskInput,
  type DecideTaskInput,
  type TaskKind
} from "@campus-ai/contracts";
import type { AgentRuntime } from "@campus-ai/agent-runtime";
import { ModuleCatalog, SkillRegistry } from "@campus-ai/skill-registry";
import { readTaskOutput } from "./artifact-reader.js";
import { GitWorkspace } from "./git-workspace.js";
import type { DataStore } from "./store.js";

type TaskServiceOptions = {
  dataDir: string;
  agentTimeoutMs: number;
  agentMaxBudgetUsd: number;
  mockAgent: boolean;
};

const moduleForKind: Record<TaskKind, string> = {
  "security-scan": "security-scan",
  "code-review": "code-review"
};

export class TaskService {
  private readonly activeRuns = new Map<string, string>();
  private readonly workspaces: GitWorkspace;

  constructor(
    private readonly store: DataStore,
    private readonly runtime: AgentRuntime,
    private readonly catalog: ModuleCatalog,
    private readonly skills: SkillRegistry,
    private readonly options: TaskServiceOptions
  ) {
    this.workspaces = new GitWorkspace(options.dataDir, options.mockAgent);
  }

  async recoverInterruptedTasks(): Promise<void> {
    for (const task of (await this.store.listTasks()).filter((item) =>
      ["queued", "preparing", "running"].includes(item.status)
    )) {
      task.status = "interrupted";
      task.progress = "服务重启导致任务中断，可保留目录进行人工排查";
      task.updatedAt = new Date().toISOString();
      await this.store.putTask(task);
    }
  }

  async create(input: CreateAgentTaskInput): Promise<AgentTask> {
    const moduleId = moduleForKind[input.kind];
    const module = await this.catalog.get(moduleId);
    if (!module.enabled) throw new Error("所选模块未启用");
    if (module.experience !== "task" || module.taskKind !== input.kind)
      throw new Error("模块任务类型配置不一致");
    const runtimeSettings = (await this.store.listApplicationSettings()).find(
      (item) => item.moduleId === moduleId
    );
    if (!runtimeSettings) throw new Error("当前应用尚未配置 Agent Runtime，请先在管理设置中配置");
    const now = new Date().toISOString();
    const task = AgentTaskSchema.parse({
      id: randomUUID(),
      moduleId,
      kind: input.kind,
      title: titleFor(input),
      input,
      agent: runtimeSettings.agent,
      model: runtimeSettings.model,
      status: "queued",
      progress: "任务已创建，等待准备代码工作区",
      artifacts: [],
      createdAt: now,
      updatedAt: now
    });
    await this.store.putTask(task);
    void this.run(task.id).catch(() => undefined);
    return task;
  }

  async cancel(taskId: string): Promise<void> {
    const task = await this.requireTask(taskId);
    const runId = this.activeRuns.get(taskId);
    if (runId) await this.runtime.cancel(runId);
    task.status = "canceled";
    task.progress = "任务已由用户取消";
    task.updatedAt = new Date().toISOString();
    await this.store.putTask(task);
  }

  async decide(taskId: string, input: DecideTaskInput): Promise<AgentTask> {
    const task = await this.requireTask(taskId);
    if (task.status !== "waiting_user") throw new Error("当前任务不在等待确认状态");
    task.decision = { ...input, decidedAt: new Date().toISOString() };
    task.status = input.action === "confirm" ? "confirmed" : "rejected";
    task.progress = input.action === "confirm" ? "结果已确认" : "结果已驳回";
    task.updatedAt = task.decision.decidedAt;
    await this.store.putTask(task);
    return task;
  }

  private async run(taskId: string): Promise<void> {
    let task = await this.requireTask(taskId);
    const attemptId = randomUUID();
    this.activeRuns.set(taskId, attemptId);
    try {
      const descriptor = (await this.runtime.inspect()).find((item) => item.id === task.agent);
      if (!descriptor?.available) throw new Error(`${task.agent} CLI 当前不可用，请在管理设置中检查命令配置`);
      task = await this.update(task, "preparing", "正在拉取代码并解析确定的提交版本", { attemptId });
      const prepared = await this.workspaces.prepare(task.id, task.input);
      task = await this.update(task, "preparing", "代码工作区已准备，正在装载模块 Skill", {
        baseline: prepared.baseline
      });
      const staged = await this.skills.stage(task.moduleId, task.agent, prepared.workspaceDir);
      if (staged.skills.length === 0) throw new Error("当前模块没有启用的 Skill，请先在管理设置中添加");

      const module = await this.catalog.get(task.moduleId);
      const baseSystemPrompt = await readFile(
        this.catalog.resolve(task.moduleId, module.systemPromptFile),
        "utf8"
      );
      const attemptDir = path.join(this.options.dataDir, "tasks", task.id, "attempts", attemptId);
      const inputDir = path.join(prepared.workspaceDir, ".ai-workbench", "input");
      const outputDir = path.join(prepared.workspaceDir, ".ai-workbench", "output");
      await Promise.all([
        mkdir(attemptDir, { recursive: true }),
        mkdir(inputDir, { recursive: true }),
        mkdir(outputDir, { recursive: true })
      ]);
      await writeFile(
        path.join(inputDir, "task.json"),
        JSON.stringify(
          {
            taskId: task.id,
            taskKind: task.kind,
            input: task.input,
            baseline: prepared.baseline,
            skillIds: staged.skills.map((skill) => skill.id),
            artifactProtocol: "1.0"
          },
          null,
          2
        ),
        "utf8"
      );
      const systemPromptFile = path.join(attemptDir, "system.md");
      await writeFile(
        systemPromptFile,
        composeSystemPrompt(baseSystemPrompt, module.constraints, staged.promptFragment, task.kind),
        "utf8"
      );
      task = await this.update(task, "running", "Agent 正在执行模块 Skill 并生成标准报告");
      const runtimeResult = await this.runtime.execute(
        {
          runId: attemptId,
          agent: task.agent,
          model: task.model,
          cwd: prepared.workspaceDir,
          prompt: taskPrompt(task.kind),
          systemPromptFile,
          timeoutMs: this.options.agentTimeoutMs,
          maxBudgetUsd: this.options.agentMaxBudgetUsd,
          allowedTools: module.runtime.allowedTools,
          mcpConfigFile: module.runtime.mcpConfigFile
            ? this.catalog.resolve(task.moduleId, module.runtime.mcpConfigFile)
            : undefined
        },
        async (event) => {
          if (event.sessionId && !task.agentSessionId) {
            task.agentSessionId = event.sessionId;
            task.updatedAt = new Date().toISOString();
            await this.store.putTask(task);
          }
        }
      );
      if (runtimeResult.sessionId) task.agentSessionId = runtimeResult.sessionId;
      if (this.options.mockAgent) await writeMockOutput(outputDir, task.kind, prepared.baseline.commitSha);
      const output = await readTaskOutput(prepared.workspaceDir, task.kind);
      task.result = output.result;
      task.reportMarkdown = output.reportMarkdown;
      task.artifacts = output.artifacts;
      task.status = "waiting_user";
      task.progress = `${task.kind === "security-scan" ? "扫描" : "检视"}报告已生成，等待人工确认`;
      task.completedAt = new Date().toISOString();
      task.updatedAt = task.completedAt;
      task.error = undefined;
      await this.store.putTask(task);
    } catch (error) {
      const latest = await this.requireTask(taskId);
      if (latest.status !== "canceled") {
        latest.status = "failed";
        latest.error = error instanceof Error ? error.message : String(error);
        latest.progress = "任务执行失败";
        latest.completedAt = new Date().toISOString();
        latest.updatedAt = latest.completedAt;
        await this.store.putTask(latest);
      }
    } finally {
      this.activeRuns.delete(taskId);
    }
  }

  private async update(
    task: AgentTask,
    status: AgentTask["status"],
    progress: string,
    patch: Partial<AgentTask> = {}
  ): Promise<AgentTask> {
    const next = { ...task, ...patch, status, progress, updatedAt: new Date().toISOString() };
    await this.store.putTask(next);
    return next;
  }

  private async requireTask(id: string): Promise<AgentTask> {
    const task = await this.store.getTask(id);
    if (!task) throw new Error("任务不存在");
    return task;
  }
}

function composeSystemPrompt(
  base: string,
  constraints: string[],
  skillPrompt: string,
  taskKind: TaskKind
): string {
  return [
    base.trim(),
    "",
    "## 平台边界",
    ...constraints.map((item) => `- ${item}`),
    "",
    "## 本次加载的模块 Skill",
    skillPrompt,
    "",
    "## AI Workbench 产物协议（必须完成）",
    "完成业务 Skill 的分析后，必须把结果适配为以下文件；即使业务 Skill 使用其他格式，也要在结束前转换：",
    "- `.ai-workbench/output/result.json`：UTF-8 JSON，schemaVersion 必须为 `1.0`，taskKind 必须为 `" +
      taskKind +
      "`。",
    "- `.ai-workbench/output/report.md`：完整 Markdown 报告，供页面在线展示。",
    "- `.ai-workbench/output/artifacts/*`：可选的补充产物。",
    "result.json 必须包含：schemaVersion、taskKind、summary、verdict、findings、metrics。",
    "每个 finding 必须包含 id、severity、confidence、title、description；代码定位和修复建议按需填写。",
    "verdict 仅允许 pass、attention、required_changes；severity 仅允许 info、low、medium、high、critical。",
    "不得只在最终回复里给报告。文件缺失或 JSON 不符合协议会被平台判定为任务失败。",
    "只允许把平台产物写入 `.ai-workbench/output`，不得修改被扫描或检视的业务代码。"
  ].join("\n");
}

function taskPrompt(kind: TaskKind): string {
  return kind === "security-scan"
    ? "读取 `.ai-workbench/input/task.json`，执行已加载的代码仓安全扫描 Skill，检查当前提交，并严格按照系统中的 AI Workbench 产物协议生成结果。"
    : "读取 `.ai-workbench/input/task.json` 和 `.ai-workbench/input/change.diff`，执行已加载的代码检视 Skill，检视当前 MR/PR 变更，并严格按照系统中的 AI Workbench 产物协议生成结果。";
}

function titleFor(input: CreateAgentTaskInput): string {
  if (input.kind === "security-scan") {
    const repository =
      input.repositoryUrl
        .replace(/\/$/, "")
        .split(/[/:]/)
        .pop()
        ?.replace(/\.git$/, "") || "代码仓";
    return `${repository} · ${input.branch}`;
  }
  const change = new URL(input.mergeRequestUrl);
  const parts = change.pathname.split("/").filter(Boolean);
  const pullIndex = parts.lastIndexOf("pull");
  const mergeIndex = parts.lastIndexOf("merge_requests");
  const marker = pullIndex >= 0 ? pullIndex : mergeIndex;
  const repository = parts[marker - (pullIndex >= 0 ? 1 : 2)] ?? "代码仓";
  const number = parts[marker + 1] ?? "?";
  return pullIndex >= 0 ? `${repository} · PR #${number}` : `${repository} · MR !${number}`;
}

async function writeMockOutput(outputDir: string, kind: TaskKind, commitSha: string): Promise<void> {
  const result = AgentTaskResultSchema.parse(
    kind === "security-scan"
      ? {
          schemaVersion: "1.0",
          taskKind: kind,
          summary: "已完成示例安全扫描。发现 1 个需要人工复核的高风险项和 1 个改进建议。",
          verdict: "attention",
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              confidence: "high",
              category: "访问控制",
              title: "管理接口缺少显式授权边界",
              description: "示例扫描发现管理接口的授权校验需要结合公司登录适配器进一步确认。",
              file: "apps/server/src/app.ts",
              startLine: 20,
              endLine: 32,
              evidence: "管理路由目前由部署边界保护，代码中尚未接入公司 RBAC。",
              recommendation: "在公司适配层加入统一鉴权钩子，并为管理操作声明权限。"
            },
            {
              id: "SEC-002",
              severity: "low",
              confidence: "medium",
              category: "审计",
              title: "建议补充管理员操作审计字段",
              description: "配置变更已有时间信息，但还可以记录操作者身份和请求 ID。"
            }
          ],
          metrics: { commitSha, filesReviewed: 28, findingCount: 2, mock: true }
        }
      : {
          schemaVersion: "1.0",
          taskKind: kind,
          summary: "已完成示例代码检视。整体结构清晰，有 1 条建议在合并前确认。",
          verdict: "attention",
          findings: [
            {
              id: "REVIEW-001",
              severity: "medium",
              confidence: "high",
              category: "错误处理",
              title: "异步失败路径需要保留稳定错误码",
              description: "示例检视发现部分错误只返回 message，内部合并时可能难以稳定映射前端交互。",
              file: "apps/server/src/app.ts",
              startLine: 100,
              recommendation: "在核心错误类型中增加稳定 code，并由 Route 统一映射状态码。"
            }
          ],
          metrics: { commitSha, changedFiles: 6, commentCount: 1, mock: true }
        }
  );
  await mkdir(path.join(outputDir, "artifacts"), { recursive: true });
  await writeFile(path.join(outputDir, "result.json"), JSON.stringify(result, null, 2), "utf8");
  await writeFile(
    path.join(outputDir, "report.md"),
    `# ${kind === "security-scan" ? "代码仓安全扫描报告" : "代码检视报告"}\n\n${result.summary}\n\n## 基线\n\n- Commit: \`${commitSha}\`\n- 结论: **${result.verdict}**\n\n## 发现\n\n${result.findings
      .map(
        (finding) =>
          `### ${finding.id} · ${finding.title}\n\n${finding.description}\n\n- 严重程度：${finding.severity}\n- 置信度：${finding.confidence}\n${finding.recommendation ? `- 建议：${finding.recommendation}\n` : ""}`
      )
      .join("\n")}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDir, "artifacts", "execution-summary.txt"),
    `AI Workbench mock output\nTask kind: ${kind}\nCommit: ${commitSha}\n`,
    "utf8"
  );
}
