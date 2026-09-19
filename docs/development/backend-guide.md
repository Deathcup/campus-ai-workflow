# 后端开发指南

## 分层

- Route：解析协议、校验输入、映射状态码。
- Application Service：业务状态机和用例编排。
- Port/Contract：Runtime、Store、代码托管和认证接口。
- Adapter：CLI、PostgreSQL、本地文件、公司登录或 CodeAgent 实现。

Route 不得启动子进程，Adapter 不得决定业务状态流转。

## Agent Runtime

- 所有 Claude 兼容 CLI 必须通过 `AgentRuntime`。
- argv 使用数组构造，Prompt 通过 stdin，禁止拼 shell 字符串。
- Agent 与模型策略由管理员按应用配置，创建业务对象时由后端读取并快照，不能信任普通用户传入。
- 配置了模型时通过 `--model` 显式传入；应用模型留空时不传，使用 CLI 默认值。
- stdout 按 NDJSON 增量解析；stderr 脱敏后作为诊断事件。
- 取消顺序为 SIGINT → 宽限期 → SIGTERM。
- Runtime 更新必须覆盖：正常结果、非零退出、无效 JSON、超时、取消、Session 恢复。

## Session / Task / Attempt

- Session 或 Task 表示业务对象；Attempt 表示一次不可覆盖的执行。
- 每次执行保存输入摘要、模块版本、Skill IDs、模型、Agent Session ID 和结果。
- 服务重启后未知运行态标记 `interrupted`，不得伪装成成功。
- 多轮恢复失败时允许用平台消息记录创建新 Agent Session，但必须保留审计关系。
- Git 拉取、分支切换和 MR/PR ref 解析统一通过 `GitWorkspace`，禁止 Agent 自行选择代码基线。
- Agent 输出统一通过 `ArtifactReader` 校验；最终回复文本不能代替 `result.json` 和 `report.md`。

## 持久化

- 本地 JSON Store 只用于单进程开发。
- 团队环境必须使用 PostgreSQL。
- 大文件进入 Artifact Store，数据库只保存元数据和摘要。
- Schema 变化提供前向迁移；迁移脚本必须可重复执行或明确幂等边界。

## 安全编码

- 所有外部输入先 Zod 校验。
- 文件名和相对路径验证绝对路径、`..`、编码分隔符和符号链接边界。
- 日志脱敏字段至少包括 token、secret、password、cookie 和 authorization。
- 不允许 Agent 直接持有 GitHub/GitLab、SSO 或数据库管理员凭据。
- 公司适配器只能在内部仓实现，通过接口注册，不能修改核心代码读取内部环境。

## 错误处理

业务错误使用稳定 code，例如：

```text
MODULE_DISABLED
AGENT_UNAVAILABLE
MODEL_NOT_ALLOWED
SESSION_BUSY
SKILL_MISSING
RUNTIME_TIMEOUT
```

前端根据 code 决定交互，message 用于展示，日志保留 requestId 和 cause。
