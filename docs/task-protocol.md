# 会话与 Attempt 协议

平台会话对应一个可多轮恢复的 Agent Session；每条用户消息创建一个不可覆盖的 Attempt。

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

状态为 `ready → running → succeeded | failed | canceled`。服务启动时遗留的 `running` 会被标记为 `interrupted`。
