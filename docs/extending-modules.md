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

首版 UI 聚焦 `knowledge-qa`，后续模块可以复用 Agent Runtime、Session/Attempt、SSE、Skill Registry 和持久化接口，再增加自己的输入表单与结果视图。
