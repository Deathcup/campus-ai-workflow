# 内部 Agent 使用手册

GLM-5.2 足以承担契约对照、机械合并、测试补齐和适配器实现。不要让它在没有约束时重构核心架构；把任务拆成可验证的小步骤。

## 推荐职责

- 比较两个 tag/branch 的契约变化。
- 标记内部修改与上游修改的交叉文件。
- 生成迁移清单和回归测试清单。
- 按现有 Port 实现内部 Adapter。
- 修复类型错误、测试失败和小范围合并冲突。
- 检查内部信息是否误入准备外发的暂存区。

不建议直接授权：大规模目录重构、替换状态模型、绕过接口直连内部服务、删除迁移或安全边界。

## 上游同步提示词模板

```text
你正在公司内部同步 Campus AI Workbench 上游版本。
必须遵守 docs/development 和 docs/integration 中的规范。

目标：把 <old-tag> 升级到 <new-tag>。
约束：
1. 不改变 internal/ 下的业务语义和凭据管理。
2. 不把 internal/ 内容输出到外部位置。
3. 先只读比较 contracts、Runtime、Store、module manifest 和数据库变化。
4. 输出：变化摘要、冲突列表、迁移顺序、风险、回滚点、测试清单。
5. 得到人工确认后再按文件组逐步合并。
6. 每组完成后运行最小测试，最后运行 npm run verify。
```

## 内部 Adapter 提示词模板

```text
实现 <adapter-name>，只允许修改 internal/adapters/<name>、注册配置和对应测试。
不得修改 AgentRuntime/DataStore/Contracts；如果接口不足，先停止并提交最小接口扩展建议。
使用 Fake 实现编写契约测试，凭据只能从运行环境读取，不得写入日志、Prompt 或 fixture。
完成后说明注册方式、失败模式、回滚方式和验证命令。
```

## 冲突处理顺序

1. Schema/Contract。
2. 数据迁移。
3. Application Service。
4. Adapter。
5. API Route。
6. UI。
7. 文档和测试快照。

不要先解决 UI 冲突再猜后端契约。一个冲突如果需要改变稳定边界，应交回外部架构维护者设计，不让内部 Agent 临场发明。

## 人工评审清单

- 是否把内部逻辑放进了通用目录？
- 是否扩大了 Agent 工具权限？
- 是否把凭据或内部数据写进事件？
- 是否绕过 Zod/Port 直接调用服务？
- 是否有旧版本数据迁移和回滚？
- 是否完成 Claude 和 CodeAgent 两套 Runtime 冒烟？
