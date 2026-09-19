# 公司内外双仓协作手册

## 推荐模型

```text
外部私有仓（Upstream Core）
├── 通用平台底座
├── 通用 Capability
├── Mock / Fake Provider
├── 公开契约和迁移
└── 不含公司信息的测试
              ↓ 单向导入
公司内部仓（Downstream Product）
├── 上游核心代码
├── internal/adapters/auth
├── internal/adapters/codeagent
├── internal/capabilities/*
├── internal/skills/*
└── 内部部署、域名和凭据引用
```

核心原则是代码单向进入公司。内部代码、Diff、日志和 Prompt 不得回传外部环境。

## 什么放在哪里

| 内容                          | 外部核心仓     | 公司内部仓   |
| ----------------------------- | -------------- | ------------ |
| Runtime 接口、CLI 协议解析    | 是             | 从上游同步   |
| 通用知识问答/扫描 UI          | 是             | 从上游同步   |
| Fake 知识库、Fake SSO         | 是             | 可用于测试   |
| 公司登录、组织架构、权限规则  | 否             | 是           |
| 内部 CodeAgent 安装/认证      | 否             | 是           |
| 内部知识库 API、Skill、Prompt | 否             | 是           |
| 公司仓库地址、日志、截图      | 否             | 是           |
| 可复现且已脱敏的通用 Bug 修复 | 清洁重写后可以 | 先在内部验证 |

## 初始化内部仓

建议在公司 Git 中创建独立仓库，不直接把外部 GitHub 仓作为唯一 origin：

```bash
git clone <company-git-url> campus-ai-workflow-internal
cd campus-ai-workflow-internal
git remote add upstream <external-github-url>
git fetch upstream --tags
git merge --no-ff upstream/main
```

如果公司环境不能访问 GitHub，在外部生成只包含已发布 tag 的 Git Bundle，再通过公司允许的文件传输流程导入：

```bash
git bundle create campus-ai-workflow-v0.2.0.bundle v0.2.0
git fetch /approved/path/campus-ai-workflow-v0.2.0.bundle v0.2.0
```

## 日常同步

外部每次发布一个版本；内部不要持续追逐未完成的 main：

```bash
git fetch upstream --tags
git switch -c sync/upstream-v0.3.0
git merge --no-ff v0.3.0
npm ci
npm run verify
```

合并通过后在内部写一份升级记录：上游版本、冲突文件、迁移动作、验证结果和回滚 tag。

## 第二个功能应该怎么做

以“仓库安全扫描”为例：

1. 外部先定义通用 `SECURITY_SCAN` 输入、状态、Finding Schema 和模块 UI。
2. 外部使用 Fake Repository、Fake Scanner 和固定 JSON 结果完成全链路。
3. 发布 `v0.x.0`，附迁移和扩展点说明。
4. 内部创建 `internal/security-scan`，实现公司 Git、CodeAgent 和扫描 Skill 适配器。
5. 内部 Agent 比较上游契约与内部实现，生成影响清单，再执行合并。
6. 内部 CI 运行公司数据上的契约测试和回归测试。

这样内部 Agent 只需要完成“接口实现和冲突合并”，不需要重新设计平台架构。

## 内部发现通用 Bug 怎么办

不要把内部 commit、Diff 或日志带出公司。使用清洁描述流程：

1. 在内部确认根因属于通用核心还是内部适配。
2. 人工写一份不含公司标识、路径、数据和代码片段的最小复现说明。
3. 在外部用 Mock 独立复现并重新实现修复。
4. 外部发布补丁版本。
5. 内部通过正常上游同步拿回修复。

如果无法在 Mock 中复现，则修复只留在内部仓，不强求回流。

## 冲突控制

- 内部新增代码尽量集中在 `internal/` 或独立私有 package。
- 不直接修改 Runtime/parser；通过 Adapter 或配置扩展。
- 必须修改核心时，把改动限制为小的接口扩展，并记录内部 ADR。
- 内部不得长期维护整文件复制版本；否则每次上游同步都会成为人工重写。
- 对容易冲突的配置使用注册表/manifest，不使用散落的条件判断。

## 信息安全检查

向外部仓提交前，由人执行：

- `git diff --cached` 全量检查。
- Secret Scan。
- 搜索公司域名、内部 IP、仓库名、员工名和知识库 ID。
- 检查截图、测试快照、日志、fixtures 和 Git 历史。
- 确认实现来自外部 Mock/公开规范，而不是复制内部代码。

内部 Agent 可以帮助检查，但最终放行必须由人完成。
