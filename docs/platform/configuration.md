# 配置参考

配置分为三层：环境级运行参数、管理台业务配置和代码内模块清单。模型配置属于应用，不属于知识库，也不由普通用户选择。

## 环境变量

| 变量                        | 默认值              | 说明                                                    |
| --------------------------- | ------------------- | ------------------------------------------------------- |
| `HOST`                      | `0.0.0.0`           | API 监听地址                                            |
| `PORT`                      | `4100`              | API 与生产静态站点端口                                  |
| `DATA_DIR`                  | `./data`            | JSON 数据、Skill、Session 和 Task 工作目录              |
| `CAPABILITIES_DIR`          | `./capabilities`    | 模块清单根目录                                          |
| `DATABASE_URL`              | 空                  | 设置后使用 PostgreSQL；为空时使用 `DATA_DIR/store.json` |
| `CLAUDE_COMMAND`            | `claude`            | Claude Code CLI 可执行命令或绝对路径                    |
| `CODEAGENT_COMMAND`         | `codeagent`         | 与 Claude CLI 协议一致的 CodeAgent 命令                 |
| `CLAUDE_MODELS`             | `sonnet,opus,fable` | 管理台模型建议，逗号分隔                                |
| `CODEAGENT_MODELS`          | 空                  | CodeAgent 模型建议，逗号分隔                            |
| `AGENT_TIMEOUT_MS`          | `300000`            | 单次 Agent 执行超时（毫秒）                             |
| `AGENT_MAX_BUDGET_USD`      | `2`                 | 传给兼容 CLI 的单次预算上限                             |
| `AGENT_MOCK`                | `false`             | `true` 时跳过真实 Git/Agent，生成稳定演示结果           |
| `KNOWLEDGE_PROMPT_TEMPLATE` | 内置模板            | 知识库注入提示词，必须包含 `{{knowledge_base_ids}}`     |

模型建议只是管理台下拉提示，不限制 CLI 可接受的其他模型 ID。应用模型留空时，平台不传 `--model`，由对应 CLI 使用默认模型。

生产环境不要把令牌、数据库密码或私钥提交到 `.env` 样例。应使用公司密钥管理服务、容器 secret 或受控运行账号注入。

## 应用级 Runtime

“管理设置 → 应用配置”为每个模块维护：

- Agent：`claude` 或 `codeagent`。
- 模型：可选。没有特殊需求应留空。

知识库只是知识问答的数据范围，不携带模型配置。安全扫描和代码检视也各自拥有应用级 Runtime，因此可以使用不同 Agent/模型。

服务首次启动时会为已发现模块建立默认 Claude 配置。创建 Session/Task 时若找不到该模块设置，服务会拒绝运行并提示管理员配置。

## 知识库

“管理设置 → 知识库”维护线上知识库的引用信息：

- `id`：线上知识库 ID，也是传给知识库 Skill 的 key。
- `name`、`description`：面向用户展示。
- `enabled`：禁用后不能用于新会话。

平台不复制知识正文。真正的检索 API/MCP/CLI 及鉴权方式由知识库 Skill 定义。

## 模块 Skill

“管理设置 → 模块 Skill”中的 Skill 归属于一个 `moduleId`，包含名称、版本、说明、`SKILL.md` 指令和可选配套文件。只有启用的 Skill 会在运行时暂存。

暂存位置：

```text
.agent/skills/<skill-id>/
.claude/skills/<skill-id>/      # Claude 兼容目录
.codeagent/skills/<skill-id>/   # CodeAgent 兼容目录
```

每次执行只装载当前模块的 Skill。内置 Skill 位于 `capabilities/<module-id>/skills`，管理员 Skill 位于 `DATA_DIR/skills`。完整约定见 [Skill 契约](../skill-contract.md)。

## 模块清单

每个 `capabilities/<module-id>/module.json` 主要字段：

| 字段                        | 说明                                            |
| --------------------------- | ----------------------------------------------- |
| `id`、`name`、`description` | 模块唯一标识和展示信息                          |
| `enabled`                   | 是否可用                                        |
| `capabilityVersion`         | 模块能力版本                                    |
| `experience`                | `conversation` 或 `task`                        |
| `taskKind`                  | 任务模块对应的 `security-scan` 或 `code-review` |
| `systemPromptFile`          | 模块系统提示词相对路径                          |
| `skillDirectory`            | 内置 Skill 相对目录                             |
| `constraints`               | 每次运行追加的静态边界                          |
| `runtime.allowedTools`      | 可传给 Agent 的工具白名单                       |
| `runtime.mcpConfigFile`     | 可选 MCP 配置相对路径                           |

清单随代码评审和发布，管理台不直接编辑它。涉及工具权限、MCP 或系统边界的修改必须经过代码审查。

## 存储选择

本地开发默认使用原子写入的 `store.json`。单实例演示足够，但不支持多实例并发。设置 `DATABASE_URL` 后业务对象写入 PostgreSQL；Skill 和运行工作目录仍保存在 `DATA_DIR`，因此多实例部署还需要共享文件存储或把执行调度固定到单个 worker。
