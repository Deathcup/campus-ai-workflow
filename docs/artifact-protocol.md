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

## Skill 适配建议

公司 Skill 可以在最后增加一个“AI Workbench adapter”步骤：读取其原始输出，去重并映射严重度，然后写入上述标准文件。系统提示词会重复注入协议，因此业务 Skill 无需依赖平台源码。
