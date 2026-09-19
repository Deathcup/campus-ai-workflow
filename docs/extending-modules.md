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
