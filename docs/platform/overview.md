# 平台架构与边界

Campus AI Workbench 是一个“能力应用 + 统一 Agent Runtime + 模块 Skill”的可扩展工作台。平台负责身份之外的通用编排、隔离、状态、产物和 UI；公司内部 Skill 负责具体业务能力。

## 信息架构

最外层只有两类入口：

1. 能力应用：知识库问答、代码仓安全扫描、MR/PR 代码检视，以及后续新增模块。
2. 管理设置：应用 Runtime、知识库和模块 Skill。

会话不是平台顶层对象。它只属于需要多轮交互的知识库问答。安全扫描、代码检视等一次性工作使用 Task，可以有任务列表和报告，但不强制出现聊天记录。

## 分层

```text
React Web
   │ HTTP / SSE
Fastify API
   ├── ModuleCatalog        读取 capabilities/*/module.json
   ├── SessionService       多轮会话编排
   ├── TaskService          一次性任务编排与人工决策
   ├── SkillRegistry        内置/管理员 Skill 合并与暂存
   ├── GitWorkspace         仓库、分支、MR/PR 基线准备
   ├── ArtifactReader       校验 result.json 并读取报告
   ├── AgentRuntime         Claude / CodeAgent 统一 CLI 协议
   └── DataStore            原子 JSON 或 PostgreSQL
```

共享契约集中在 `packages/contracts`。前后端和存储层都复用 Zod schema，避免同一字段在多处各自定义。

## 核心对象

| 对象                       | 用途                                                       | 生命周期                     |
| -------------------------- | ---------------------------------------------------------- | ---------------------------- |
| ModuleManifest             | 描述一个能力应用的体验类型、提示词、Skill 目录和工具白名单 | 随代码版本化                 |
| ApplicationRuntimeSettings | 选择应用使用 Claude 或 CodeAgent，以及可选模型             | 管理员配置                   |
| Skill                      | 某模块独有的业务说明和配套文件                             | 内置或管理员配置             |
| ChatSession                | 知识问答的多轮业务记录                                     | `ready` 到终态，可继续下一轮 |
| AgentTask                  | 安全扫描/代码检视的一次性任务、报告和人工决策              | `queued` 到确认/驳回等终态   |
| Attempt                    | 一次不可覆盖的 Agent 执行                                  | 每轮消息或任务创建一个       |

Session/Task 创建时会快照应用的 Agent 和模型。管理员之后修改配置，不会改变已经创建的对象，保证审计时能还原当次运行策略。

## 执行链路

### 知识库问答

```text
选择知识库 → 创建 Session → 发送问题 → 创建 Attempt
→ 暂存当前模块 Skill → 生成含知识库 ID 的 system.md
→ 启动 Agent CLI → SSE 推送事件 → 保存回答与 Agent session_id
→ 下一轮使用 --resume
```

平台把线上知识库 ID 注入预制提示词，实际检索方式由知识库 Skill 提供。Agent 回复只能展示代码或操作建议，不能声称已经修改用户环境。

### 代码任务

```text
提交任务 → 准备隔离 Git workspace → 固化 commit/diff
→ 暂存模块 Skill → 启动 Agent CLI
→ Skill 写入标准产物 → 平台校验并展示
→ 用户确认或驳回
```

平台不把 Agent 最终聊天文本当作任务事实源。任务必须生成 `.ai-workbench/output/result.json` 和 `report.md`，详见[产物协议](../artifact-protocol.md)。

## 运行目录

```text
data/
├── store.json                         # 无 DATABASE_URL 时的业务数据
├── skills/<module>/<skill>/           # 管理台添加的 Skill
├── sessions/<session>/attempts/<id>/  # 问答执行记录与临时 Skill
└── tasks/<task>/
    ├── workspace/                     # 隔离代码仓和标准输入输出
    └── attempts/<id>/system.md
```

代码任务 workspace 是暂存副本。系统提示词禁止 Agent 修改业务代码，并只允许将平台产物写到 `.ai-workbench/output`。这是一层应用约束，不等价于操作系统级沙箱；生产环境仍应使用容器、低权限账号和网络/文件权限隔离。

## 扩展一个模块

新增能力通常需要：

1. 添加 `capabilities/<module-id>/module.json`、系统提示词和至少一个内置 Skill。
2. 若现有 `conversation`/`task` 体验和输入契约不能满足需求，在 `packages/contracts` 添加业务契约。
3. 在服务层实现准备、执行和结果适配器；通用 Runtime、Skill 暂存和存储不重复实现。
4. 在 Web 端注册入口、创建页、详情/报告页。
5. 添加单元/集成测试，并更新本页、模块文档和 API 文档。

详细清单见[模块扩展指南](../extending-modules.md)。

## 首版边界

- 暂未内置登录、租户、RBAC 和管理员审计；带入公司时应通过适配层接入。
- 暂未自动向 GitHub/GitLab 回写评论或状态；确认/驳回只记录在平台。
- PostgreSQL 表会自动创建，但尚未引入正式迁移框架。
- Agent CLI 和公司 Skill 不随镜像分发，需要在部署环境中安装并提供凭据。
- Task 状态当前由页面轮询，问答运行事件使用 SSE。
- 暂存工作区和历史 Attempt 不自动清理，生产环境需要配置保留策略。
