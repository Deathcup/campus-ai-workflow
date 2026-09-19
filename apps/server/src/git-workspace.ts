import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateAgentTaskInput, TaskBaseline } from "@campus-ai/contracts";

export type PreparedWorkspace = {
  workspaceDir: string;
  baseline: TaskBaseline;
};

export class GitWorkspace {
  constructor(
    private readonly dataDir: string,
    private readonly mock = false
  ) {}

  async prepare(taskId: string, input: CreateAgentTaskInput): Promise<PreparedWorkspace> {
    const workspaceDir = path.join(this.dataDir, "tasks", taskId, "workspace");
    const inputDir = path.join(workspaceDir, ".ai-workbench", "input");
    await mkdir(path.dirname(workspaceDir), { recursive: true });

    if (this.mock) {
      const source =
        input.kind === "security-scan"
          ? input.repositoryUrl
          : parseMergeRequestUrl(input.mergeRequestUrl).repositoryUrl;
      const requestedRef = input.kind === "security-scan" ? input.branch : input.mergeRequestUrl;
      await mkdir(inputDir, { recursive: true });
      await writeFile(
        path.join(workspaceDir, "README.md"),
        "# Mock repository\n\nThis workspace is generated only for the local AGENT_MOCK preview.\n",
        "utf8"
      );
      return {
        workspaceDir,
        baseline: {
          repositoryUrl: source,
          requestedRef,
          commitSha: `mock-${taskId.replaceAll("-", "").slice(0, 12)}`,
          ...(input.kind === "code-review"
            ? {
                baseSha: `mock-base-${taskId.replaceAll("-", "").slice(0, 8)}`,
                changeUrl: input.mergeRequestUrl
              }
            : {})
        }
      };
    }

    if (input.kind === "security-scan") {
      assertRepositoryUrl(input.repositoryUrl);
      await validateBranch(input.branch);
      await runGit([
        "clone",
        "--no-tags",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        input.branch,
        "--",
        input.repositoryUrl,
        workspaceDir
      ]);
      const commitSha = await runGit(["rev-parse", "HEAD"], workspaceDir);
      return {
        workspaceDir,
        baseline: {
          repositoryUrl: input.repositoryUrl,
          requestedRef: input.branch,
          commitSha
        }
      };
    }

    const change = parseMergeRequestUrl(input.mergeRequestUrl);
    await runGit(["clone", "--no-tags", "--no-checkout", "--", change.repositoryUrl, workspaceDir]);
    const defaultRef = await runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], workspaceDir);
    await runGit(["fetch", "--no-tags", "origin", change.fetchRef], workspaceDir);
    await runGit(["checkout", "--detach", "FETCH_HEAD"], workspaceDir);
    const commitSha = await runGit(["rev-parse", "HEAD"], workspaceDir);
    const baseSha = await runGit(["merge-base", "HEAD", defaultRef], workspaceDir);
    const diff = await runGit(
      ["diff", "--no-ext-diff", "--unified=40", `${baseSha}...${commitSha}`],
      workspaceDir,
      8_000_000
    );
    await mkdir(inputDir, { recursive: true });
    await writeFile(path.join(inputDir, "change.diff"), diff, "utf8");
    return {
      workspaceDir,
      baseline: {
        repositoryUrl: change.repositoryUrl,
        requestedRef: change.fetchRef,
        commitSha,
        baseSha,
        changeUrl: input.mergeRequestUrl
      }
    };
  }
}

export function parseMergeRequestUrl(value: string): {
  provider: "github" | "gitlab";
  repositoryUrl: string;
  fetchRef: string;
  number: number;
} {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("MR/PR 链接必须使用 HTTP(S)");
  const pathname = url.pathname.replace(/\/$/, "");
  const github = pathname.match(/^\/(.+)\/pull\/(\d+)$/);
  if (github) {
    const repositoryPath = github[1]!.replace(/\.git$/, "");
    const number = Number(github[2]!);
    return {
      provider: "github",
      repositoryUrl: `${url.origin}/${repositoryPath}.git`,
      fetchRef: `refs/pull/${number}/head`,
      number
    };
  }
  const gitlab = pathname.match(/^\/(.+)\/-\/merge_requests\/(\d+)$/);
  if (gitlab) {
    const repositoryPath = gitlab[1]!.replace(/\.git$/, "");
    const number = Number(gitlab[2]!);
    return {
      provider: "gitlab",
      repositoryUrl: `${url.origin}/${repositoryPath}.git`,
      fetchRef: `refs/merge-requests/${number}/head`,
      number
    };
  }
  throw new Error("仅支持 GitHub PR 或 GitLab MR 链接");
}

function assertRepositoryUrl(value: string): void {
  if (/[\r\n\0]/.test(value) || value.startsWith("-")) throw new Error("代码仓地址格式无效");
  if (/^[\w.-]+@[\w.-]+:[\w./-]+(?:\.git)?$/.test(value)) return;
  const url = new URL(value);
  if (!["https:", "ssh:"].includes(url.protocol)) throw new Error("代码仓仅支持 HTTPS 或 SSH 地址");
}

async function validateBranch(branch: string): Promise<void> {
  if (/[\r\n\0]/.test(branch) || branch.startsWith("-")) throw new Error("分支名称格式无效");
  await runGit(["check-ref-format", "--branch", branch]);
}

async function runGit(args: string[], cwd?: string, maxBytes = 2_000_000): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGINT");
      setTimeout(() => child.kill("SIGTERM"), 2_000).unref();
    }, 180_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > maxBytes) child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`无法启动 Git: ${error.message}`));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (stdout.length > maxBytes) return reject(new Error("Git 输出超过平台限制"));
      if (code !== 0) return reject(new Error(`Git 操作失败：${redact(stderr.trim()) || `退出码 ${code}`}`));
      resolve(stdout.trim());
    });
  });
}

function redact(value: string): string {
  return value.replace(/(https?:\/\/)[^/@\s]+@/g, "$1[REDACTED]@");
}
