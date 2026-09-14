import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  WorkspaceDirectorySettingsSchema,
  type WorkspaceDirectorySettings
} from "@deepwrite/contracts";

interface DiskWorkspaceDirectorySettings {
  version: 1;
  path: string;
}
function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

/**
 * 配置里存的路径是不是**上一版的默认目录**。
 *
 * 用途只有搬家：Android 端的默认工作目录从 `Documents/DeepWrite` 换到了
 * `Download/DeepWrite`，而老装机用户的配置里已经写死了旧默认值 ——
 * 不认这一下，「改默认目录」对他们完全不生效。
 * 比较的是 `resolve` 之后的字符串（配置里存的就是 realpath）。
 */
function isLegacyDefaultPath(
  path: string,
  legacyDefaults: readonly string[]
): boolean {
  const normalized = resolve(path);
  return legacyDefaults.some((legacy) => {
    const candidate = (legacy ?? "").trim();
    return candidate !== "" && resolve(candidate) === normalized;
  });
}

export class WorkspaceDirectoryStore {
  readonly settingsPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(userDataPath: string) {
    this.settingsPath = join(
      userDataPath,
      "config",
      "workspace-directory.json"
    );
  }

  async list(): Promise<WorkspaceDirectorySettings> {
    await this.writeChain;
    try {
      const raw = JSON.parse(
        await readFile(this.settingsPath, "utf8")
      ) as unknown;
      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw) ||
        !("version" in raw) ||
        raw.version !== 1 ||
        !("path" in raw) ||
        typeof raw.path !== "string" ||
        !raw.path.trim()
      ) {
        return { path: null };
      }
      return WorkspaceDirectorySettingsSchema.parse({ path: raw.path });
    } catch (error: unknown) {
      if (isNodeError(error, "ENOENT") || error instanceof SyntaxError) {
        return { path: null };
      }
      throw error;
    }
  }

  /**
   * 首次使用时把默认目录写进配置；已经选过就保留。
   *
   * `legacyDefaults` 是**一次性搬家**用的：配置里存的如果正好是上一版的默认值，
   * 就重指到新的默认值（见 `isLegacyDefaultPath`）。只改配置，**不动任何文件** ——
   * 用户的稿子还在原地，要不要搬由用户自己决定。
   */
  async initializeDefault(
    defaultPath: string,
    legacyDefaults: readonly string[] = []
  ): Promise<WorkspaceDirectorySettings> {
    const current = await this.list();
    if (current.path && !isLegacyDefaultPath(current.path, legacyDefaults)) {
      return current;
    }

    const absoluteDefaultPath = resolve(defaultPath);
    await mkdir(absoluteDefaultPath, { recursive: true });
    return this.save(await realpath(absoluteDefaultPath));
  }

  async save(rawPath: string): Promise<WorkspaceDirectorySettings> {
    const requestedPath = rawPath.trim();
    if (!requestedPath) {
      throw new Error("工作目录不能为空。");
    }
    let saved: WorkspaceDirectorySettings | undefined;
    const operation = this.writeChain.then(async () => {
      const absolutePath = resolve(requestedPath);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error("工作目录必须是本地真实文件夹，不能是文件或符号链接。");
      }
      const canonicalPath = await realpath(absolutePath);
      const disk: DiskWorkspaceDirectorySettings = {
        version: 1,
        path: canonicalPath
      };
      await mkdir(dirname(this.settingsPath), { recursive: true });
      const temporary = `${this.settingsPath}.tmp-${process.pid}-${Date.now()}`;
      await writeFile(temporary, `${JSON.stringify(disk, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(temporary, this.settingsPath);
      saved = WorkspaceDirectorySettingsSchema.parse({ path: canonicalPath });
    });
    this.writeChain = operation.then(
      () => undefined,
      () => undefined
    );
    await operation;
    return saved!;
  }
}
