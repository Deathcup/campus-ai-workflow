# 会话与 Attempt 协议

平台有两类业务对象：知识问答使用可多轮恢复的 Session；安全扫描和代码检视使用一次性 Task。每次 Agent 执行都创建不可覆盖的 Attempt。

```text
ChatSession
├── agent: claude | codeagent
├── knowledgeBaseIds[]
├── agentSessionId
└── attempts/<attempt-id>
    ├── system.md
    ├── request.json
    ├── result.json
    ├── .agent/skills/
    └── .claude/skills/ 或 .codeagent/skills/
```

首次运行不带 `--resume`；成功后保存 stream-json 中的 `session_id`。下一轮带 `--resume <session_id>`。平台自身保存完整消息记录，Agent Session 不是业务数据的唯一真值源。

代码任务目录：

```text
data/tasks/<task-id>/
├── workspace/                    # 确定 commit 的隔离代码目录
│   ├── .agent/skills/            # 仅当前模块 Skill
│   └── .ai-workbench/
│       ├── input/task.json
│       ├── input/change.diff     # 仅 MR/PR 检视
│       └── output/               # 标准产物
└── attempts/<attempt-id>/
    └── system.md
```

任务完成后进入 `waiting_user`，用户确认后为 `confirmed`，驳回后为 `rejected`。确认动作只记录平台决策，首版不会自动向代码平台发表评论或修改源码。

## 状态机

知识问答 Session：

```text
ready → running → succeeded
          ├────→ failed
          ├────→ canceled
          └────→ interrupted（服务重启恢复）

succeeded | failed | canceled | interrupted → running（用户再次发送消息）
```

代码 Task：

```text
queued → preparing → running → waiting_user → confirmed | rejected
   │          │          ├────→ failed
   │          │          └────→ canceled
   └──────────┴───────────────→ interrupted（服务重启恢复）
```

Task 的 `waiting_user` 表示 Agent 执行已经结束、产物已经通过平台校验，但仍需人工决定。首版没有失败任务原地重试；需要重新创建任务，以保留旧 Attempt 的不可变审计记录。

服务启动时遗留的 Session `running`，以及 Task `queued`/`preparing`/`running`，都会被标记为 `interrupted`，不会自动重放可能有副作用的步骤。

## 不变量

- Attempt 创建后不覆盖；同一 Session 的下一轮创建新 Attempt。
- Session/Task 内保存的是创建时的应用 Agent/模型快照。
- Agent session ID 只用于 Runtime 恢复，不是业务记录的唯一真值源。
- Task 只有通过标准产物校验才能进入 `waiting_user`。
- 确认或驳回只允许在 `waiting_user` 状态执行一次。
