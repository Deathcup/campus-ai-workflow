# CodeAgent 接入指南

CodeAgent 被视为 Claude CLI 协议兼容 Runtime。核心平台只假设以下能力：

- `--print`
- `--output-format stream-json`
- `--append-system-prompt-file`
- `--model`
- `--resume`
- stdin 接收 Prompt
- JSON 事件包含可识别的 session ID 和最终结果

## 内部接入步骤

1. 在隔离环境执行 `codeagent --help` 和最小无工具调用。
2. 保存一份脱敏的事件字段说明，不保存真实内容。
3. 用 Fake CLI 编写协议契约测试。
4. 配置 `CODEAGENT_COMMAND` 和 `CODEAGENT_MODELS`。
5. 若事件仅字段不同，实现新的 parser/adapter，不在业务模块写条件分支。
6. 验证首轮、`--resume`、取消、超时、无效事件和非零退出。
7. 验证 `.codeagent/skills` 是否为实际自动加载目录；如果不同，只修改 staging adapter。

## 兼容性矩阵

内部仓应维护：

| Runtime   | CLI 版本 | stream-json | resume | model | skill root          | 已验证日期 |
| --------- | -------- | ----------- | ------ | ----- | ------------------- | ---------- |
| Claude    |          |             |        |       | `.claude/skills`    |            |
| CodeAgent |          |             |        |       | `.codeagent/skills` |            |

不要仅凭“协议相同”跳过测试。兼容层应容忍新增事件字段，但未知终态、缺失 session ID 和解析失败必须可观察。
