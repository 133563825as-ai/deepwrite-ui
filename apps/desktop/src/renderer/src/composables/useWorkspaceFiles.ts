import { ref } from "vue";
import type {
  WorkspaceEntryKind,
  WorkspaceFileEntry,
  WorkspaceFileListing
} from "@deepwrite/contracts/renderer";
import { uiMessage } from "../ui-feedback";

/**
 * 手机端「工作区」页的状态与命令调用。
 *
 * 为什么不直接塞进组件：列目录 / 新建 / 重命名 / 删除 / 读写文件各有一条失败路径，
 * 揉进模板会变成一坨 try/catch；这里统一收口，失败一律 toast。
 */
export interface WorkspaceFilesApi {
  list(input: { path: string }): Promise<WorkspaceFileListing>;
  readText(input: {
    path: string;
  }): Promise<{ path: string; content: string; size: number }>;
  writeText(input: {
    path: string;
    content: string;
  }): Promise<{ path: string }>;
  create(input: {
    parentPath: string;
    name: string;
    kind: WorkspaceEntryKind;
  }): Promise<{ path: string }>;
  rename(input: { path: string; nextName: string }): Promise<{ path: string }>;
  remove(input: { path: string }): Promise<{ path: string }>;
}

export interface WorkspaceFilesOptions {
  api: () => WorkspaceFilesApi | undefined;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function useWorkspaceFiles(options: WorkspaceFilesOptions) {
  const listing = ref<WorkspaceFileListing | null>(null);
  const loading = ref(false);
  const busy = ref(false);
  const currentPath = ref("");

  /** 正在编辑的文件；null = 没开编辑器。 */
  const editingPath = ref<string | null>(null);
  const editingContent = ref("");
  const editorOriginal = ref("");
  const editorLoading = ref(false);
  const editorSaving = ref(false);

  function requireApi(): WorkspaceFilesApi | undefined {
    const api = options.api();
    if (!api) {
      uiMessage.error("当前环境不支持工作区文件操作。");
    }
    return api;
  }

  async function open(path = ""): Promise<void> {
    const api = requireApi();
    if (!api) return;
    loading.value = true;
    try {
      listing.value = await api.list({ path });
      currentPath.value = listing.value.path;
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "打开工作区失败。"));
    } finally {
      loading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    await open(currentPath.value);
  }

  async function createEntry(
    name: string,
    kind: WorkspaceEntryKind
  ): Promise<boolean> {
    const api = requireApi();
    if (!api) return false;
    busy.value = true;
    try {
      await api.create({ parentPath: currentPath.value, name, kind });
      await refresh();
      uiMessage.success(
        kind === "directory" ? "已新建文件夹。" : "已新建文件。"
      );
      return true;
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "新建失败。"));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function renameEntry(
    entry: WorkspaceFileEntry,
    nextName: string
  ): Promise<boolean> {
    const api = requireApi();
    if (!api) return false;
    busy.value = true;
    try {
      await api.rename({ path: entry.path, nextName });
      await refresh();
      uiMessage.success("已重命名。");
      return true;
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "重命名失败。"));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function removeEntry(entry: WorkspaceFileEntry): Promise<boolean> {
    const api = requireApi();
    if (!api) return false;
    busy.value = true;
    try {
      await api.remove({ path: entry.path });
      if (editingPath.value === entry.path) closeEditor();
      await refresh();
      uiMessage.success("已删除。");
      return true;
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "删除失败。"));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function openFile(entry: WorkspaceFileEntry): Promise<void> {
    const api = requireApi();
    if (!api) return;
    editingPath.value = entry.path;
    editingContent.value = "";
    editorOriginal.value = "";
    editorLoading.value = true;
    try {
      const file = await api.readText({ path: entry.path });
      editingContent.value = file.content;
      editorOriginal.value = file.content;
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "打开文件失败。"));
      closeEditor();
    } finally {
      editorLoading.value = false;
    }
  }

  async function saveFile(): Promise<void> {
    const api = requireApi();
    const path = editingPath.value;
    if (!api || !path) return;
    editorSaving.value = true;
    try {
      await api.writeText({ path, content: editingContent.value });
      editorOriginal.value = editingContent.value;
      await refresh();
      uiMessage.success("已保存。");
    } catch (error: unknown) {
      uiMessage.error(errorText(error, "保存失败。"));
    } finally {
      editorSaving.value = false;
    }
  }

  function closeEditor(): void {
    editingPath.value = null;
    editingContent.value = "";
    editorOriginal.value = "";
  }

  return {
    listing,
    loading,
    busy,
    currentPath,
    editingPath,
    editingContent,
    editorOriginal,
    editorLoading,
    editorSaving,
    open,
    refresh,
    createEntry,
    renameEntry,
    removeEntry,
    openFile,
    saveFile,
    closeEditor
  };
}
