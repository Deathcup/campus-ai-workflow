import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "data", "dist"]);

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectMarkdownFiles(absolute)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files;
}

function localTarget(rawTarget) {
  const unwrapped = rawTarget.trim().replace(/^<|>$/g, "");
  if (!unwrapped || unwrapped.startsWith("#") || /^(?:https?:|mailto:|tel:|data:)/i.test(unwrapped)) {
    return undefined;
  }
  const withoutTitle = unwrapped.match(/^(\S+)/)?.[1] ?? unwrapped;
  const withoutFragment = withoutTitle.split("#", 1)[0];
  return withoutFragment ? decodeURIComponent(withoutFragment) : undefined;
}

const markdownFiles = await collectMarkdownFiles(root);
const failures = [];

for (const file of markdownFiles) {
  const content = await readFile(file, "utf8");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const target = localTarget(match[1]);
    if (!target) continue;
    const resolved = target.startsWith("/")
      ? path.join(root, target)
      : path.resolve(path.dirname(file), target);
    try {
      await access(resolved);
    } catch {
      failures.push(`${path.relative(root, file)} -> ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error("发现无效的本地 Markdown 链接：\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`已检查 ${markdownFiles.length} 个 Markdown 文件，本地链接有效。`);
}
