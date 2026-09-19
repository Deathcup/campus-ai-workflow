# Agent 产物交互协议

公司内部 Skill 可以保留自己的执行方式和中间产物，但任务结束前必须把最终结果适配为平台协议。平台不会把 Agent 的聊天文本当作唯一业务结果。

## 目录

```text
.ai-workbench/
├── input/
│   ├── task.json
│   └── change.diff        # 仅代码检视任务
└── output/
    ├── result.json
    ├── report.md
    └── artifacts/
```

平台负责生成 `input`，Agent 只能写入 `output`。`result.json` 与 `report.md` 缺少任意一个都会使任务失败。

平台当前接受且只接受协议 `1.0`。Skill 不应根据页面实现拼装非标准字段；需要增加字段时优先增加向后兼容的可选字段，并同时更新共享 Schema、reader、UI、示例和本协议。

## result.json

```json
{
  "schemaVersion": "1.0",
  "taskKind": "security-scan",
  "summary": "本次扫描发现 1 个高风险问题。",
  "verdict": "attention",
  "findings": [
    {
      "id": "SEC-001",
      "severity": "high",
      "confidence": "high",
      "category": "access-control",
      "title": "管理接口缺少授权校验",
      "description": "问题说明",
      "file": "src/admin.ts",
      "startLine": 42,
      "endLine": 48,
      "evidence": "可核查的代码证据",
      "recommendation": "修复建议"
    }
  ],
  "metrics": {
    "filesReviewed": 120,
    "findingCount": 1
  }
}
```

约束：

- `taskKind`：`security-scan` 或 `code-review`。
- `verdict`：`pass`、`attention` 或 `required_changes`。
- `severity`：`info`、`low`、`medium`、`high` 或 `critical`。
- `confidence`：`low`、`medium` 或 `high`。
- `id` 在单次报告中唯一且稳定。
- 代码检视意见应尽可能提供文件和行号。

## report.md 与 artifacts

`report.md` 是页面在线展示的完整报告，应包含基线、结论、发现、证据和建议。`artifacts` 可保存原始扫描 JSON、截图、图表等补充文件；平台只枚举安全的相对路径，不执行其中内容。

当前读取限制：`result.json` 最大约 5 MB，`report.md` 最大约 10 MB，最多枚举 100 个补充产物。产物必须使用 UTF-8。不要在报告、证据或补充文件中写入 token、Cookie、私钥、数据库密码或不必要的个人信息。

产物文件属于不可信输入。页面渲染 Markdown 时不得开放原始 HTML/脚本，下载服务不得接受调用方拼接的任意路径。新增文件预览类型前必须做内容类型、大小和权限校验。

## 校验与失败语义

以下情况会使任务进入 `failed`，而不是展示部分成功结果：

- 必需文件缺失、无法读取或超过大小限制。
- JSON 语法错误、`schemaVersion`/`taskKind` 不匹配。
- verdict、severity、confidence 或 finding 字段不符合 Schema。
- finding 超过数量限制，或补充文件枚举/元数据读取失败。

Skill 应尽量在本地写入临时文件并完成自身校验后再替换最终文件，避免平台读取到半成品。即使扫描器自身失败，也不要伪造 `pass`；应让 Agent 执行失败并把原因留在运行日志中。

## Skill 适配建议

公司 Skill 可以在最后增加一个“AI Workbench adapter”步骤：读取其原始输出，去重并映射严重度，然后写入上述标准文件。系统提示词会重复注入协议，因此业务 Skill 无需依赖平台源码。

模块具体要求见[代码仓安全扫描](modules/security-scan.md)和[MR/PR 代码检视](modules/code-review.md)。
