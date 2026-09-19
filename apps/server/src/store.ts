import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type {
  ApplicationRuntimeSettings,
  ChatSession,
  KnowledgeBase,
  RuntimeEvent
} from "@campus-ai/contracts";

export interface DataStore {
  init(): Promise<void>;
  close(): Promise<void>;
  listKnowledgeBases(): Promise<KnowledgeBase[]>;
  putKnowledgeBase(value: KnowledgeBase): Promise<void>;
  removeKnowledgeBase(id: string): Promise<void>;
  listApplicationSettings(): Promise<ApplicationRuntimeSettings[]>;
  putApplicationSettings(value: ApplicationRuntimeSettings): Promise<void>;
  listSessions(): Promise<ChatSession[]>;
  getSession(id: string): Promise<ChatSession | undefined>;
  putSession(value: ChatSession): Promise<void>;
  addEvent(value: RuntimeEvent): Promise<void>;
  listEvents(sessionId: string): Promise<RuntimeEvent[]>;
}

type JsonState = {
  knowledgeBases: KnowledgeBase[];
  applicationSettings: ApplicationRuntimeSettings[];
  sessions: ChatSession[];
  events: RuntimeEvent[];
};

const emptyState = (): JsonState => ({
  knowledgeBases: [],
  applicationSettings: [],
  sessions: [],
  events: []
});

export class JsonDataStore implements DataStore {
  private state: JsonState = emptyState();
  private writeChain = Promise.resolve();

  constructor(private readonly file: string) {}

  async init(): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    try {
      this.state = {
        ...emptyState(),
        ...(JSON.parse(await readFile(this.file, "utf8")) as Partial<JsonState>)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }
  }

  async close(): Promise<void> {
    await this.writeChain;
  }
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    return structuredClone(this.state.knowledgeBases);
  }
  async listSessions(): Promise<ChatSession[]> {
    return structuredClone(this.state.sessions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async listApplicationSettings(): Promise<ApplicationRuntimeSettings[]> {
    return structuredClone(this.state.applicationSettings);
  }
  async getSession(id: string): Promise<ChatSession | undefined> {
    return structuredClone(this.state.sessions.find((item) => item.id === id));
  }
  async listEvents(sessionId: string): Promise<RuntimeEvent[]> {
    return structuredClone(this.state.events.filter((event) => event.sessionId === sessionId));
  }

  async putKnowledgeBase(value: KnowledgeBase): Promise<void> {
    const index = this.state.knowledgeBases.findIndex((item) => item.id === value.id);
    if (index === -1) this.state.knowledgeBases.push(structuredClone(value));
    else this.state.knowledgeBases[index] = structuredClone(value);
    await this.persist();
  }

  async removeKnowledgeBase(id: string): Promise<void> {
    this.state.knowledgeBases = this.state.knowledgeBases.filter((item) => item.id !== id);
    await this.persist();
  }

  async putApplicationSettings(value: ApplicationRuntimeSettings): Promise<void> {
    const index = this.state.applicationSettings.findIndex((item) => item.moduleId === value.moduleId);
    if (index === -1) this.state.applicationSettings.push(structuredClone(value));
    else this.state.applicationSettings[index] = structuredClone(value);
    await this.persist();
  }

  async putSession(value: ChatSession): Promise<void> {
    const index = this.state.sessions.findIndex((item) => item.id === value.id);
    if (index === -1) this.state.sessions.push(structuredClone(value));
    else this.state.sessions[index] = structuredClone(value);
    await this.persist();
  }

  async addEvent(value: RuntimeEvent): Promise<void> {
    this.state.events.push(structuredClone(value));
    if (this.state.events.length > 20_000) this.state.events = this.state.events.slice(-20_000);
    await this.persist();
  }

  private async persist(): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, JSON.stringify(this.state, null, 2), "utf8");
      await rename(temporary, this.file);
    });
    await this.writeChain;
  }
}

export class PostgresDataStore implements DataStore {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id text PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id uuid PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS application_settings (
        module_id text PRIMARY KEY,
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS runtime_events (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS runtime_events_session_idx ON runtime_events(session_id, created_at);
    `);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    return (await this.pool.query("SELECT payload FROM knowledge_bases ORDER BY payload->>'name'")).rows.map(
      (row) => row.payload as KnowledgeBase
    );
  }
  async listSessions(): Promise<ChatSession[]> {
    return (await this.pool.query("SELECT payload FROM chat_sessions ORDER BY updated_at DESC")).rows.map(
      (row) => row.payload as ChatSession
    );
  }
  async listApplicationSettings(): Promise<ApplicationRuntimeSettings[]> {
    return (await this.pool.query("SELECT payload FROM application_settings ORDER BY module_id")).rows.map(
      (row) => row.payload as ApplicationRuntimeSettings
    );
  }
  async getSession(id: string): Promise<ChatSession | undefined> {
    return (await this.pool.query("SELECT payload FROM chat_sessions WHERE id = $1", [id])).rows[0]
      ?.payload as ChatSession | undefined;
  }
  async listEvents(sessionId: string): Promise<RuntimeEvent[]> {
    return (
      await this.pool.query("SELECT payload FROM runtime_events WHERE session_id = $1 ORDER BY created_at", [
        sessionId
      ])
    ).rows.map((row) => row.payload as RuntimeEvent);
  }
  async putKnowledgeBase(value: KnowledgeBase): Promise<void> {
    await this.pool.query(
      "INSERT INTO knowledge_bases(id, payload, updated_at) VALUES($1, $2, now()) ON CONFLICT(id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()",
      [value.id, value]
    );
  }
  async removeKnowledgeBase(id: string): Promise<void> {
    await this.pool.query("DELETE FROM knowledge_bases WHERE id = $1", [id]);
  }
  async putApplicationSettings(value: ApplicationRuntimeSettings): Promise<void> {
    await this.pool.query(
      "INSERT INTO application_settings(module_id, payload, updated_at) VALUES($1, $2, now()) ON CONFLICT(module_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()",
      [value.moduleId, value]
    );
  }
  async putSession(value: ChatSession): Promise<void> {
    await this.pool.query(
      "INSERT INTO chat_sessions(id, payload, updated_at) VALUES($1, $2, now()) ON CONFLICT(id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()",
      [value.id, value]
    );
  }
  async addEvent(value: RuntimeEvent): Promise<void> {
    await this.pool.query(
      "INSERT INTO runtime_events(id, session_id, payload, created_at) VALUES($1, $2, $3, $4)",
      [value.id, value.sessionId, value, value.createdAt]
    );
  }
}
