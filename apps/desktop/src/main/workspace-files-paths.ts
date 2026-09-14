import { isAbsolute, relative } from "node:path";

/**
 * 工作区文件的**路径策略**：什么算合法路径、什么算越界、哪些文件可编辑。
 *
 * 单独成文件的原因：这一半是纯函数（不碰 fs），可以脱离 Electron 直接跑断言；
 * 另一半 `workspace-files-service.ts` 只负责真正的读写。
 *
 * 原则：越界意图一律**直接拒**，不做「尽力而为」的宽松解析。
 */

export class WorkspaceFilesError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WorkspaceFilesError";
    this.code = code;
  }
}

/** 能在应用内编辑的文本后缀。 */
const EDITABLE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".log",
  ".ini",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".vue",
  ".py",
  ".sh",
  ".sql"
]);

export function isEditableTextName(name: string): boolean {
  const index = name.lastIndexOf(".");
  if (index <= 0) return false;
  return EDITABLE_EXTENSIONS.has(name.slice(index).toLowerCase());
}

/**
 * 把外部传入的相对路径规范化成 `a/b/c`；空串表示工作目录本身。
 *
 * 拒绝：绝对路径、`..` 段、反斜杠、NUL。（反斜杠也拒 —— 它在 Windows 上是分隔符，
 * 在 POSIX 上是合法文件名字符，放行就等于给自己留一个跨平台的口子。）
 */
export function normalizeRelativePath(raw: string): string {
  if (typeof raw !== "string") {
    throw new WorkspaceFilesError(
      "workspace_files.invalid_path",
      "路径格式无效。"
    );
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "." || trimmed === "./") {
    return "";
  }
  if (trimmed.includes("\0") || trimmed.includes("\\")) {
    throw new WorkspaceFilesError(
      "workspace_files.invalid_path",
      "路径格式无效。"
    );
  }
  if (isAbsolute(trimmed)) {
    throw new WorkspaceFilesError(
      "workspace_files.absolute_path",
      "只能操作工作目录里的相对路径。"
    );
  }
  const segments: string[] = [];
  for (const segment of trimmed.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      throw new WorkspaceFilesError(
        "workspace_files.escape",
        "路径不能跳出工作目录。"
      );
    }
    segments.push(segment);
  }
  return segments.join("/");
}

/** 新建/重命名用的名字：必须是单个文件名，不能带分隔符、`..` 或控制字符。 */
export function isSafeEntryName(name: string): boolean {
  const trimmed = (name ?? "").trim();
  if (trimmed === "" || trimmed.length > 200) return false;
  if (trimmed === "." || trimmed === "..") return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  return !/[\u0000-\u001f]/u.test(trimmed);
}

export function requireSafeEntryName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!isSafeEntryName(trimmed)) {
    throw new WorkspaceFilesError(
      "workspace_files.invalid_name",
      "名称不能为空，也不能包含 / \\ 或 .. 。"
    );
  }
  return trimmed;
}

/** 目标必须落在 root 之内（比较的是规范化后的绝对路径）。 */
export function assertInside(root: string, target: string): void {
  const rel = relative(root, target);
  if (rel === "") return;
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new WorkspaceFilesError(
      "workspace_files.escape",
      "路径不能跳出工作目录。"
    );
  }
}

export interface WorkspaceFileBreadcrumbLike {
  name: string;
  path: string;
}

/** 面包屑：根 + 每一级，供页面导航用。 */
export function buildBreadcrumbs(
  segments: string
): WorkspaceFileBreadcrumbLike[] {
  const breadcrumbs: WorkspaceFileBreadcrumbLike[] = [
    { name: "工作区", path: "" }
  ];
  if (!segments) return breadcrumbs;
  let current = "";
  for (const segment of segments.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    breadcrumbs.push({ name: segment, path: current });
  }
  return breadcrumbs;
}
