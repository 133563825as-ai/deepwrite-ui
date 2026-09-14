import { randomBytes } from "node:crypto";
import type { Stats } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  WORKSPACE_LIST_MAX_ENTRIES,
  WORKSPACE_TEXT_MAX_BYTES,
  type WorkspaceEntryKind,
  type WorkspaceFileEntry,
  type WorkspaceFileListing,
  type WorkspaceFilePathResult,
  type WorkspaceFileText
} from "@deepwrite/contracts";
import {
  assertInside,
  buildBreadcrumbs,
  isEditableTextName,
  normalizeRelativePath,
  requireSafeEntryName,
  WorkspaceFilesError
} from "./workspace-files-paths";

/**
 * 工作区文件的读写实现 —— 手机端「工作区」页唯一真正落盘的地方。
 *
 *  - **符号链接不许逃逸**：目标存在就比对 `realpath`；不存在（新建）就比对父目录的
 *    `realpath`。只要落到工作目录外面就拒。
 *  - 写入走**临时文件 + rename 原子替换**，避免写一半把已有作品弄坏。
 *  - 只有文本文件可编辑；二进制/超大文件只让用户「用系统应用打开」。
 */

async function exists(absolute: string): Promise<boolean> {
  try {
    await stat(absolute);
    return true;
  } catch {
    return false;
  }
}

function sortEntries(entries: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

export class WorkspaceFilesService {
  private readonly workspaceRoot: string;

  // 写成显式字段而不是构造函数参数属性：后者 Node 的 strip-only 类型擦除不支持，
  // 而「在容器里直接 import 这个类跑真实读写」是最快的验证手段（见交接文档 §14.5）。
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  private async requireRootReal(): Promise<string> {
    if (!this.workspaceRoot) {
      throw new WorkspaceFilesError(
        "workspace_files.no_root",
        "还没有设置工作目录，请先在工作区里选择目录。"
      );
    }
    try {
      return await realpath(this.workspaceRoot);
    } catch {
      throw new WorkspaceFilesError(
        "workspace_files.root_missing",
        "工作目录不存在或无法访问。"
      );
    }
  }

  /** 解析一个**已存在**的目标，并确认它（含符号链接）落在工作目录内。 */
  private async resolveExisting(
    rawPath: string,
    rootReal: string
  ): Promise<{ absolute: string; relative: string }> {
    const segments = normalizeRelativePath(rawPath);
    const absolute = segments ? join(rootReal, segments) : rootReal;
    assertInside(rootReal, absolute);
    let real: string;
    try {
      real = await realpath(absolute);
    } catch {
      throw new WorkspaceFilesError(
        "workspace_files.not_found",
        "目标不存在或已被移动。"
      );
    }
    assertInside(rootReal, real);
    return { absolute: real, relative: segments };
  }

  /** 解析一个**将要创建/覆盖**的目标；它还不存在，所以校验父目录。 */
  private async resolveInParent(
    segments: string,
    rootReal: string
  ): Promise<string> {
    if (!segments) {
      throw new WorkspaceFilesError(
        "workspace_files.root_target",
        "不能对工作目录本身做这个操作。"
      );
    }
    const absolute = join(rootReal, segments);
    assertInside(rootReal, absolute);
    const parentReal = await realpath(resolve(absolute, ".."));
    assertInside(rootReal, parentReal);
    return join(parentReal, segments.split("/").pop() ?? "");
  }

  async list(rawPath: string): Promise<WorkspaceFileListing> {
    const rootReal = await this.requireRootReal();
    const { absolute, relative: segments } = await this.resolveExisting(
      rawPath,
      rootReal
    );
    const info = await stat(absolute);
    if (!info.isDirectory()) {
      throw new WorkspaceFilesError(
        "workspace_files.not_a_directory",
        "这个位置不是文件夹。"
      );
    }

    const dirents = await readdir(absolute, { withFileTypes: true });
    const entries: WorkspaceFileEntry[] = [];
    let truncated = false;
    for (const dirent of dirents) {
      if (entries.length >= WORKSPACE_LIST_MAX_ENTRIES) {
        truncated = true;
        break;
      }
      const entryAbsolute = join(absolute, dirent.name);
      let entryInfo: Stats;
      try {
        entryInfo = await stat(entryAbsolute);
      } catch {
        continue;
      }
      // 符号链接：能落到工作目录里的照常显示，指向外面的直接不显示。
      if (dirent.isSymbolicLink()) {
        try {
          assertInside(rootReal, await realpath(entryAbsolute));
        } catch {
          continue;
        }
      }
      const isDirectory = entryInfo.isDirectory();
      if (!isDirectory && !entryInfo.isFile()) continue;
      entries.push({
        name: dirent.name,
        path: segments ? `${segments}/${dirent.name}` : dirent.name,
        kind: isDirectory ? "directory" : "file",
        size: isDirectory ? 0 : entryInfo.size,
        modifiedAt: Number.isFinite(entryInfo.mtimeMs)
          ? Math.max(0, Math.trunc(entryInfo.mtimeMs))
          : null,
        editable:
          !isDirectory &&
          entryInfo.size <= WORKSPACE_TEXT_MAX_BYTES &&
          isEditableTextName(dirent.name)
      });
    }

    return {
      root: rootReal,
      path: segments,
      breadcrumbs: buildBreadcrumbs(segments),
      entries: sortEntries(entries),
      truncated
    };
  }

  async readText(rawPath: string): Promise<WorkspaceFileText> {
    const rootReal = await this.requireRootReal();
    const { absolute, relative: segments } = await this.resolveExisting(
      rawPath,
      rootReal
    );
    const info = await stat(absolute);
    if (!info.isFile()) {
      throw new WorkspaceFilesError(
        "workspace_files.not_a_file",
        "这个位置不是文件。"
      );
    }
    if (info.size > WORKSPACE_TEXT_MAX_BYTES) {
      throw new WorkspaceFilesError(
        "workspace_files.too_large",
        "文件太大，无法在应用内编辑。"
      );
    }
    return {
      path: segments,
      content: await readFile(absolute, "utf8"),
      size: info.size
    };
  }

  async writeText(
    rawPath: string,
    content: string
  ): Promise<WorkspaceFilePathResult> {
    const rootReal = await this.requireRootReal();
    const segments = normalizeRelativePath(rawPath);
    if (Buffer.byteLength(content, "utf8") > WORKSPACE_TEXT_MAX_BYTES) {
      throw new WorkspaceFilesError(
        "workspace_files.too_large",
        "内容太大，无法保存。"
      );
    }
    const absolute = await this.resolveInParent(segments, rootReal);
    const existing = await stat(absolute).catch(() => null);
    if (!existing) {
      throw new WorkspaceFilesError(
        "workspace_files.not_found",
        "文件不存在，请先新建。"
      );
    }
    if (existing.isDirectory()) {
      throw new WorkspaceFilesError(
        "workspace_files.is_directory",
        "同名文件夹已存在。"
      );
    }
    // 原子写：同目录临时文件 + rename，中途失败不会留下半个文件。
    const temp = join(
      resolve(absolute, ".."),
      `.${randomBytes(6).toString("hex")}.deepwrite-tmp`
    );
    try {
      await writeFile(temp, content, "utf8");
      await rename(temp, absolute);
    } catch (error: unknown) {
      await unlink(temp).catch(() => {});
      throw error;
    }
    return { path: segments };
  }

  async create(
    rawParentPath: string,
    name: string,
    kind: WorkspaceEntryKind
  ): Promise<WorkspaceFilePathResult> {
    const rootReal = await this.requireRootReal();
    const parent = await this.resolveExisting(rawParentPath, rootReal);
    const parentInfo = await stat(parent.absolute);
    if (!parentInfo.isDirectory()) {
      throw new WorkspaceFilesError(
        "workspace_files.not_a_directory",
        "只能在工作区的文件夹里新建。"
      );
    }
    const safeName = requireSafeEntryName(name);
    const target = join(parent.absolute, safeName);
    assertInside(rootReal, target);
    if (await exists(target)) {
      throw new WorkspaceFilesError(
        "workspace_files.exists",
        "同名文件或文件夹已存在。"
      );
    }
    if (kind === "directory") {
      await mkdir(target);
    } else {
      await writeFile(target, "", { encoding: "utf8", flag: "wx" });
    }
    return {
      path: parent.relative ? `${parent.relative}/${safeName}` : safeName
    };
  }

  async rename(
    rawPath: string,
    nextName: string
  ): Promise<WorkspaceFilePathResult> {
    const rootReal = await this.requireRootReal();
    const source = await this.resolveExisting(rawPath, rootReal);
    if (!source.relative) {
      throw new WorkspaceFilesError(
        "workspace_files.root_target",
        "不能重命名工作目录本身。"
      );
    }
    const safeName = requireSafeEntryName(nextName);
    const target = join(resolve(source.absolute, ".."), safeName);
    assertInside(rootReal, target);
    if (target !== source.absolute) {
      if (await exists(target)) {
        throw new WorkspaceFilesError(
          "workspace_files.exists",
          "同名文件或文件夹已存在。"
        );
      }
      await rename(source.absolute, target);
    }
    const parent = source.relative.split("/").slice(0, -1).join("/");
    return { path: parent ? `${parent}/${safeName}` : safeName };
  }

  async remove(rawPath: string): Promise<WorkspaceFilePathResult> {
    const rootReal = await this.requireRootReal();
    const target = await this.resolveExisting(rawPath, rootReal);
    if (!target.relative) {
      throw new WorkspaceFilesError(
        "workspace_files.root_target",
        "不能删除工作目录本身。"
      );
    }
    await rm(target.absolute, { recursive: true, force: false });
    return { path: target.relative };
  }
}
