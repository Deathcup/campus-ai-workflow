import path from "node:path";
import { ClaudeCompatibleCliRuntime } from "@campus-ai/agent-runtime";
import { ModuleCatalog, SkillRegistry } from "@campus-ai/skill-registry";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { EventBroker } from "./event-broker.js";
import { SessionService } from "./session-service.js";
import { JsonDataStore, PostgresDataStore, type DataStore } from "./store.js";
import { TaskService } from "./task-service.js";

const store: DataStore = config.databaseUrl
  ? new PostgresDataStore(config.databaseUrl)
  : new JsonDataStore(path.join(config.dataDir, "store.json"));
await store.init();

const catalog = new ModuleCatalog(config.capabilitiesDir);
const skills = new SkillRegistry(config.dataDir, catalog);
const runtime = new ClaudeCompatibleCliRuntime({
  commands: config.commands,
  models: config.models,
  mock: config.mockAgent
});
const events = new EventBroker();
const sessions = new SessionService(store, runtime, catalog, skills, events, config);
const tasks = new TaskService(store, runtime, catalog, skills, config);
await sessions.recoverInterruptedSessions();
await tasks.recoverInterruptedTasks();

const applicationSettings = await store.listApplicationSettings();
for (const module of await catalog.list()) {
  if (!applicationSettings.some((item) => item.moduleId === module.id)) {
    await store.putApplicationSettings({
      moduleId: module.id,
      agent: "claude",
      updatedAt: new Date().toISOString()
    });
  }
}

if ((await store.listKnowledgeBases()).length === 0) {
  const now = new Date().toISOString();
  await store.putKnowledgeBase({
    id: "campus-handbook",
    name: "校园办事手册",
    description: "演示知识库，请在管理设置中替换为线上知识库的真实 ID",
    enabled: true,
    createdAt: now,
    updatedAt: now
  });
  await store.putKnowledgeBase({
    id: "it-service-guide",
    name: "信息化服务指南",
    description: "账号、网络、软件与服务台相关知识",
    enabled: true,
    createdAt: now,
    updatedAt: now
  });
}

const app = await buildApp({
  store,
  runtime,
  catalog,
  skills,
  sessions,
  tasks,
  webDistDir: config.webDistDir
});
await app.listen({ host: config.host, port: config.port });

async function shutdown(signal: string) {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await store.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
