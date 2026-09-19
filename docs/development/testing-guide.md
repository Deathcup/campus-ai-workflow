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
npm run build
npm audit --omit=dev --audit-level=high
```

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
- PostgreSQL 重启后数据仍可读取。
- 页面在桌面和窄屏下无阻塞操作。
