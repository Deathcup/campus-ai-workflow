import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ModuleManifestSchema,
  SkillSchema,
  type AgentKind,
  type ModuleManifest,
  type Skill,
  type UpsertSkillInput
} from "@campus-ai/contracts";

export class ModuleCatalog {
  constructor(private readonly capabilitiesDir: string) {}

  async list(): Promise<ModuleManifest[]> {
    await mkdir(this.capabilitiesDir, { recursive: true });
    const entries = await readdir(this.capabilitiesDir, { withFileTypes: true });
    const modules: ModuleManifest[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(this.capabilitiesDir, entry.name, "module.json");
      try {
        modules.push(ModuleManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8"))));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new Error(`模块 ${entry.name} 的 module.json 无效: ${String(error)}`);
      }
    }
    return modules;
  }

  async get(moduleId: string): Promise<ModuleManifest> {
    assertSegment(moduleId, "moduleId");
    const manifestPath = path.join(this.capabilitiesDir, moduleId, "module.json");
    return ModuleManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  }

  resolve(moduleId: string, relativePath: string): string {
    assertSegment(moduleId, "moduleId");
    const moduleRoot = path.resolve(this.capabilitiesDir, moduleId);
    const resolved = path.resolve(moduleRoot, relativePath);
    if (!resolved.startsWith(`${moduleRoot}${path.sep}`)) throw new Error("模块路径越界");
    return resolved;
  }
}

export class SkillRegistry {
  constructor(
    private readonly dataDir: string,
    private readonly catalog: ModuleCatalog
  ) {}

  async list(moduleId: string): Promise<Skill[]> {
    const result = new Map<string, Skill>();
    const module = await this.catalog.get(moduleId);
    const builtInRoot = this.catalog.resolve(moduleId, module.skillDirectory);
    for (const skill of await readSkillsFromRoot(builtInRoot, moduleId, true)) result.set(skill.id, skill);
    const managedRoot = path.join(this.dataDir, "skills", moduleId);
    for (const skill of await readSkillsFromRoot(managedRoot, moduleId, false)) result.set(skill.id, skill);
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }

  async create(moduleId: string, input: UpsertSkillInput): Promise<Skill> {
    await this.catalog.get(moduleId);
    const now = new Date().toISOString();
    const skill: Skill = SkillSchema.parse({
      ...input,
      id: randomUUID(),
      moduleId,
      createdAt: now,
      updatedAt: now
    });
    await this.writeManagedSkill(skill);
    return skill;
  }

  async remove(moduleId: string, skillId: string): Promise<void> {
    assertSegment(moduleId, "moduleId");
    assertSegment(skillId, "skillId");
    const skillDir = path.join(this.dataDir, "skills", moduleId, skillId);
    await rm(skillDir, { recursive: true, force: true });
  }

  async stage(
    moduleId: string,
    agent: AgentKind,
    sessionDir: string
  ): Promise<{ skills: Skill[]; promptFragment: string }> {
    const enabledSkills = (await this.list(moduleId)).filter((skill) => skill.enabled);
    const canonicalRoot = path.join(sessionDir, ".agent", "skills");
    const runtimeRoot = path.join(sessionDir, agent === "claude" ? ".claude" : ".codeagent", "skills");
    await Promise.all([mkdir(canonicalRoot, { recursive: true }), mkdir(runtimeRoot, { recursive: true })]);

    for (const skill of enabledSkills) {
      const folder = `${slug(skill.name)}-${skill.id.slice(0, 8)}`;
      for (const root of [canonicalRoot, runtimeRoot]) {
        const target = path.join(root, folder);
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, "SKILL.md"), skill.instructions, "utf8");
        for (const [relativeName, content] of Object.entries(skill.supportingFiles)) {
          const targetFile = safeChild(target, relativeName);
          await mkdir(path.dirname(targetFile), { recursive: true });
          await writeFile(targetFile, content, "utf8");
        }
      }
    }

    const promptFragment =
      enabledSkills.length === 0
        ? "当前模块没有启用的 Skill。请明确告知用户需要管理员先配置模块 Skill。"
        : [
            "本次会话仅加载了下列模块 Skill。开始回答前必须读取并遵循这些 SKILL.md；不要查找或使用其他目录中的 Skill：",
            ...enabledSkills.map(
              (skill) =>
                `- .agent/skills/${slug(skill.name)}-${skill.id.slice(0, 8)}/SKILL.md（${skill.name} ${skill.version}）`
            )
          ].join("\n");
    return { skills: enabledSkills, promptFragment };
  }

  private async writeManagedSkill(skill: Skill): Promise<void> {
    const root = path.join(this.dataDir, "skills", skill.moduleId, skill.id);
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "skill.json"), JSON.stringify(skill, null, 2), "utf8");
    await writeFile(path.join(root, "SKILL.md"), skill.instructions, "utf8");
    const filesRoot = path.join(root, "files");
    for (const [relativeName, content] of Object.entries(skill.supportingFiles)) {
      const file = safeChild(filesRoot, relativeName);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, "utf8");
    }
  }
}

async function readSkillsFromRoot(root: string, moduleId: string, builtIn: boolean): Promise<Skill[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const result: Skill[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(root, entry.name);
      const jsonPath = path.join(skillDir, "skill.json");
      const markdownPath = path.join(skillDir, "SKILL.md");
      try {
        const [metadata, instructions] = await Promise.all([
          readFile(jsonPath, "utf8").then(JSON.parse),
          readFile(markdownPath, "utf8")
        ]);
        const supportingFiles = await readSupportingFiles(path.join(skillDir, "files"));
        const modified = (await stat(markdownPath)).mtime.toISOString();
        result.push(
          SkillSchema.parse({
            ...metadata,
            id: metadata.id ?? (builtIn ? `builtin-${entry.name}` : entry.name),
            moduleId,
            instructions,
            supportingFiles,
            createdAt: metadata.createdAt ?? modified,
            updatedAt: metadata.updatedAt ?? modified
          })
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readSupportingFiles(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const entries = await readdir(root, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const entryWithParent = entry as typeof entry & { parentPath?: string; path?: string };
      const parent = entryWithParent.parentPath ?? entryWithParent.path ?? root;
      const fullPath = path.join(parent, entry.name);
      result[path.relative(root, fullPath)] = await readFile(fullPath, "utf8");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

function safeChild(root: string, relativeName: string): string {
  if (path.isAbsolute(relativeName)) throw new Error("Skill 文件名必须是相对路径");
  const resolved = path.resolve(root, relativeName);
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`))
    throw new Error("Skill 文件路径越界");
  return resolved;
}

function assertSegment(value: string, name: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) throw new Error(`${name} 格式无效`);
}

function slug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "skill";
}
