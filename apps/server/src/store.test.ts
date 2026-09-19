import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonDataStore } from "./store.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("JsonDataStore", () => {
  it("persists knowledge bases across instances", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "campus-ai-store-"));
    directories.push(directory);
    const file = path.join(directory, "store.json");
    const now = new Date().toISOString();
    const first = new JsonDataStore(file);
    await first.init();
    await first.putKnowledgeBase({
      id: "kb-1",
      name: "测试库",
      description: "",
      enabled: true,
      createdAt: now,
      updatedAt: now
    });
    await first.putApplicationSettings({
      moduleId: "knowledge-qa",
      agent: "codeagent",
      model: "company-model",
      updatedAt: now
    });
    await first.close();

    const second = new JsonDataStore(file);
    await second.init();
    expect(await second.listKnowledgeBases()).toEqual([
      { id: "kb-1", name: "测试库", description: "", enabled: true, createdAt: now, updatedAt: now }
    ]);
    expect(await second.listApplicationSettings()).toEqual([
      {
        moduleId: "knowledge-qa",
        agent: "codeagent",
        model: "company-model",
        updatedAt: now
      }
    ]);
    await second.close();
  });
});
