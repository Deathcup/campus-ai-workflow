# 测试与发布指南

## 测试金字塔

1. 契约/纯函数测试：Schema、事件解析、状态转换、路径校验。
2. Adapter 测试：使用假的 CLI 进程、临时目录和测试数据库。
3. API 测试：Fastify inject 覆盖状态码、校验和错误映射。
4. 浏览器测试：只覆盖关键用户路径，不依赖真实模型。
5. Runtime 冒烟：在受控环境中分别调用 Claude 和 CodeAgent。

真实模型测试不得作为普通 CI 的硬依赖，避免成本和不稳定性。CI 使用确定性的 fake runtime；发布前再执行人工 Runtime 冒烟。

## 合并门禁

```bash
npm run format:check
npm run check
npm test
npm run docs:check
npm run build
npm audit --omit=dev --audit-level=high
```

本地可用 `npm run verify` 一次执行前五项。文档链接检查只验证仓库内本地目标；外部链接的可用性应在发布评审时抽查。

公司内部还应增加：Secret Scan、SAST、制品签名、许可证清单和容器镜像扫描。

## 版本与发布

- 使用语义化版本。
- 每个导入公司的版本打 `vX.Y.Z` tag。
- Release Notes 分为 Added、Changed、Fixed、Security、Migration。
- 内部仓记录 `UPSTREAM_VERSION` 或等价文件，明确当前基线。
- 破坏性契约变更必须升主版本；新增可选字段升次版本；兼容修复升补丁版本。

## 回归清单

- 两种 Agent 可用性展示正确。
- 应用配置留空模型与显式模型时的 argv 都正确，普通业务请求不能覆盖应用策略。
- 新 Attempt 只包含当前模块 Skill。
- 首轮、多轮恢复、取消、超时和服务重启行为正确。
- 知识库问答的历史只出现在模块内，创建/发送/恢复链路正确。
- 安全扫描能固化仓库、分支和 commit；标准产物错误时不能进入等待确认。
- 代码检视能解析支持的 GitHub/GitLab 链接，固化 head/base/diff，并明确非默认目标分支限制。
- Task 报告可以查看，且只有 `waiting_user` 能确认或驳回；决策不产生外部写操作。
- PostgreSQL 重启后数据仍可读取。
- 页面在桌面和窄屏下无阻塞操作。

三个模块的专属用例分别维护在[知识库问答](../modules/knowledge-qa.md)、[代码仓安全扫描](../modules/security-scan.md)和[MR/PR 代码检视](../modules/code-review.md)。
