import type {
  AgentDescriptor,
  ApplicationRuntimeSettings,
  ChatSession,
  KnowledgeBase,
  ModuleManifest,
  Skill,
  UpsertSkillInput
} from "@campus-ai/contracts";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(body.error || `请求失败 (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  agents: () => request<AgentDescriptor[]>("/api/runtime/agents"),
  modules: () => request<ModuleManifest[]>("/api/modules"),
  applicationSettings: () => request<ApplicationRuntimeSettings[]>("/api/application-settings"),
  saveApplicationSettings: (moduleId: string, value: Pick<ApplicationRuntimeSettings, "agent" | "model">) =>
    request<ApplicationRuntimeSettings>(`/api/application-settings/${moduleId}`, {
      method: "PUT",
      body: JSON.stringify(value)
    }),
  knowledgeBases: () => request<KnowledgeBase[]>("/api/knowledge-bases"),
  saveKnowledgeBase: (value: Pick<KnowledgeBase, "id" | "name" | "description" | "enabled">) =>
    request<KnowledgeBase>("/api/knowledge-bases", { method: "POST", body: JSON.stringify(value) }),
  deleteKnowledgeBase: (id: string) =>
    request<void>(`/api/knowledge-bases/${encodeURIComponent(id)}`, { method: "DELETE" }),
  sessions: () => request<ChatSession[]>("/api/sessions"),
  session: (id: string) => request<ChatSession>(`/api/sessions/${id}`),
  createSession: (value: { title?: string; knowledgeBaseIds: string[]; moduleId: string }) =>
    request<ChatSession>("/api/sessions", { method: "POST", body: JSON.stringify(value) }),
  sendMessage: (id: string, content: string) =>
    request<ChatSession>(`/api/sessions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  cancel: (id: string) => request<void>(`/api/sessions/${id}/cancel`, { method: "POST" }),
  skills: (moduleId: string) => request<Skill[]>(`/api/modules/${moduleId}/skills`),
  createSkill: (moduleId: string, input: UpsertSkillInput) =>
    request<Skill>(`/api/modules/${moduleId}/skills`, { method: "POST", body: JSON.stringify(input) }),
  deleteSkill: (moduleId: string, skillId: string) =>
    request<void>(`/api/modules/${moduleId}/skills/${skillId}`, { method: "DELETE" })
};
