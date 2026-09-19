# 部署与运维

## 本地开发与验收

要求 Node.js 20+、Git，并至少安装一个兼容 Agent CLI。

```bash
npm install
cp .env.example .env
npm run dev
```

Web 开发服务器默认位于 `http://localhost:4173`，API 位于 `http://localhost:4100`。没有 Agent 或代码平台凭据时，设置 `AGENT_MOCK=true` 可验证三条完整 UI/API 链路。

提交前统一运行：

```bash
npm run verify
npm audit --omit=dev --audit-level=high
```

`verify` 会检查格式、TypeScript、测试、文档本地链接和生产构建。

## 单进程生产运行

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

生产服务会从同一个 Fastify 进程提供 `/api/*`、`/events/*` 和前端静态文件。反向代理需要允许 SSE 长连接，并关闭对事件流的响应缓冲。

## Docker Compose

```bash
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up --build -d
```

Compose 启动 Workbench 和 PostgreSQL，页面位于 `http://localhost:4100`。镜像包含 Git、OpenSSH client 和 CA 证书，但不会分发 Claude/CodeAgent CLI。真实执行时应构建公司派生镜像，在其中安装经批准的 CLI，并通过 secret 注入凭据；直接把 macOS 主机二进制挂载到 Linux 容器通常不可用。

首次只做演示可在 `deploy/.env` 设置：

```env
AGENT_MOCK=true
```

## Git 与 Agent 凭据

任务 Git 命令设置了 `GIT_TERMINAL_PROMPT=0`，不会等待交互输入。私有仓库必须提前配置无交互认证：

- HTTPS：凭据助手、只读 token 或公司代理。
- SSH：只读 deploy key、受控 `known_hosts` 和正确的文件权限。
- Agent：由 Claude/CodeAgent CLI 支持的环境变量、配置文件或工作负载身份。

部署账号应只拥有读取目标仓库和调用所需模型的最小权限。平台首版不会回写仓库或 MR/PR，因此不应授予写权限。

## 健康与上线前检查

1. `GET /api/health` 返回 `status: ok`。
2. `GET /api/runtime/agents` 中目标 Runtime 的 `available` 为 `true`。
3. 管理台中每个启用应用都有 Runtime 设置和至少一个启用 Skill。
4. 创建模拟或低风险测试任务，确认报告进入 `waiting_user`，并能确认/驳回。
5. 检查数据目录、数据库和临时仓库磁盘配额。

## 数据备份与恢复

必须一起保护数据库/`store.json` 与 `DATA_DIR`：前者包含业务元数据，后者包含管理员 Skill、Attempt 和代码任务产物。

- JSON 模式：停止写入后备份整个 `DATA_DIR`。
- PostgreSQL 模式：使用 `pg_dump` 备份数据库，同时备份 `DATA_DIR/skills` 和需要保留的运行目录。
- 恢复时保持相同应用版本和目录权限，再启动服务并执行一次健康检查。

代码任务 workspace 可能包含公司源码，不应进入通用备份或长期归档，除非公司数据策略明确允许。建议后续实现按终态和保留期清理；在此之前由运维按任务目录精确清理，禁止对宽泛路径执行递归删除。

## 升级

1. 先备份数据库和持久化目录。
2. 在预发布环境运行 `npm ci && npm run verify`。
3. 阅读协议、模块清单和配置变更，必要时先升级公司 Skill adapter。
4. 停止旧实例，部署新版本，再验证健康、Runtime 可用性和一个端到端任务。

当前 PostgreSQL 仅通过 `CREATE TABLE IF NOT EXISTS` 初始化，没有正式迁移框架。涉及 schema 变更时必须随发布提供显式迁移和回滚说明。

## 常见故障

| 现象                       | 排查方向                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| Runtime 不可用             | CLI 是否在服务进程 `PATH`；命令变量是否正确；运行账号是否能执行      |
| Git 拉取失败               | URL/分支、DNS、CA、SSH known_hosts、只读凭据；命令不会弹交互提示     |
| 任务提示没有 Skill         | 模块是否有内置或管理台启用 Skill；目录是否可写                       |
| 任务执行完却失败           | 检查 `result.json`/`report.md` 是否存在、编码和 schema 是否符合 1.0  |
| 服务重启后显示 interrupted | 这是有意的恢复语义；首版不会自动重跑，保留目录供人工排查             |
| 页面收不到流式回答         | 反向代理是否支持 SSE、是否禁用缓冲、连接超时是否足够                 |
| 磁盘持续增长               | 检查 `data/tasks`、`data/sessions`；按公司保留策略清理明确的终态目录 |

日志当前输出到标准输出，生产环境应由容器平台集中采集，并对仓库 URL 中的凭据、模型令牌和源码内容做脱敏与访问控制。
