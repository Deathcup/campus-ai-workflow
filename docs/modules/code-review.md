# MR/PR 代码检视模块

## 目标

用户提供 GitHub Pull Request 或 GitLab Merge Request 链接。平台准备 head 提交和确定 diff，调用模块 Skill 检视变更，并在本地页面展示报告供人工确认。

## 支持的链接

```text
https://github.example.com/group/repository/pull/123
https://gitlab.example.com/group/repository/-/merge_requests/123
```

支持 GitHub（包括兼容的企业域名）`/pull/:number` 与 GitLab `/-/merge_requests/:iid` 路径。首版从同一 HTTP(S) origin 推导 `.git` 地址，并获取：

- GitHub：`refs/pull/<number>/head`
- GitLab：`refs/merge-requests/<iid>/head`

代码平台必须暴露这些 ref，且部署环境具备无交互读取权限。不支持任意网页链接，也不调用提供商 REST API。

## 执行流程

1. 解析 MR/PR 链接并克隆仓库（不立即 checkout）。
2. 解析 `origin/HEAD` 作为默认基线分支。
3. fetch 变更 ref，分离 checkout 到 `FETCH_HEAD`。
4. 计算 head 与默认分支的 merge-base，生成最多约 8 MB 的统一 diff。
5. 将基线写入 `task.json`，diff 写入 `change.diff`。
6. 装载 `code-review` Skill，Agent 检视当前 workspace 和确定 diff。
7. 校验标准产物，页面展示后由用户确认或驳回。

## 公司 Skill 要求

公司检视 Skill 应优先检查本次变更引入的问题，而不是罗列所有历史问题，并约定：

- 语言、框架、架构和公司规范。
- 正确性、安全性、并发、性能、兼容性和测试覆盖的关注点。
- 评论严重度、置信度、文件和行号定位规则。
- 如何避免仅基于风格偏好产生阻断意见。
- 如何从内部报告转换为 [Agent 产物交互协议](../artifact-protocol.md)。

`change.diff` 是平台准备的审计输入；Skill 也可读取 checkout 后的完整代码来理解上下文，但不得修改业务代码。

## 报告与确认

报告至少应说明 head/base SHA、总体结论、逐条发现、证据和建议。确认/驳回只保存在本地平台，不会向 GitHub/GitLab 发布 review、评论或 commit status。

如果以后增加回写，建议新增独立的“发布检视”动作：要求用户二次确认、使用最小写权限 token，并保存外部请求 ID 和审计日志，避免把“确认本地报告”隐式解释为“同意向外部系统写入”。

## 已知限制

- base 目前使用仓库 `origin/HEAD`，没有读取 MR/PR API 中声明的目标分支；目标不是默认分支时可能不准确。
- fork PR、关闭后 ref 被回收、平台关闭 ref 暴露时可能无法 fetch。
- 大于平台限制的 diff 会失败，不会静默截断后给出完整性结论。
- 页面首版使用轮询任务状态，没有实时 token 流。

## 验收用例

- GitHub PR 和 GitLab MR 各验证一个，核对 head/base SHA 和变更文件。
- 使用目标非默认分支的 MR 验证当前限制，并在上线前决定是否接入提供商 API。
- 无效链接、私有仓库凭据失败、ref 不存在和超大 diff 都给出明确失败状态。
- 发现包含文件/行号时页面正确展示，Markdown 报告可以在线阅读。
- 确认/驳回不触发任何外部写操作。
