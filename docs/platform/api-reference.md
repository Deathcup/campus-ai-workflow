# HTTP API 参考

API 默认前缀为 `/api`。请求和响应使用 JSON；问答实时事件使用 SSE。字段的最终约束以 `packages/contracts/src/index.ts` 中的 Zod schema 为准。

## 平台与管理

| 方法   | 路径                                     | 用途                                         |
| ------ | ---------------------------------------- | -------------------------------------------- |
| GET    | `/api/health`                            | 健康检查                                     |
| GET    | `/api/runtime/agents`                    | 查看 Claude/CodeAgent 命令、可用性和模型建议 |
| GET    | `/api/modules`                           | 列出启用模块清单                             |
| GET    | `/api/application-settings`              | 列出所有应用 Runtime 设置                    |
| PUT    | `/api/application-settings/:moduleId`    | 更新一个应用的 Agent 与可选模型              |
| GET    | `/api/knowledge-bases`                   | 列出知识库引用                               |
| POST   | `/api/knowledge-bases`                   | 新增/更新知识库引用                          |
| DELETE | `/api/knowledge-bases/:id`               | 删除知识库引用                               |
| GET    | `/api/modules/:moduleId/skills`          | 列出模块 Skill                               |
| POST   | `/api/modules/:moduleId/skills`          | 新增模块 Skill                               |
| DELETE | `/api/modules/:moduleId/skills/:skillId` | 删除管理员 Skill                             |

更新应用设置示例：

```json
{ "agent": "codeagent", "model": "company-model-id" }
```

模型可省略。知识库和 Skill 的维护接口在接入公司登录后应限制为管理员权限。

## 知识问答 Session

| 方法 | 路径                         | 用途                       |
| ---- | ---------------------------- | -------------------------- |
| GET  | `/api/sessions`              | 列出知识问答会话           |
| GET  | `/api/sessions/:id`          | 获取会话及完整消息         |
| POST | `/api/sessions`              | 创建会话                   |
| POST | `/api/sessions/:id/messages` | 发送一轮消息，后台异步执行 |
| POST | `/api/sessions/:id/cancel`   | 取消当前运行               |
| GET  | `/api/sessions/:id/events`   | 获取已保存事件快照         |
| GET  | `/events/sessions/:id`       | 订阅 SSE 实时事件          |

创建请求：

```json
{
  "title": "可选标题",
  "moduleId": "knowledge-qa",
  "knowledgeBaseIds": ["kb-hr", "kb-it"]
}
```

发送消息：

```json
{ "content": "请汇总这两个知识库中的入职流程。" }
```

消息接口在持久化用户消息后立即返回 Session；回答通过 SSE 到达，完成后也会写回 Session。客户端断线后可重新获取 Session 和事件快照。

## Agent Task

| 方法 | 路径                      | 用途                             |
| ---- | ------------------------- | -------------------------------- |
| GET  | `/api/tasks`              | 列出安全扫描和代码检视任务       |
| GET  | `/api/tasks/:id`          | 获取任务、基线、报告和决策       |
| POST | `/api/tasks`              | 创建异步任务                     |
| POST | `/api/tasks/:id/cancel`   | 取消当前运行                     |
| POST | `/api/tasks/:id/decision` | 对 `waiting_user` 报告确认或驳回 |

安全扫描请求：

```json
{
  "kind": "security-scan",
  "repositoryUrl": "git@github.example.com:team/service.git",
  "branch": "main"
}
```

代码检视请求：

```json
{
  "kind": "code-review",
  "mergeRequestUrl": "https://gitlab.example.com/team/service/-/merge_requests/42"
}
```

人工决策：

```json
{ "action": "confirm", "note": "已核对高风险项，将进入整改。" }
```

任务创建后立即返回 `queued` 对象。客户端应轮询任务详情，直到 `waiting_user`、`failed`、`canceled` 或 `interrupted`；`waiting_user` 之后才能提交决策。确认/驳回不会自动修改仓库或调用代码平台 API。

## 错误与兼容性

输入会由 Zod 校验，业务前置条件失败会返回错误信息。调用方不应依赖中文 message 做程序分支；公司集成阶段建议引入稳定的错误 `code` 和统一 HTTP 状态映射。

API 当前没有公开版本前缀。向后不兼容的字段变更应先扩展契约、保持旧字段一个发布周期，再通过 ADR 决定是否引入 `/api/v1`。
