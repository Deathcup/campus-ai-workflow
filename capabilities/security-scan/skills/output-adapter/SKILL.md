---
name: security-scan-output-adapter
description: 完成安全扫描后，将任意原始结果转换为 AI Workbench 标准产物。始终在任务结束前调用。
---

# 安全扫描产物适配

本 Skill 不替代公司的安全扫描 Skill。先完成实际扫描，再执行本适配步骤。

1. 汇总并去重扫描发现，为每项生成稳定 `id`。
2. 将结构化结果写入 `.ai-workbench/output/result.json`，严格遵循系统提示词中的协议。
3. 将适合人工阅读的完整报告写入 `.ai-workbench/output/report.md`。
4. 原始扫描文件、图表或补充证据可以放入 `.ai-workbench/output/artifacts/`。
5. 不确定的问题必须降低 `confidence`；没有发现时使用 `verdict: pass` 和空 `findings`。

不得修改业务源码，不得只在最终回复里粘贴报告。
