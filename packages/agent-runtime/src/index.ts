import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import type { AgentDescriptor, AgentKind } from "@campus-ai/contracts";
import { normalizeCliLine, type NormalizedCliEvent } from "./parser.js";

export type AgentRunInput = {
  runId: string;
  agent: AgentKind;
  cwd: string;
  prompt: string;
  systemPromptFile: string;
  model?: string;
  resumeSessionId?: string;
  timeoutMs?: number;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  mcpConfigFile?: string;
};

export type AgentRunResult = {
  exitCode: number;
  sessionId?: string;
  finalText: string;
};

export type EventSink = (event: NormalizedCliEvent) => void | Promise<void>;

export interface AgentRuntime {
  execute(input: AgentRunInput, onEvent: EventSink): Promise<AgentRunResult>;
  cancel(runId: string): Promise<void>;
  inspect(): Promise<AgentDescriptor[]>;
}

export type CliRuntimeOptions = {
  commands: Record<AgentKind, string>;
  models?: Record<AgentKind, Array<{ id: string; name: string }>>;
  mock?: boolean;
  allowedTools?: string[];
};

export class ClaudeCompatibleCliRuntime implements AgentRuntime {
  private readonly running = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(private readonly options: CliRuntimeOptions) {}

  async inspect(): Promise<AgentDescriptor[]> {
    return Promise.all(
      (["claude", "codeagent"] as const).map(async (id) => ({
        id,
        name: id === "claude" ? "Claude Code" : "CodeAgent",
        command: this.options.commands[id],
        available: this.options.mock || (await commandExists(this.options.commands[id])),
        protocol: "claude-cli-stream-json" as const,
        models: this.options.models?.[id] ?? []
      }))
    );
  }

  async execute(input: AgentRunInput, onEvent: EventSink): Promise<AgentRunResult> {
    if (this.options.mock) return this.executeMock(input, onEvent);

    const command = this.options.commands[input.agent];
    const argv = this.buildArgs(input);
    const child = spawn(command, argv, {
      cwd: input.cwd,
      env: {
        ...process.env,
        AI_WORKBENCH_RUN_ID: input.runId,
        AI_WORKBENCH_SKILLS_DIR: path.join(input.cwd, ".agent", "skills")
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.running.set(input.runId, child);

    let sessionId = input.resumeSessionId;
    let finalText = "";
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let eventChain = Promise.resolve();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGINT");
      setTimeout(() => child.kill("SIGTERM"), 3_000).unref();
    }, input.timeoutMs ?? 300_000);

    const consumeLine = async (line: string) => {
      const event = normalizeCliLine(line);
      if (!event) return;
      if (event.sessionId) sessionId = event.sessionId;
      if (event.finalText) finalText = event.finalText;
      await onEvent(event);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) eventChain = eventChain.then(() => consumeLine(line));
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuffer += chunk;
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? "";
      for (const line of lines) {
        eventChain = eventChain
          .then(() => onEvent({ type: "status", payload: { stream: "stderr", message: redact(line) } }))
          .then(() => undefined);
      }
    });

    child.stdin.end(input.prompt);

    return await new Promise<AgentRunResult>((resolve, reject) => {
      child.once("error", (error) => {
        clearTimeout(timeout);
        this.running.delete(input.runId);
        reject(new Error(`无法启动 ${input.agent} CLI (${command}): ${error.message}`));
      });
      child.once("close", async (code) => {
        clearTimeout(timeout);
        this.running.delete(input.runId);
        await eventChain;
        if (stdoutBuffer) await consumeLine(stdoutBuffer);
        if (stderrBuffer)
          await onEvent({ type: "status", payload: { stream: "stderr", message: redact(stderrBuffer) } });
        const exitCode = code ?? 1;
        if (timedOut) return reject(new Error(`Agent 运行超过 ${input.timeoutMs ?? 300_000}ms，已终止`));
        if (exitCode !== 0) return reject(new Error(`${input.agent} CLI 退出码 ${exitCode}`));
        resolve({ exitCode, sessionId, finalText });
      });
    });
  }

  async cancel(runId: string): Promise<void> {
    const child = this.running.get(runId);
    if (!child) return;
    child.kill("SIGINT");
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (this.running.has(runId)) child.kill("SIGTERM");
  }

  private buildArgs(input: AgentRunInput): string[] {
    const args = [
      "--bare",
      "--print",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "dontAsk",
      "--append-system-prompt-file",
      input.systemPromptFile,
      "--add-dir",
      input.cwd,
      "--allowedTools",
      (
        input.allowedTools ??
        this.options.allowedTools ?? ["Read", "Glob", "Grep", "WebFetch", "WebSearch"]
      ).join(",")
    ];
    if (input.mcpConfigFile) args.push("--mcp-config", input.mcpConfigFile, "--strict-mcp-config");
    if (input.maxBudgetUsd && input.maxBudgetUsd > 0)
      args.push("--max-budget-usd", String(input.maxBudgetUsd));
    if (input.model) args.push("--model", input.model);
    if (input.resumeSessionId) args.push("--resume", input.resumeSessionId);
    return args;
  }

  private async executeMock(input: AgentRunInput, onEvent: EventSink): Promise<AgentRunResult> {
    const sessionId = input.resumeSessionId ?? `mock-${input.runId}`;
    await onEvent({
      type: "status",
      payload: { type: "system", subtype: "init", session_id: sessionId },
      sessionId
    });
    const answer = `这是开发模式的模拟回复。已按当前会话选择的知识库整理问题：${input.prompt.slice(0, 120)}${input.prompt.length > 120 ? "…" : ""}`;
    await onEvent({ type: "text_delta", payload: { text: answer }, sessionId });
    await onEvent({ type: "result", payload: { result: answer }, sessionId, finalText: answer });
    return { exitCode: 0, sessionId, finalText: answer };
  }
}

async function commandExists(command: string): Promise<boolean> {
  if (command.includes("/") || command.includes("\\")) {
    try {
      await access(command);
      return true;
    } catch {
      return false;
    }
  }
  return await new Promise((resolve) => {
    const child = spawn(command, ["--version"], { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

function redact(value: string): string {
  return value.replace(/(api[_-]?key|token|secret|password)\s*[=:]\s*\S+/gi, "$1=[REDACTED]").slice(0, 4_000);
}

export { normalizeCliLine } from "./parser.js";
export type { NormalizedCliEvent } from "./parser.js";
