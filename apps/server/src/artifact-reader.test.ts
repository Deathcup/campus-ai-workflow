import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTaskOutput } from "./artifact-reader.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("readTaskOutput", () => {
  it("validates and loads standard task output", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "campus-ai-output-"));
    directories.push(workspace);
    const output = path.join(workspace, ".ai-workbench", "output");
    await mkdir(path.join(output, "artifacts"), { recursive: true });
    await writeFile(
      path.join(output, "result.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        taskKind: "security-scan",
        summary: "扫描完成",
        verdict: "pass",
        findings: [],
        metrics: { filesReviewed: 12 }
      }),
      "utf8"
    );
    await writeFile(path.join(output, "report.md"), "# 扫描报告", "utf8");
    await writeFile(path.join(output, "artifacts", "raw.json"), "{}", "utf8");

    const result = await readTaskOutput(workspace, "security-scan");
    expect(result.result.verdict).toBe("pass");
    expect(result.reportMarkdown).toBe("# 扫描报告");
    expect(result.artifacts).toEqual([
      { path: "raw.json", name: "raw.json", mediaType: "application/json", size: 2 }
    ]);
  });

  it("rejects output for another task kind", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "campus-ai-output-"));
    directories.push(workspace);
    const output = path.join(workspace, ".ai-workbench", "output");
    await mkdir(output, { recursive: true });
    await writeFile(
      path.join(output, "result.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        taskKind: "code-review",
        summary: "检视完成",
        verdict: "pass",
        findings: [],
        metrics: {}
      }),
      "utf8"
    );
    await writeFile(path.join(output, "report.md"), "# 报告", "utf8");
    await expect(readTaskOutput(workspace, "security-scan")).rejects.toThrow("taskKind");
  });
});
