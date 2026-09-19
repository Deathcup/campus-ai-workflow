# 开发总则

## 1. 架构目标

平台采用模块化单体。通用底座提供 Runtime、Session/Attempt、事件、持久化、Skill Registry 和管理设置；业务能力通过 `capabilities/<module-id>` 扩展。

依赖方向必须保持：

```text
UI / API → Application Service → Contracts / Ports → Runtime & Infrastructure
Capability → Contracts / Ports
Infrastructure 不反向依赖具体 Capability
```

业务模块不得直接拼 Agent CLI 参数、直接访问数据库或读取其他模块的 Skill。

## 2. 稳定边界

以下边界由平台维护，内部集成应实现或调用它们，不应绕过：

- `AgentRuntime`：Agent 启动、事件解析、取消和状态检查。
- `DataStore`：会话、知识库和事件持久化。
- `ModuleManifest`：模块元数据、Runtime 权限、Prompt 和 Skill 入口。
- `SkillRegistry`：模块 Skill 的登记、校验和 Attempt 隔离。
- HTTP/SSE contracts：前后端唯一通信入口。

需要修改这些边界时，必须先写 ADR，说明兼容方案，并至少保留一个版本的迁移路径。

## 3. 模块与任务不是同一种 UI

平台最外层是“能力应用”。每个模块定义自己的工作对象：

- 知识库问答：Session + Messages。
- 安全扫描：Scan Task + Findings。
- 代码修改通知：Subscription + Notification。
- 代码检视：Review Task + Decisions。

不得为了复用页面，把所有能力强行建模为对话。底层可以复用 Task/Attempt/Event，展示层和业务实体保持模块语义。

## 4. 配置规则

- 非敏感默认值放 `.env.example`。
- 敏感值只由部署环境注入。
- 模型、命令、MCP 文件和工具权限均显式配置。
- 代码中禁止根据主机名、用户名或公司域名启用隐藏逻辑。
- 环境配置启动时校验，运行中不静默降级。

## 5. API 规则

- 输入、输出和事件必须由 `@campus-ai/contracts` 中的 Zod Schema 定义。
- URL 使用资源名复数形式；命令型动作使用明确子资源，例如 `/sessions/:id/cancel`。
- 创建返回 `201`，异步接受返回 `202`，删除成功返回 `204`。
- 错误响应至少包含稳定的 `code` 和面向用户的 `message`；不得把堆栈直接返回前端。
- 破坏性变更必须新建版本或提供兼容字段。

## 6. 安全规则

- 默认最小工具权限；每个模块在 manifest 中声明 `allowedTools`。
- Agent 使用独立 Attempt 工作目录，只加载当前模块 Skill。
- 路径必须规范化并验证不可逃逸。
- 凭据不进入 Prompt、事件、结果文件和日志。
- 外部副作用由平台执行，Agent 只提出意图或生成结构化结果。
- 内部仓接入前执行依赖审计、Secret Scan 和许可证检查。

## 7. 可观察性

每次执行必须可关联：

```text
requestId → moduleId → task/sessionId → attemptId → agentSessionId
```

日志使用结构化字段。Prompt 正文、知识正文、Token 和用户私密内容默认不记录。状态事件和业务结果分开保存。

## 8. Definition of Done

- 契约和实现同步。
- 新路径有成功、失败和取消测试。
- `npm run verify` 通过。
- 文档、示例配置和部署说明已更新。
- 没有公司信息和凭据进入外部提交。
- 可回滚，且旧数据/旧会话的兼容行为明确。
