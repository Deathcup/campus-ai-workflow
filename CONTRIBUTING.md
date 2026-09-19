# 贡献指南

本项目同时面向外部通用开发和公司内部集成。任何改动都必须先判断属于“通用核心”还是“内部适配”，再决定提交位置。

## 开始开发

```bash
npm ci
cp .env.example .env
AGENT_MOCK=true npm run dev
```

提交前执行：

```bash
npm run verify
```

`verify` 是统一质量门禁，包含格式、类型检查、单元测试和生产构建。任何面向主分支的变更都不得绕过。

## 分支与提交

- `main` 始终保持可构建、可部署。
- 功能分支使用 `feat/<scope>-<name>`。
- 修复分支使用 `fix/<scope>-<name>`。
- 同步外部版本使用 `sync/upstream-v<version>`。
- 内部专属分支使用 `internal/<scope>-<name>`，不得推送到外部仓库。
- 提交信息采用 Conventional Commits，例如 `feat(knowledge-qa): add model selector`。

一次提交只解决一个逻辑问题。不要把格式化、依赖升级和业务变更混在同一提交中。

## Pull Request 要求

- 说明问题、解决方案、影响范围和回滚方式。
- 标注改动属于核心、能力模块还是内部适配层。
- API 或持久化结构变化必须写迁移/兼容策略。
- UI 变化附桌面与窄屏截图。
- Agent Runtime 变化必须提供生成的 argv 示例，禁止在日志中包含凭据。
- 架构边界变化必须新增 ADR。

## 严禁提交

- 公司源码、内部域名、真实仓库地址、员工信息和真实知识库内容。
- Token、Cookie、密码、私钥、`.env` 和带认证信息的 MCP 配置。
- 内部 Skill、内部提示词、登录系统实现和 CodeAgent 私有安装细节。
- 从内部代码直接复制、仅做变量改名后的“通用实现”。

详见 [开发总则](docs/development/development-guide.md) 和 [公司内外协作](docs/integration/internal-external-collaboration.md)。
