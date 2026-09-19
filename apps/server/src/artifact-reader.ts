import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  AgentTaskResultSchema,
  TaskArtifactSchema,
  type AgentTaskResult,
  type TaskArtifact,
  type TaskKind
} from "@campus-ai/contracts";

export type TaskOutput = {
  result: AgentTaskResult;
  reportMarkdown: string;
  artifacts: TaskArtifact[];
};

export async function readTaskOutput(workspaceDir: string, expectedKind: TaskKind): Promise<TaskOutput> {
  const outputRoot = path.join(workspaceDir, ".ai-workbench", "output");
  const resultPath = path.join(outputRoot, "result.json");
  const reportPath = path.join(outputRoot, "report.md");
  const [resultText, reportMarkdown] = await Promise.all([
    readLimited(resultPath, 5_000_000),
    readLimited(reportPath, 10_000_000)
  ]).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Agent 未生成标准产物，请确认模块 Skill 遵循 AI Workbench 产物协议");
    }
    throw error;
  });
  const result = AgentTaskResultSchema.parse(JSON.parse(resultText));
  if (result.taskKind !== expectedKind) throw new Error("Agent 产物 taskKind 与当前任务不一致");
  return { result, reportMarkdown, artifacts: await listArtifacts(path.join(outputRoot, "artifacts")) };
}

async function readLimited(file: string, maxBytes: number): Promise<string> {
  const metadata = await stat(file);
  if (metadata.size > maxBytes) throw new Error(`产物 ${path.basename(file)} 超过 ${maxBytes} 字节限制`);
  return await readFile(file, "utf8");
}

async function listArtifacts(root: string): Promise<TaskArtifact[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true, recursive: true });
    const files: TaskArtifact[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || files.length >= 100) continue;
      const item = entry as typeof entry & { parentPath?: string; path?: string };
      const parent = item.parentPath ?? item.path ?? root;
      const absolute = path.join(parent, entry.name);
      const relative = path.relative(root, absolute);
      if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
      const metadata = await stat(absolute);
      files.push(
        TaskArtifactSchema.parse({
          path: relative,
          name: entry.name,
          mediaType: mediaType(entry.name),
          size: metadata.size
        })
      );
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function mediaType(name: string): string {
  const extension = path.extname(name).toLowerCase();
  return (
    {
      ".json": "application/json",
      ".md": "text/markdown",
      ".txt": "text/plain",
      ".html": "text/html",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    }[extension] ?? "application/octet-stream"
  );
}
