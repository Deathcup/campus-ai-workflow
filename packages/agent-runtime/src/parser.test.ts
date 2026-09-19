import { describe, expect, it } from "vitest";
import { normalizeCliLine } from "./parser.js";

describe("normalizeCliLine", () => {
  it("extracts a final result and session id", () => {
    expect(normalizeCliLine('{"type":"result","result":"完成","session_id":"abc"}')).toMatchObject({
      type: "result",
      finalText: "完成",
      sessionId: "abc"
    });
  });

  it("keeps non-json output observable", () => {
    expect(normalizeCliLine("diagnostic")).toEqual({
      type: "status",
      payload: { stream: "stdout", message: "diagnostic" }
    });
  });
});
