---
name: code-review-output-adapter
description: 完成 MR/PR 检视后，将任意原始结果转换为 AI Workbench 标准产物。始终在任务结束前调用。
---

# 代码检视产物适配

本 Skill 不替代公司的代码检视 Skill。先完成实际检视，再执行本适配步骤。

1. 只保留具体、可执行、与当前 diff 有关的意见。
2. 将结构化结果写入 `.ai-workbench/output/result.json`，严格遵循系统提示词中的协议。
3. 将完整检视报告写入 `.ai-workbench/output/report.md`。
4. 每条行级意见尽量包含 `file`、`startLine`、`endLine`、`evidence` 和 `recommendation`。
5. 没有阻塞问题时使用 `verdict: pass`；需要修改后合并时使用 `required_changes`。

不得向远端 MR/PR 发表评论，不得修改业务源码，不得只在最终回复里粘贴报告。
