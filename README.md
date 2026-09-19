# Campus AI Workbench

面向团队的可扩展 AI 工作台首版。当前打通知识库问答、代码仓安全扫描和 MR/PR 代码检视三条链路，支持 Claude Code 和与其 CLI 协议一致的 CodeAgent。

## 已实现

- Claude / CodeAgent 统一 Runtime：`stream-json`、Session ID、`--resume`、取消、超时和错误收集。
- 知识库多选：使用线上知识库 ID 作为 key，会话启动前自动注入检索提示词。
- 多轮会话：同一平台会话保存 Agent Session ID，后续问题通过 CLI resume 继续。
- 模块级 Skill：管理员可添加模块专属 `SKILL.md`；每次 attempt 只复制该模块启用的 Skill。
- 应用级运行策略：管理员为每个能力应用统一配置 Agent 和可选模型，普通用户无需理解模型参数。
- 安全扫描任务：仓库地址和分支被解析为隔离目录与确定 commit，Agent 生成结构化发现和 Markdown 报告。
- 代码检视任务：支持 GitHub PR / GitLab MR 链接，平台准备 head 代码与确定 diff，报告先在本地等待人工确认。
- 标准产物协议：公司 Skill 可保留内部格式，但结束前必须适配 `.ai-workbench/output`，平台校验后再展示。
- 会话隔离：运行目录为 `data/sessions/<session-id>/attempts/<attempt-id>`。
- 实时状态：Fastify SSE 推送 Agent 事件，React 页面展示执行状态。
- 双持久化模式：本地开发默认原子 JSON 文件；设置 `DATABASE_URL` 后使用 PostgreSQL。
- 模块化扩展：`capabilities/<module-id>/module.json + prompts + skills` 描述新能力。

平台侧栏只承载“能力应用”和“管理设置”。会话历史只属于知识库问答；安全扫描和代码检视各自使用任务列表、报告和人工决策，不共享也不强制采用会话模型。

## 快速启动

要求 Node.js 20+，并至少安装一个 Agent CLI。

```bash
npm install
cp .env.example .env
npm run dev
```

浏览器打开 `http://localhost:4173`。API 位于 `http://localhost:4100`。

没有 Agent 凭据时可用模拟模式验证完整 UI/API 链路：

```bash
AGENT_MOCK=true npm run dev
```

构建并以同一服务托管前端：

```bash
npm run build
npm start
```

## Agent 配置

两个 CLI 使用相同协议，只替换命令名：

```env
CLAUDE_COMMAND=claude
CODEAGENT_COMMAND=codeagent
```

平台启动命令的核心参数为：

```text
--bare --print --output-format stream-json --verbose
--permission-mode dontAsk --append-system-prompt-file <attempt>/system.md
```

管理员在“管理设置 → 应用配置”中为每个应用选择 Runtime。模型默认留空，此时 CLI 不传 `--model`，直接使用该 CLI 的默认模型；只有应用有特殊要求时才填写模型 ID。可通过 `CLAUDE_MODELS` 和 `CODEAGENT_MODELS` 提供常用模型建议，仍允许管理员填写兼容 CLI 支持的其他模型 ID。应用会在创建会话或任务时快照这份策略，知识库问答用户无需选择或关注模型。

默认只开放知识问答所需的只读工具。可在 `packages/agent-runtime` 的 Runtime 配置中按部署策略扩展。

## Skill 隔离

管理设置新增的 Skill 保存到 `data/skills/<module-id>/<skill-id>`。每轮执行会把当前模块启用的 Skill 复制到：

```text
data/sessions/<session>/attempts/<attempt>/.agent/skills/
data/sessions/<session>/attempts/<attempt>/.claude/skills/     # Claude
data/sessions/<session>/attempts/<attempt>/.codeagent/skills/  # CodeAgent
```

Agent 的工作目录就是 attempt 目录，系统提示词明确要求先读取 `.agent/skills` 中列出的 Skill，且禁止加载其他模块能力。

代码任务的 Skill 会装载到任务 workspace，并必须生成：

```text
.ai-workbench/output/result.json
.ai-workbench/output/report.md
.ai-workbench/output/artifacts/*
```

详细字段和公司 Skill 适配方式见 [Agent 产物交互协议](docs/artifact-protocol.md)。

## 接入真实知识库

当前内置 Skill 是“XXX 数据库”的安全模板。接入时有两种方式：

1. 在“管理设置 → 模块 Skill”添加包含实际 API/MCP/CLI 调用约定的 Skill。
2. 直接版本化修改 `capabilities/knowledge-qa/skills` 中的内置 Skill。

环境变量 `KNOWLEDGE_PROMPT_TEMPLATE` 可覆盖默认提示词，必须保留 `{{knowledge_base_ids}}` 占位符。

## 验证

```bash
npm run check
npm test
npm run build
```

## 开发与公司集成文档

- [贡献指南](CONTRIBUTING.md)
- [开发总则](docs/development/development-guide.md)
- [前端指南](docs/development/frontend-guide.md)
- [后端指南](docs/development/backend-guide.md)
- [测试与发布](docs/development/testing-guide.md)
- [公司内外双仓协作](docs/integration/internal-external-collaboration.md)
- [内部 Agent 使用手册](docs/integration/internal-agent-playbook.md)
- [第二个能力开发手册](docs/integration/second-capability-playbook.md)
- [CodeAgent 接入](docs/integration/codeagent-guide.md)
- [登录系统接入](docs/integration/auth-integration-guide.md)
- [任务协议](docs/task-protocol.md)
- [Agent 产物交互协议](docs/artifact-protocol.md)
- [Skill 契约](docs/skill-contract.md)
- [模块扩展指南](docs/extending-modules.md)
