export type NormalizedCliEvent = {
  type: "status" | "text_delta" | "tool" | "result" | "error";
  payload: Record<string, unknown>;
  sessionId?: string;
  finalText?: string;
};

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (block): block is { type: string; text?: string } =>
        Boolean(block) && typeof block === "object" && "type" in block
    )
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");
}

export function normalizeCliLine(line: string): NormalizedCliEvent | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { type: "status", payload: { stream: "stdout", message: trimmed } };
  }

  const sessionId = typeof value.session_id === "string" ? value.session_id : undefined;
  if (value.type === "result") {
    const finalText = typeof value.result === "string" ? value.result : "";
    return {
      type: value.is_error ? "error" : "result",
      payload: value,
      sessionId,
      finalText
    };
  }

  if (value.type === "assistant") {
    const message = value.message as { content?: unknown } | undefined;
    const text = textFromContent(message?.content);
    if (text) return { type: "text_delta", payload: { text, raw: value }, sessionId };
  }

  if (value.type === "content_block_delta") {
    const delta = value.delta as { text?: unknown } | undefined;
    if (typeof delta?.text === "string") {
      return { type: "text_delta", payload: { text: delta.text }, sessionId };
    }
  }

  if (value.type === "tool_use" || value.type === "tool_result") {
    return { type: "tool", payload: value, sessionId };
  }

  return { type: "status", payload: value, sessionId };
}
