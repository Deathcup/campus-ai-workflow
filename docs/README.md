# 文档中心

本文档中心同时面向平台使用者、管理员、开发者和公司内部集成人员。第一次接触项目时，建议先阅读平台总览，再按职责进入对应文档。

## 平台文档

- [平台架构与边界](platform/overview.md)：平台分层、核心对象、执行链路、目录结构和首版边界。
- [配置参考](platform/configuration.md)：环境变量、应用级 Runtime、知识库、Skill 和模块清单配置。
- [部署与运维](platform/deployment-operations.md)：本地/容器部署、凭据、健康检查、备份、升级和故障处理。
- [HTTP API 参考](platform/api-reference.md)：当前接口分组、输入输出与异步执行约定。
- [会话与任务协议](task-protocol.md)：Session、Task、Attempt 的状态和持久化约定。
- [Agent 产物交互协议](artifact-protocol.md)：任务结果如何适配为平台可校验、可展示的标准产物。
- [Skill 契约](skill-contract.md)：模块 Skill 的结构、装载和隔离规则。

## 模块文档

- [知识库问答](modules/knowledge-qa.md)：知识库选择、多轮会话、检索提示词和能力边界。
- [代码仓安全扫描](modules/security-scan.md)：仓库/分支输入、隔离工作区、报告和确认流程。
- [MR/PR 代码检视](modules/code-review.md)：支持的链接、差异准备、检视报告和人工决策。

## 开发文档

- [开发总则](development/development-guide.md)
- [前端开发指南](development/frontend-guide.md)
- [后端开发指南](development/backend-guide.md)
- [测试与发布](development/testing-guide.md)
- [模块扩展指南](extending-modules.md)
- [贡献指南](../CONTRIBUTING.md)

## 公司集成与协作

- [公司内外双仓协作](integration/internal-external-collaboration.md)
- [内部 Agent 使用手册](integration/internal-agent-playbook.md)
- [后续能力开发手册](integration/second-capability-playbook.md)
- [CodeAgent 接入](integration/codeagent-guide.md)
- [登录系统接入](integration/auth-integration-guide.md)

## 文档维护规则

功能、接口、配置或运行目录发生变化时，代码变更必须同步更新对应平台文档和模块文档。提交前运行 `npm run verify`；该命令包含 Markdown 本地链接检查。
