# 第二个能力开发手册

新增能力前回答四个问题：业务对象是什么、输入是什么、终态结果是什么、是否有外部副作用。不要从页面长相倒推数据模型。

## 示例：仓库安全扫描

建议业务模型：

```text
SecurityScanTask
├── repositoryRef
├── resolvedCommitSha
├── runtime + model
├── attempts[]
├── findings[]
└── decisions[]
```

它不是 ChatSession。可复用的是 Attempt、Event、Runtime、Skill、Artifact 和状态机。

## 外部开发阶段

1. 新增 contracts：输入、Finding、事件和结果。
2. 新增 `capabilities/security-scan/module.json`、Prompt 和通用 Skill 模板。
3. 使用 Fake Repository Provider，fixtures 只含人工构造代码。
4. 实现模块自己的任务列表、创建页和 Finding 详情。
5. 用 Fake Runtime 打通全链路。
6. 发布带 tag 的版本和迁移说明。

## 内部接入阶段

1. 内部 Agent 只读比较新 tag 与当前基线。
2. 合并通用核心。
3. 实现公司 Git Provider、CodeAgent 配置和内部扫描 Skill。
4. 接入权限和审计。
5. 在脱敏测试仓验证，再逐步开放真实仓库。

## 扩展验收

- 全局侧栏只新增能力入口，没有出现全局“会话历史”。
- 安全扫描使用 Task/Finding 语义。
- commit SHA 固化，结果可追溯。
- 扫描默认只读。
- Agent 不持有代码平台写权限。
- 内部适配代码集中，不污染通用模块。
