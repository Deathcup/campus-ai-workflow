# 模块 Skill 契约

每个能力模块拥有独立 Skill 集合。Skill 至少包含：

- `skill.json`：ID、名称、版本、说明和启用状态。
- `SKILL.md`：Agent 可读取的完整操作指令。
- `files/`：可选的脚本、参考资料或模板。

内置 Skill 位于 `capabilities/<module>/skills`，管理员添加的版本位于 `data/skills/<module>`。运行时两者合并，只复制启用项到新的 Attempt。

管理员提交的 supporting file 路径必须是相对路径，服务端会拒绝绝对路径和 `..` 路径逃逸。

知识库 Skill 应明确：真实数据源调用方式、知识库 ID 参数位置、返回字段、引用规范、无结果策略和错误策略。不得把凭据写入 Skill；凭据由 Runtime 环境或 MCP 配置提供。
