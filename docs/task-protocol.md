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

状态为 `ready → running → succeeded | failed | canceled`。服务启动时遗留的 `running` 会被标记为 `interrupted`。
