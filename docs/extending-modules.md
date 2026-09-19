# 新增能力模块

在 `capabilities` 下新增目录，并提供：

```text
capabilities/example/
├── module.json
├── prompts/system.md
└── skills/example-skill/
    ├── skill.json
    └── SKILL.md
```

`module.json` 声明模块名称、版本、system prompt、Skill 目录、硬约束和 Runtime 权限。`runtime.allowedTools` 为模块设置最小工具集；需要 MCP 时可通过 `runtime.mcpConfigFile` 指向模块内的显式配置。服务启动后模块会自动出现在 `/api/modules`，Skill 管理接口也会按 module ID 隔离。

模块通过 `experience` 声明交互形态：`conversation` 使用 Session，多轮问答；`task` 使用 Task、标准产物和人工确认。任务模块还要声明 `taskKind`。

首版包含 `knowledge-qa`、`security-scan` 和 `code-review`。后续模块可以复用 Agent Runtime、Task/Attempt、GitWorkspace、ArtifactReader、Skill Registry 和持久化接口，再增加自己的输入表单与结果视图。

新增代码任务时，不要直接在 Route 中运行 Git 或 Agent。扩展 `CreateAgentTaskInput` 和 TaskService 的准备策略，并让 Skill 遵循 [Agent 产物交互协议](artifact-protocol.md)。

## 扩展步骤

1. 先定义业务对象：它是否真的需要多轮上下文；不需要时使用 Task，不要为了复用 UI 强行创建会话。
2. 定义输入、状态、结果和人工决策契约，并添加 Zod 测试。
3. 添加模块清单、最小工具白名单、系统提示词和不包含公司信息的内置 Skill。
4. 把外部准备工作封装成 adapter，例如 Git、工单、制品或数据库 snapshot；Route 只负责校验和调用 service。
5. 通过 SkillRegistry 暂存当前模块 Skill，不读取其他模块目录。
6. 为结构化产物实现 reader/validator；不要只解析 Agent 自然语言回复。
7. 添加前端入口、创建表单、状态页、结果页和明确的失败/空状态。
8. 增加单元/API/UI 回归，更新 [API 参考](platform/api-reference.md)、模块文档和 [平台总览](platform/overview.md)。

## 设计检查

- Runtime 和模型仍由应用级管理设置决定，普通用户不能在请求中覆盖。
- 外部写操作与“查看/确认报告”分离，并有额外权限和审计。
- 任务目录使用不可猜测 ID，所有用户输入路径都经过校验。
- Agent 工具权限符合最小权限；提示词约束不能替代容器和操作系统隔离。
- 服务重启时有清晰的 interrupted/幂等恢复语义。
- 大输入、超时、取消、输出大小和保留策略已经定义。
- 新模块有独立 Skill、系统提示词、用户文档和验收用例。

若新增的是完全不同的 Task 类型，不要不断向 `TaskService` 添加条件分支。应抽取 `TaskHandler`/registry，让每个 task kind 实现 `prepare`、`buildPrompt`、`readOutput` 等接口；通用服务只编排生命周期。这是后续模块增多时优先进行的结构演进。
