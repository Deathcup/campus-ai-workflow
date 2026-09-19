import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  AgentDescriptor,
  AgentTask,
  ApplicationRuntimeSettings,
  ChatSession,
  KnowledgeBase,
  ModuleManifest,
  Skill
} from "@campus-ai/contracts";
import {
  ArrowUp,
  AlertTriangle,
  BookOpen,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Link2,
  LoaderCircle,
  Menu,
  MessageSquareText,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  XCircle,
  X
} from "lucide-react";
import { api } from "./api";

type View = "knowledge-qa" | "security-scan" | "code-review" | "settings";
type SettingsTab = "applications" | "knowledge" | "skills" | "runtime";

export function App() {
  const [view, setView] = useState<View>("knowledge-qa");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("applications");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const [modules, setModules] = useState<ModuleManifest[]>([]);
  const [applicationSettings, setApplicationSettings] = useState<ApplicationRuntimeSettings[]>([]);
  const [error, setError] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refresh = async () => {
    try {
      const [nextSessions, nextTasks, nextBases, nextAgents, nextModules, nextApplicationSettings] =
        await Promise.all([
          api.sessions(),
          api.tasks(),
          api.knowledgeBases(),
          api.agents(),
          api.modules(),
          api.applicationSettings()
        ]);
      setSessions(nextSessions);
      setTasks(nextTasks);
      setKnowledgeBases(nextBases);
      setAgents(nextAgents);
      setModules(nextModules);
      setApplicationSettings(nextApplicationSettings);
      setError(undefined);
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);
  const hasActiveTasks = tasks.some((task) => ["queued", "preparing", "running"].includes(task.status));
  useEffect(() => {
    if (!hasActiveTasks) return;
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [hasActiveTasks]);
  const selected = sessions.find((session) => session.id === selectedId);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const selectSession = (id: string) => {
    setSelectedId(id);
    setView("knowledge-qa");
    setSidebarOpen(false);
  };

  const switchView = (next: View) => {
    setView(next);
    if (next === "security-scan" || next === "code-review") setSelectedTaskId(undefined);
    setSidebarOpen(false);
  };

  const pageTitle =
    view === "settings"
      ? "管理设置"
      : view === "security-scan"
        ? (selectedTask?.title ?? "代码仓安全扫描")
        : view === "code-review"
          ? (selectedTask?.title ?? "代码检视")
          : (selected?.title ?? "知识库问答");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} strokeWidth={2.2} />
          </div>
          <div>
            <strong>Campus AI</strong>
            <span>Workbench</span>
          </div>
          <button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="nav-section-title">能力应用</div>
        <nav className="main-nav">
          <button
            className={view === "knowledge-qa" ? "active" : ""}
            onClick={() => switchView("knowledge-qa")}
          >
            <MessageSquareText size={17} /> 知识问答
          </button>
          <button
            className={view === "security-scan" ? "active" : ""}
            onClick={() => switchView("security-scan")}
          >
            <ShieldCheck size={17} /> 安全扫描
          </button>
          <button
            className={view === "code-review" ? "active" : ""}
            onClick={() => switchView("code-review")}
          >
            <GitPullRequest size={17} /> 代码检视
          </button>
        </nav>
        <div className="nav-section-title admin-title">平台</div>
        <nav className="main-nav admin-nav">
          <button className={view === "settings" ? "active" : ""} onClick={() => switchView("settings")}>
            <Settings size={17} /> 管理设置
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">AI</div>
          <div>
            <strong>平台管理员</strong>
            <span>本地工作区</span>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <span className="eyebrow">AI WORKBENCH</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="system-state">
            <span className="pulse" /> 服务运行中
          </div>
        </header>

        {error && (
          <div className="global-error">
            <span>{error}</span>
            <button onClick={() => setError(undefined)}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === "knowledge-qa" ? (
          <KnowledgeWorkspace
            sessions={sessions}
            selected={selected}
            onSelect={selectSession}
            onNew={() => setSelectedId(undefined)}
            knowledgeBases={knowledgeBases}
            modules={modules}
            onCreated={(session) => {
              setSessions((all) => [session, ...all]);
              setSelectedId(session.id);
            }}
            onRefresh={refresh}
            onError={setError}
          />
        ) : view === "security-scan" || view === "code-review" ? (
          <TaskWorkspace
            kind={view}
            tasks={tasks}
            selected={selectedTask?.kind === view ? selectedTask : undefined}
            onSelect={setSelectedTaskId}
            onNew={() => setSelectedTaskId(undefined)}
            onCreated={(task) => {
              setTasks((all) => [task, ...all]);
              setSelectedTaskId(task.id);
            }}
            onRefresh={refresh}
            onError={setError}
          />
        ) : (
          <SettingsView
            tab={settingsTab}
            onTab={setSettingsTab}
            knowledgeBases={knowledgeBases}
            agents={agents}
            modules={modules}
            applicationSettings={applicationSettings}
            onRefresh={refresh}
            onError={setError}
          />
        )}
      </main>
      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}

function KnowledgeWorkspace({
  sessions,
  selected,
  onSelect,
  onNew,
  knowledgeBases,
  modules,
  onCreated,
  onRefresh,
  onError
}: {
  sessions: ChatSession[];
  selected?: ChatSession;
  onSelect: (id: string) => void;
  onNew: () => void;
  knowledgeBases: KnowledgeBase[];
  modules: ModuleManifest[];
  onCreated: (session: ChatSession) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="knowledge-workspace">
      <aside className="module-sidebar">
        <div className="module-sidebar-head">
          <div>
            <span>知识库问答</span>
            <strong>会话</strong>
          </div>
          <button
            className="module-new"
            disabled={!selected}
            onClick={onNew}
            title={!selected ? "当前已在新建会话页面" : "新建会话"}
          >
            <Plus size={15} />
            新建会话
          </button>
        </div>
        <div className="module-history">
          {sessions
            .filter((session) => session.moduleId === "knowledge-qa")
            .map((session) => (
              <button
                key={session.id}
                className={session.id === selected?.id ? "selected" : ""}
                onClick={() => onSelect(session.id)}
              >
                <span className={`status-dot ${session.status}`} />
                <span className="history-copy">
                  <strong>{session.title}</strong>
                  <small>{timeAgo(session.updatedAt)}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
          {sessions.filter((session) => session.moduleId === "knowledge-qa").length === 0 && (
            <div className="module-empty">
              <MessageSquareText size={20} />
              <span>暂无问答会话</span>
            </div>
          )}
        </div>
      </aside>
      <section className="module-content">
        {selected ? (
          <ChatView
            session={selected}
            knowledgeBases={knowledgeBases}
            onRefresh={onRefresh}
            onError={onError}
          />
        ) : (
          <NewSession
            knowledgeBases={knowledgeBases}
            modules={modules}
            onCreated={onCreated}
            onError={onError}
          />
        )}
      </section>
    </div>
  );
}

function NewSession({
  knowledgeBases,
  modules,
  onCreated,
  onError
}: {
  knowledgeBases: KnowledgeBase[];
  modules: ModuleManifest[];
  onCreated: (session: ChatSession) => void;
  onError: (message: string) => void;
}) {
  const [selectedBases, setSelectedBases] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const enabledBases = knowledgeBases.filter((item) => item.enabled);
  const module = modules.find((item) => item.id === "knowledge-qa");

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedBases.length === 0) return onError("请至少选择一个知识库");
    setSaving(true);
    try {
      onCreated(
        await api.createSession({
          title: title || undefined,
          knowledgeBaseIds: selectedBases,
          moduleId: module?.id ?? "knowledge-qa"
        })
      );
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-scroll start-page">
      <section className="hero">
        <div className="hero-icon">
          <BookOpen size={28} />
        </div>
        <span className="section-kicker">KNOWLEDGE ASSISTANT</span>
        <h2>从团队知识中，找到可信答案</h2>
        <p>选择一个或多个在线知识库，创建相互隔离的问答会话。每次回答都只加载该模块已批准的 Skill。</p>
      </section>

      <form className="session-builder" onSubmit={create}>
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span>01</span>
              <h3>选择知识库</h3>
            </div>
            <small>可多选 · 使用 ID 作为检索 Key</small>
          </div>
          <div className="knowledge-grid">
            {enabledBases.map((base) => {
              const selected = selectedBases.includes(base.id);
              return (
                <button
                  type="button"
                  key={base.id}
                  className={`knowledge-card ${selected ? "selected" : ""}`}
                  onClick={() =>
                    setSelectedBases((ids) =>
                      selected ? ids.filter((id) => id !== base.id) : [...ids, base.id]
                    )
                  }
                >
                  <span className="database-icon">
                    <Database size={19} />
                  </span>
                  <span>
                    <strong>{base.name}</strong>
                    <small>{base.description}</small>
                    <code>{base.id}</code>
                  </span>
                  <span className="check-box">{selected && <Check size={14} />}</span>
                </button>
              );
            })}
            {enabledBases.length === 0 && <div className="inline-empty">请先到“管理设置”添加知识库。</div>}
          </div>
        </div>

        <div className="builder-row single-column">
          <div className="form-section compact">
            <div className="section-heading">
              <div>
                <span>02</span>
                <h3>会话名称</h3>
              </div>
              <small>可选</small>
            </div>
            <input
              className="text-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：新生入学政策梳理"
              maxLength={100}
            />
            <p className="field-note">
              <Sparkles size={14} /> 留空时将根据知识库自动命名
            </p>
          </div>
        </div>
        <div className="create-row">
          <span>已选择 {selectedBases.length} 个知识库 · 运行策略由管理员统一配置</span>
          <button className="primary-button" disabled={saving || selectedBases.length === 0}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <ArrowUp size={17} />} 创建会话
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatView({
  session,
  knowledgeBases,
  onRefresh,
  onError
}: {
  session: ChatSession;
  knowledgeBases: KnowledgeBase[];
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const [liveText, setLiveText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const bases = knowledgeBases.filter((base) => session.knowledgeBaseIds.includes(base.id));

  useEffect(() => {
    const source = new EventSource(`/events/sessions/${session.id}`);
    source.addEventListener("runtime", (event) => {
      const parsed = JSON.parse((event as MessageEvent).data) as {
        type: string;
        payload: { text?: string; status?: string; message?: string };
      };
      if (parsed.type === "text_delta" && parsed.payload.text)
        setLiveText((text) => text + parsed.payload.text);
      if (parsed.type === "error") {
        onError(parsed.payload.message ?? "Agent 运行失败");
        setLiveText("");
        void onRefresh();
      }
      if (parsed.payload.status === "succeeded") {
        setLiveText("");
        void onRefresh();
      }
    });
    return () => source.close();
  }, [session.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages.length, liveText]);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() || session.status === "running") return;
    const content = input.trim();
    setInput("");
    setLiveText("");
    try {
      await api.sendMessage(session.id, content);
      await onRefresh();
    } catch (cause) {
      setInput(content);
      onError(messageOf(cause));
    }
  };

  return (
    <div className="chat-layout">
      <div className="chat-meta">
        <div className="meta-chips">
          {bases.map((base) => (
            <span key={base.id}>
              <Database size={13} />
              {base.name}
            </span>
          ))}
        </div>
        <div className="run-meta">
          <span className={`status-badge ${session.status}`}>{statusLabel(session.status)}</span>
        </div>
      </div>
      <div className="messages">
        {session.messages.length === 0 && (
          <div className="chat-empty">
            <div>
              <MessageSquareText size={28} />
            </div>
            <h2>开始提问</h2>
            <p>Agent 会自动读取当前模块 Skill，并只在你选择的知识库范围内检索。</p>
          </div>
        )}
        {session.messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === "user" ? "你" : message.role === "assistant" ? <Sparkles size={17} /> : "!"}
            </div>
            <div className="message-body">
              <div className="message-label">
                {message.role === "user" ? "你" : message.role === "assistant" ? session.agent : "系统"}
                <time>{formatTime(message.createdAt)}</time>
              </div>
              <div className="message-content">{message.content}</div>
            </div>
          </article>
        ))}
        {session.status === "running" && (
          <article className="message assistant live">
            <div className="message-avatar">
              <Sparkles size={17} />
            </div>
            <div className="message-body">
              <div className="message-label">
                {session.agent}
                <span className="thinking">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <div className="message-content">{liveText || "正在检索知识库并整理答案…"}</div>
            </div>
          </article>
        )}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={send}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="询问所选知识库中的内容…"
          rows={1}
        />
        {session.status === "running" ? (
          <button
            type="button"
            className="stop-button"
            onClick={() => void api.cancel(session.id).then(onRefresh)}
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button className="send-button" disabled={!input.trim()}>
            <ArrowUp size={18} />
          </button>
        )}
        <small>Enter 发送 · Shift + Enter 换行 · 回答可能需要核实</small>
      </form>
    </div>
  );
}

function TaskWorkspace({
  kind,
  tasks,
  selected,
  onSelect,
  onNew,
  onCreated,
  onRefresh,
  onError
}: {
  kind: "security-scan" | "code-review";
  tasks: AgentTask[];
  selected?: AgentTask;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCreated: (task: AgentTask) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const config =
    kind === "security-scan"
      ? { name: "代码仓安全扫描", listName: "扫描任务", empty: "暂无扫描任务", icon: ShieldCheck }
      : { name: "代码检视", listName: "检视任务", empty: "暂无检视任务", icon: GitPullRequest };
  const moduleTasks = tasks.filter((task) => task.kind === kind);
  const Icon = config.icon;
  return (
    <div className="knowledge-workspace task-workspace">
      <aside className="module-sidebar">
        <div className="module-sidebar-head">
          <div>
            <span>{config.name}</span>
            <strong>{config.listName}</strong>
          </div>
          <button
            className="module-new"
            disabled={!selected}
            onClick={onNew}
            title={!selected ? "当前已在新建任务页面" : "新建任务"}
          >
            <Plus size={15} /> 新建任务
          </button>
        </div>
        <div className="module-history">
          {moduleTasks.map((task) => (
            <button
              key={task.id}
              className={task.id === selected?.id ? "selected" : ""}
              onClick={() => onSelect(task.id)}
            >
              <span className={`status-dot ${task.status}`} />
              <span className="history-copy">
                <strong>{task.title}</strong>
                <small>
                  {taskStatusLabel(task.status)} · {timeAgo(task.updatedAt)}
                </small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
          {moduleTasks.length === 0 && (
            <div className="module-empty">
              <Icon size={20} />
              <span>{config.empty}</span>
            </div>
          )}
        </div>
      </aside>
      <section className="module-content">
        {selected ? (
          <TaskDetail task={selected} onRefresh={onRefresh} onError={onError} />
        ) : (
          <NewTask kind={kind} onCreated={onCreated} onError={onError} />
        )}
      </section>
    </div>
  );
}

function NewTask({
  kind,
  onCreated,
  onError
}: {
  kind: "security-scan" | "code-review";
  onCreated: (task: AgentTask) => void;
  onError: (message: string) => void;
}) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [mergeRequestUrl, setMergeRequestUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const isScan = kind === "security-scan";
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      onCreated(
        await api.createTask(
          isScan ? { kind: "security-scan", repositoryUrl, branch } : { kind: "code-review", mergeRequestUrl }
        )
      );
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="content-scroll start-page task-start-page">
      <section className="hero task-hero">
        <div className="hero-icon">{isScan ? <ShieldCheck size={28} /> : <GitPullRequest size={28} />}</div>
        <span className="section-kicker">{isScan ? "REPOSITORY SECURITY" : "MERGE REQUEST REVIEW"}</span>
        <h2>{isScan ? "扫描确定版本，留下可核查证据" : "检视代码差异，合并前由人确认"}</h2>
        <p>
          {isScan
            ? "平台会创建隔离任务目录，自动拉取指定分支并解析 commit，再调用该模块的 Skill。"
            : "平台会解析 GitHub PR 或 GitLab MR，准备 head 代码和确定差异，再生成本地检视报告。"}
        </p>
      </section>
      <form className="task-create-card" onSubmit={create}>
        <div className="task-create-heading">
          <div>
            <span>NEW TASK</span>
            <h3>{isScan ? "创建安全扫描任务" : "创建代码检视任务"}</h3>
          </div>
          <span className="managed-runtime-note">
            <Sparkles size={13} /> Agent 与模型由管理员配置
          </span>
        </div>
        {isScan ? (
          <>
            <label>
              <span>代码仓地址</span>
              <div className="input-with-icon">
                <Link2 size={16} />
                <input
                  required
                  value={repositoryUrl}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                  placeholder="https://git.example.com/team/project.git"
                />
              </div>
              <small>支持 HTTPS 或 SSH 地址；私有仓权限由部署环境统一提供。</small>
            </label>
            <label>
              <span>扫描分支</span>
              <div className="input-with-icon">
                <GitBranch size={16} />
                <input required value={branch} onChange={(event) => setBranch(event.target.value)} />
              </div>
            </label>
          </>
        ) : (
          <label>
            <span>MR / PR 链接</span>
            <div className="input-with-icon">
              <GitPullRequest size={16} />
              <input
                required
                type="url"
                value={mergeRequestUrl}
                onChange={(event) => setMergeRequestUrl(event.target.value)}
                placeholder="https://github.com/org/repo/pull/123"
              />
            </div>
            <small>支持 GitHub Pull Request 和 GitLab Merge Request 标准链接。</small>
          </label>
        )}
        <div className="task-create-footer">
          <span>
            <FileCode2 size={14} /> 结果将按标准产物协议保存并等待人工确认
          </span>
          <button className="primary-button" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <ArrowUp size={16} />}
            {saving ? "正在创建" : "创建并开始"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TaskDetail({
  task,
  onRefresh,
  onError
}: {
  task: AgentTask;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const active = ["queued", "preparing", "running"].includes(task.status);
  const decide = async (action: "confirm" | "reject") => {
    setDeciding(true);
    try {
      await api.decideTask(task.id, { action, note });
      await onRefresh();
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setDeciding(false);
    }
  };
  return (
    <div className="content-scroll task-detail-page">
      <div className="task-detail-header">
        <div>
          <span className="section-kicker">
            {task.kind === "security-scan" ? "SECURITY SCAN" : "CODE REVIEW"}
          </span>
          <h2>{task.title}</h2>
          <p>{task.progress}</p>
        </div>
        <span className={`task-status ${task.status}`}>{taskStatusLabel(task.status)}</span>
      </div>

      <div className="task-baseline-card">
        <div>
          <span>代码仓</span>
          <strong>{task.baseline?.repositoryUrl ?? inputSource(task)}</strong>
        </div>
        <div>
          <span>请求版本</span>
          <strong>{task.baseline?.requestedRef ?? "准备中"}</strong>
        </div>
        <div>
          <span>Commit</span>
          <code>{task.baseline?.commitSha ?? "等待解析"}</code>
        </div>
        <div>
          <span>创建时间</span>
          <strong>{formatDateTime(task.createdAt)}</strong>
        </div>
      </div>

      {active && (
        <section className="task-running-card">
          <span className="running-orbit">
            <LoaderCircle className="spin" size={24} />
          </span>
          <div>
            <strong>任务执行中</strong>
            <p>{task.progress}</p>
          </div>
          <button className="secondary-button" onClick={() => void api.cancelTask(task.id).then(onRefresh)}>
            <Square size={13} fill="currentColor" /> 取消任务
          </button>
        </section>
      )}
      {task.status === "failed" && (
        <section className="task-error-card">
          <XCircle size={22} />
          <div>
            <strong>任务执行失败</strong>
            <p>{task.error}</p>
          </div>
        </section>
      )}
      {task.result && (
        <>
          <section className="result-summary-card">
            <div className={`verdict-icon ${task.result.verdict}`}>
              {task.result.verdict === "pass" ? <CheckCircle2 size={23} /> : <AlertTriangle size={23} />}
            </div>
            <div>
              <span>AGENT RESULT · {verdictLabel(task.result.verdict)}</span>
              <h3>{task.result.summary}</h3>
            </div>
            <strong>
              {task.result.findings.length}
              <small>发现</small>
            </strong>
          </section>

          <section className="task-report-grid">
            <div className="finding-column">
              <div className="report-section-title">
                <h3>结构化发现</h3>
                <span>{task.result.findings.length}</span>
              </div>
              {task.result.findings.length === 0 ? (
                <div className="no-findings">
                  <CheckCircle2 size={24} />
                  <span>未发现需要报告的问题</span>
                </div>
              ) : (
                task.result.findings.map((finding) => (
                  <article className="finding-card" key={finding.id}>
                    <div className="finding-heading">
                      <span className={`severity ${finding.severity}`}>
                        {severityLabel(finding.severity)}
                      </span>
                      <code>{finding.id}</code>
                      <span className="confidence">置信度 {finding.confidence}</span>
                    </div>
                    <h4>{finding.title}</h4>
                    <p>{finding.description}</p>
                    {finding.file && (
                      <div className="code-location">
                        <FileCode2 size={13} />
                        <code>
                          {finding.file}
                          {finding.startLine
                            ? `:${finding.startLine}${finding.endLine ? `-${finding.endLine}` : ""}`
                            : ""}
                        </code>
                      </div>
                    )}
                    {finding.evidence && (
                      <div className="finding-detail">
                        <strong>证据</strong>
                        <p>{finding.evidence}</p>
                      </div>
                    )}
                    {finding.recommendation && (
                      <div className="finding-detail recommendation">
                        <strong>建议</strong>
                        <p>{finding.recommendation}</p>
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
            <div className="report-column">
              <div className="report-section-title">
                <h3>{task.kind === "security-scan" ? "本地扫描报告" : "本地检视报告"}</h3>
                <span>Markdown</span>
              </div>
              <article className="markdown-report">{renderMarkdown(task.reportMarkdown ?? "")}</article>
              {task.artifacts.length > 0 && (
                <div className="artifact-list">
                  <h4>补充产物</h4>
                  {task.artifacts.map((artifact) => (
                    <div key={artifact.path}>
                      <FileCode2 size={14} />
                      <span>{artifact.name}</span>
                      <small>{formatBytes(artifact.size)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {task.status === "waiting_user" && (
        <section className="decision-card">
          <div>
            <CircleDot size={20} />
            <span>
              <strong>等待人工确认</strong>
              <small>确认仅记录平台决策，不会自动向代码仓或 MR 提交任何内容。</small>
            </span>
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="填写确认说明或驳回原因（可选）"
            rows={3}
          />
          <div className="decision-actions">
            <button
              className="secondary-button reject-button"
              disabled={deciding}
              onClick={() => void decide("reject")}
            >
              <XCircle size={15} /> 驳回结果
            </button>
            <button className="primary-button" disabled={deciding} onClick={() => void decide("confirm")}>
              <CheckCircle2 size={15} /> 确认结果
            </button>
          </div>
        </section>
      )}
      {task.decision && (
        <section className={`decision-result ${task.decision.action}`}>
          {task.decision.action === "confirm" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <div>
            <strong>{task.decision.action === "confirm" ? "结果已确认" : "结果已驳回"}</strong>
            <p>{task.decision.note || "未填写说明"}</p>
            <small>{formatDateTime(task.decision.decidedAt)}</small>
          </div>
        </section>
      )}
    </div>
  );
}

function SettingsView({
  tab,
  onTab,
  knowledgeBases,
  agents,
  modules,
  applicationSettings,
  onRefresh,
  onError
}: {
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  knowledgeBases: KnowledgeBase[];
  agents: AgentDescriptor[];
  modules: ModuleManifest[];
  applicationSettings: ApplicationRuntimeSettings[];
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="content-scroll settings-page">
      <div className="settings-intro">
        <div>
          <span className="section-kicker">PLATFORM CONTROL</span>
          <h2>模块能力与数据源</h2>
          <p>每个模块只加载自己的 Skill。应用运行策略只影响之后新建的业务会话或任务。</p>
        </div>
        <div className="architecture-pill">
          <Boxes size={17} /> {modules.length} 个能力模块
        </div>
      </div>
      <div className="settings-tabs">
        <button className={tab === "applications" ? "active" : ""} onClick={() => onTab("applications")}>
          <Boxes size={16} />
          应用配置
        </button>
        <button className={tab === "knowledge" ? "active" : ""} onClick={() => onTab("knowledge")}>
          <Database size={16} />
          知识库
        </button>
        <button className={tab === "skills" ? "active" : ""} onClick={() => onTab("skills")}>
          <Sparkles size={16} />
          模块 Skill
        </button>
        <button className={tab === "runtime" ? "active" : ""} onClick={() => onTab("runtime")}>
          <Bot size={16} />
          Agent Runtime
        </button>
      </div>
      {tab === "applications" && (
        <ApplicationSettings
          modules={modules}
          agents={agents}
          settings={applicationSettings}
          onRefresh={onRefresh}
          onError={onError}
        />
      )}
      {tab === "knowledge" && (
        <KnowledgeSettings items={knowledgeBases} onRefresh={onRefresh} onError={onError} />
      )}
      {tab === "skills" && <SkillSettings modules={modules} onError={onError} />}
      {tab === "runtime" && <RuntimeSettings agents={agents} />}
    </div>
  );
}

function ApplicationSettings({
  modules,
  agents,
  settings,
  onRefresh,
  onError
}: {
  modules: ModuleManifest[];
  agents: AgentDescriptor[];
  settings: ApplicationRuntimeSettings[];
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  return (
    <div className="application-settings-list">
      {modules.map((module) => (
        <ApplicationRuntimeCard
          key={module.id}
          module={module}
          agents={agents}
          value={settings.find((item) => item.moduleId === module.id)}
          onRefresh={onRefresh}
          onError={onError}
        />
      ))}
    </div>
  );
}

function ApplicationRuntimeCard({
  module,
  agents,
  value,
  onRefresh,
  onError
}: {
  module: ModuleManifest;
  agents: AgentDescriptor[];
  value?: ApplicationRuntimeSettings;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [agent, setAgent] = useState(value?.agent ?? "claude");
  const [model, setModel] = useState(value?.model ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const descriptor = agents.find((item) => item.id === agent);

  useEffect(() => {
    setAgent(value?.agent ?? "claude");
    setModel(value?.model ?? "");
  }, [value?.agent, value?.model]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveApplicationSettings(module.id, { agent, model: model || undefined });
      await onRefresh();
      setSaved(true);
    } catch (cause) {
      onError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel-card application-runtime-card">
      <div className="application-card-heading">
        <span className="module-icon">
          <BookOpen size={20} />
        </span>
        <div>
          <span>能力应用</span>
          <h3>{module.name}</h3>
          <p>{module.description}</p>
        </div>
        <code>{module.id}</code>
      </div>
      <div className="application-runtime-form">
        <label>
          Agent Runtime
          <select
            value={agent}
            onChange={(event) => {
              setAgent(event.target.value as "claude" | "codeagent");
              setModel("");
              setSaved(false);
            }}
          >
            {agents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.available ? "" : "（当前不可用）"}
              </option>
            ))}
          </select>
        </label>
        <label>
          指定模型
          <input
            value={model}
            list={`models-${module.id}`}
            placeholder="留空则使用 CLI 默认模型"
            onChange={(event) => {
              setModel(event.target.value);
              setSaved(false);
            }}
          />
          <datalist id={`models-${module.id}`}>
            {descriptor?.models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </datalist>
        </label>
        <div className="application-runtime-action">
          <span>
            {model
              ? `新${module.experience === "conversation" ? "会话" : "任务"}将使用 ${model}`
              : "模型为空：跟随 CLI 默认配置"}
          </span>
          <button className="primary-button" disabled={saving} onClick={() => void save()}>
            {saving ? <LoaderCircle className="spin" size={15} /> : saved ? <Check size={15} /> : null}
            {saving ? "保存中" : saved ? "已保存" : "保存应用配置"}
          </button>
        </div>
      </div>
    </section>
  );
}

function KnowledgeSettings({
  items,
  onRefresh,
  onError
}: {
  items: KnowledgeBase[];
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ id: "", name: "", description: "" });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.saveKnowledgeBase({ ...form, enabled: true });
      setForm({ id: "", name: "", description: "" });
      await onRefresh();
    } catch (cause) {
      onError(messageOf(cause));
    }
  };
  return (
    <div className="settings-grid">
      <section className="panel-card">
        <div className="panel-title">
          <div>
            <h3>已接入知识库</h3>
            <p>平台将 ID 注入会话提示词，实际检索方式由模块 Skill 定义。</p>
          </div>
          <span>{items.length}</span>
        </div>
        <div className="table-list">
          {items.map((item) => (
            <div className="table-row" key={item.id}>
              <span className="database-icon">
                <Database size={18} />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <code>{item.id}</code>
              </div>
              <button
                className="icon-button danger"
                onClick={() =>
                  void api
                    .deleteKnowledgeBase(item.id)
                    .then(onRefresh)
                    .catch((error) => onError(messageOf(error)))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <form className="panel-card form-card" onSubmit={submit}>
        <div className="panel-title">
          <div>
            <h3>添加知识库</h3>
            <p>填写线上数据库使用的唯一 ID。</p>
          </div>
        </div>
        <label>
          知识库 ID
          <input
            required
            pattern="[A-Za-z0-9._:-]+"
            value={form.id}
            onChange={(event) => setForm({ ...form, id: event.target.value })}
            placeholder="例如 campus-policy-v2"
          />
        </label>
        <label>
          显示名称
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="校园政策知识库"
          />
        </label>
        <label>
          说明
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="包含的数据范围和使用说明"
          />
        </label>
        <button className="primary-button">
          <Plus size={16} />
          保存知识库
        </button>
      </form>
    </div>
  );
}

function SkillSettings({
  modules,
  onError
}: {
  modules: ModuleManifest[];
  onError: (message: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [moduleId, setModuleId] = useState("knowledge-qa");
  const [items, setItems] = useState<Skill[]>([]);
  const [form, setForm] = useState({
    name: "",
    version: "1.0.0",
    description: "",
    instructions:
      "---\nname: custom-knowledge-skill\ndescription: 描述触发条件\n---\n\n# 执行说明\n\n请在此填写数据库工具调用与输出约束。"
  });
  const [supportingFiles, setSupportingFiles] = useState("{}");
  const module = modules.find((item) => item.id === moduleId) ?? modules[0];
  const refreshSkills = async (id = module?.id) => {
    if (!id) return setItems([]);
    try {
      setItems(await api.skills(id));
    } catch (cause) {
      onError(messageOf(cause));
    }
  };
  useEffect(() => {
    if (module) {
      setModuleId(module.id);
      void refreshSkills(module.id);
    }
  }, [module?.id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!module) return;
    try {
      const files = JSON.parse(supportingFiles) as Record<string, string>;
      if (!files || Array.isArray(files) || typeof files !== "object")
        throw new Error("配套文件必须是 JSON 对象");
      await api.createSkill(module.id, { ...form, enabled: true, supportingFiles: files });
      setShowForm(false);
      setSupportingFiles("{}");
      await refreshSkills(module.id);
    } catch (cause) {
      onError(messageOf(cause));
    }
  };
  return (
    <div className="skills-section">
      <div className="module-banner">
        <div className="module-icon">
          <BookOpen size={20} />
        </div>
        <div>
          <span>当前模块</span>
          <strong>{module?.name ?? "未发现模块"}</strong>
          <small>{module?.description}</small>
        </div>
        {modules.length > 1 ? (
          <select value={module?.id} onChange={(event) => setModuleId(event.target.value)}>
            {modules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <code>{module?.id}</code>
        )}
      </div>
      <section className="panel-card">
        <div className="panel-title">
          <div>
            <h3>模块专属 Skill</h3>
            <p>
              启动 Agent 时会复制到新 attempt 的 <code>.agent/skills</code>，不会加载其他模块 Skill。
            </p>
          </div>
          <button className="secondary-button" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} />
            添加 Skill
          </button>
        </div>
        {showForm && (
          <form className="inline-skill-form" onSubmit={submit}>
            <div className="two-columns">
              <label>
                Skill 名称
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                版本
                <input
                  required
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </label>
            </div>
            <label>
              说明
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label>
              SKILL.md
              <textarea
                className="code-editor"
                required
                rows={13}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </label>
            <label>
              配套文件 JSON（可选）
              <textarea
                className="code-editor"
                rows={4}
                value={supportingFiles}
                onChange={(e) => setSupportingFiles(e.target.value)}
                placeholder={'{"scripts/query.sh":"#!/bin/sh\\n..."}'}
              />
            </label>
            <div className="form-actions">
              <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>
                取消
              </button>
              <button className="primary-button">保存并启用</button>
            </div>
          </form>
        )}
        <div className="skill-list">
          {items.map((skill) => (
            <div className="skill-row" key={skill.id}>
              <span className="skill-glyph">
                <Sparkles size={17} />
              </span>
              <div>
                <strong>
                  {skill.name}
                  <em>v{skill.version}</em>
                </strong>
                <p>{skill.description}</p>
                <small>
                  {skill.id.startsWith("builtin-") ? "内置" : "管理员添加"} ·{" "}
                  {skill.enabled ? "已启用" : "已停用"}
                </small>
              </div>
              {!skill.id.startsWith("builtin-") && (
                <button
                  className="icon-button danger"
                  onClick={() =>
                    module &&
                    void api
                      .deleteSkill(module.id, skill.id)
                      .then(() => refreshSkills(module.id))
                      .catch((error) => onError(messageOf(error)))
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RuntimeSettings({ agents }: { agents: AgentDescriptor[] }) {
  return (
    <section className="panel-card runtime-panel">
      <div className="panel-title">
        <div>
          <h3>Claude CLI 兼容 Runtime</h3>
          <p>两个 Agent 共用启动、stream-json 解析、模型选择、Session 恢复和取消协议。</p>
        </div>
      </div>
      <div className="runtime-list">
        {agents.map((agent) => (
          <div key={agent.id}>
            <span className="agent-logo">
              <Bot size={19} />
            </span>
            <div>
              <strong>{agent.name}</strong>
              <code>{agent.command}</code>
              <small>
                模型：CLI 默认
                {agent.models.length ? `、${agent.models.map((model) => model.id).join("、")}` : ""}
              </small>
            </div>
            <span className={agent.available ? "available" : "unavailable"}>
              {agent.available ? "可用" : "未检测到"}
            </span>
          </div>
        ))}
      </div>
      <div className="protocol-note">
        <strong>协议</strong>
        <code>claude-cli-stream-json</code>
        <span>
          命令和模型分别通过 <code>*_COMMAND</code> / <code>*_MODELS</code> 环境变量配置。
        </span>
      </div>
    </section>
  );
}

function messageOf(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function timeAgo(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1
    ? "刚刚"
    : minutes < 60
      ? `${minutes} 分钟前`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} 小时前`
        : `${Math.floor(minutes / 1440)} 天前`;
}
function statusLabel(status: ChatSession["status"]) {
  return {
    ready: "就绪",
    running: "运行中",
    succeeded: "已完成",
    failed: "失败",
    canceled: "已取消",
    interrupted: "已中断"
  }[status];
}
function taskStatusLabel(status: AgentTask["status"]) {
  return {
    queued: "排队中",
    preparing: "准备代码",
    running: "分析中",
    waiting_user: "待确认",
    confirmed: "已确认",
    rejected: "已驳回",
    failed: "失败",
    canceled: "已取消",
    interrupted: "已中断"
  }[status];
}
function inputSource(task: AgentTask) {
  return task.input.kind === "security-scan" ? task.input.repositoryUrl : task.input.mergeRequestUrl;
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function verdictLabel(value: NonNullable<AgentTask["result"]>["verdict"]) {
  return { pass: "通过", attention: "需要关注", required_changes: "需要修改" }[value];
}
function severityLabel(value: NonNullable<AgentTask["result"]>["findings"][number]["severity"]) {
  return { info: "提示", low: "低", medium: "中", high: "高", critical: "严重" }[value];
}
function formatBytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
function renderMarkdown(markdown: string) {
  return markdown.split("\n").map((line, index) => {
    if (line.startsWith("### ")) return <h4 key={index}>{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={index}>{line.slice(2)}</h2>;
    if (line.startsWith("- "))
      return (
        <p className="markdown-list-item" key={index}>
          • {line.slice(2)}
        </p>
      );
    if (!line.trim()) return <br key={index} />;
    return <p key={index}>{line}</p>;
  });
}
