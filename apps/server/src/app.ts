import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import {
  CreateSessionInputSchema,
  KnowledgeBaseSchema,
  SendMessageInputSchema,
  UpdateApplicationRuntimeSettingsSchema,
  UpsertSkillInputSchema
} from "@campus-ai/contracts";
import type { AgentRuntime } from "@campus-ai/agent-runtime";
import type { ModuleCatalog, SkillRegistry } from "@campus-ai/skill-registry";
import type { DataStore } from "./store.js";
import type { SessionService } from "./session-service.js";

type Dependencies = {
  store: DataStore;
  runtime: AgentRuntime;
  catalog: ModuleCatalog;
  skills: SkillRegistry;
  sessions: SessionService;
  webDistDir: string;
};

export async function buildApp(deps: Dependencies) {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ status: "ok", time: new Date().toISOString() }));
  app.get("/api/runtime/agents", async () => await deps.runtime.inspect());
  app.get("/api/modules", async () => await deps.catalog.list());

  app.get("/api/application-settings", async () => await deps.store.listApplicationSettings());
  app.put("/api/application-settings/:moduleId", async (request) => {
    const { moduleId } = request.params as { moduleId: string };
    await deps.catalog.get(moduleId);
    const input = UpdateApplicationRuntimeSettingsSchema.parse(request.body);
    const value = { moduleId, ...input, updatedAt: new Date().toISOString() };
    await deps.store.putApplicationSettings(value);
    return value;
  });

  app.get("/api/knowledge-bases", async () => await deps.store.listKnowledgeBases());
  app.post("/api/knowledge-bases", async (request, reply) => {
    const partial = KnowledgeBaseSchema.omit({ createdAt: true, updatedAt: true }).parse(request.body);
    const existing = (await deps.store.listKnowledgeBases()).find((item) => item.id === partial.id);
    const now = new Date().toISOString();
    const value = KnowledgeBaseSchema.parse({
      ...partial,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    await deps.store.putKnowledgeBase(value);
    return reply.code(existing ? 200 : 201).send(value);
  });
  app.delete("/api/knowledge-bases/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.store.removeKnowledgeBase(id);
    return reply.code(204).send();
  });

  app.get("/api/modules/:moduleId/skills", async (request) => {
    const { moduleId } = request.params as { moduleId: string };
    return await deps.skills.list(moduleId);
  });
  app.post("/api/modules/:moduleId/skills", async (request, reply) => {
    const { moduleId } = request.params as { moduleId: string };
    const input = UpsertSkillInputSchema.parse(request.body);
    return reply.code(201).send(await deps.skills.create(moduleId, input));
  });
  app.delete("/api/modules/:moduleId/skills/:skillId", async (request, reply) => {
    const { moduleId, skillId } = request.params as { moduleId: string; skillId: string };
    if (skillId.startsWith("builtin-"))
      return reply.code(400).send({ error: "内置 Skill 不可删除，可新增替代版本并停用旧版本" });
    await deps.skills.remove(moduleId, skillId);
    return reply.code(204).send();
  });

  app.get("/api/sessions", async () => await deps.store.listSessions());
  app.get("/api/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = await deps.store.getSession(id);
    return session ?? reply.code(404).send({ error: "会话不存在" });
  });
  app.post("/api/sessions", async (request, reply) => {
    const input = CreateSessionInputSchema.parse(request.body);
    return reply.code(201).send(await deps.sessions.create(input));
  });
  app.post("/api/sessions/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = SendMessageInputSchema.parse(request.body);
    return reply.code(202).send(await deps.sessions.sendMessage(id, input.content));
  });
  app.post("/api/sessions/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.sessions.cancel(id);
    return reply.code(202).send({ status: "canceling" });
  });
  app.get("/api/sessions/:id/events", async (request) => {
    const { id } = request.params as { id: string };
    return await deps.store.listEvents(id);
  });
  app.get("/events/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ id: randomUUID() })}\n\n`);
    const unsubscribe = deps.sessions.events.subscribe(id, (event) => {
      reply.raw.write(`event: runtime\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 20_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const status =
      normalized.name === "ZodError"
        ? 400
        : /不存在|未启用/.test(normalized.message)
          ? 404
          : /正在生成|不可用|尚未配置/.test(normalized.message)
            ? 409
            : 500;
    app.log.error(error);
    reply.code(status).send({ error: normalized.message });
  });

  try {
    await access(`${deps.webDistDir}/index.html`);
    await app.register(fastifyStatic, { root: deps.webDistDir, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/events/"))
        return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  } catch {
    app.get("/", async (_request, reply) =>
      reply.type("text/plain").send("Campus AI Workbench API is running. Start the Vite web app for the UI.")
    );
  }
  return app;
}
