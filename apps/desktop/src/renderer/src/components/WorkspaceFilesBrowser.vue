<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WorkspaceFileEntry } from "@deepwrite/contracts/renderer";
import AppIcon from "./AppIcon.vue";
import WorkspaceFileEditor from "./WorkspaceFileEditor.vue";
import {
  useWorkspaceFiles,
  type WorkspaceFilesApi
} from "../composables/useWorkspaceFiles";
import { uiMessage } from "../ui-feedback";

/**
 * 工作区文件浏览（手机端「工作区」页的主体）。
 *
 * 交互骨架参照 RikkaHub 的工作区（列表 + 每行 ⋮ + 空态 + 新建），
 * 但**不做**它的多工作区 / proot Linux / 终端 —— DeepWrite 只有一个工作目录，
 * 那些搬过来会分裂现有的作品与资料库体系。
 *
 * ⚠️ `listing.root` 是**主进程实测的根目录**，比渲染层异步加载的那份设置值可靠：
 * 页面上方的卡片要显示哪个目录，以这个为准（`update:root` 往上抛）。
 */
const props = defineProps<{ api: () => WorkspaceFilesApi | undefined }>();

const emit = defineEmits<{ "update:root": [root: string | null] }>();

const {
  listing,
  loading,
  busy,
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
} = useWorkspaceFiles({ api: () => props.api() });

const menuPath = ref<string | null>(null);
const dialog = ref<{
  kind: "create-file" | "create-directory" | "rename" | "delete";
  entry?: WorkspaceFileEntry;
} | null>(null);
const nameInput = ref("");
const dialogBusy = ref(false);

const entries = computed(() => listing.value?.entries ?? []);
const breadcrumbs = computed(
  () => listing.value?.breadcrumbs ?? [{ name: "工作区", path: "" }]
);
const rootPath = computed(() => listing.value?.root ?? "");

onMounted(() => {
  void open("");
});

// 根目录就往上抛一份，页面上方的卡片不必自己去猜。
watch(rootPath, (root) => emit("update:root", root || null), {
  immediate: true
});

defineExpose({ refresh, rootPath });

function sizeText(entry: WorkspaceFileEntry): string {
  if (entry.kind === "directory") return "";
  if (entry.size < 1024) return `${entry.size} B`;
  if (entry.size < 1024 * 1024) return `${(entry.size / 1024).toFixed(1)} KB`;
  return `${(entry.size / 1024 / 1024).toFixed(1)} MB`;
}

function timeText(modifiedAt: number | null): string {
  if (!modifiedAt) return "";
  const date = new Date(modifiedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openEntry(entry: WorkspaceFileEntry): void {
  menuPath.value = null;
  if (entry.kind === "directory") {
    void open(entry.path);
    return;
  }
  if (entry.editable) {
    void openFile(entry);
    return;
  }
  // 二进制 / 超大文件：手机端没有「用系统应用打开」这条通道（需要新的宿主能力），
  // 与其渲染一个点了没反应的按钮，不如直说 —— 见 §13.2 的教训。
  uiMessage.info("这类文件暂不支持在应用内打开，可用 MT 管理器查看。");
}

function openDialog(
  kind: "create-file" | "create-directory" | "rename" | "delete",
  entry?: WorkspaceFileEntry
): void {
  menuPath.value = null;
  dialog.value = { kind, ...(entry ? { entry } : {}) };
  nameInput.value = kind === "rename" && entry ? entry.name : "";
}

async function confirmDialog(): Promise<void> {
  const current = dialog.value;
  if (!current) return;
  dialogBusy.value = true;
  try {
    if (current.kind === "delete" && current.entry) {
      if (await removeEntry(current.entry)) dialog.value = null;
      return;
    }
    const name = nameInput.value.trim();
    if (!name) return;
    const ok =
      current.kind === "rename" && current.entry
        ? await renameEntry(current.entry, name)
        : await createEntry(
            name,
            current.kind === "create-directory" ? "directory" : "file"
          );
    if (ok) dialog.value = null;
  } finally {
    dialogBusy.value = false;
  }
}
</script>

<template>
  <div class="workspace-files">
    <nav class="workspace-files-breadcrumb" aria-label="工作区路径">
      <button
        v-for="(crumb, index) in breadcrumbs"
        :key="crumb.path"
        class="workspace-files-crumb"
        type="button"
        :disabled="index === breadcrumbs.length - 1"
        @click="open(crumb.path)"
      >
        {{ crumb.name }}
        <AppIcon
          v-if="index < breadcrumbs.length - 1"
          name="chevron"
          :size="12"
        />
      </button>
    </nav>

    <p v-if="rootPath" class="workspace-files-root">{{ rootPath }}</p>

    <div class="workspace-files-actions">
      <button
        class="workspace-files-action"
        type="button"
        :disabled="busy"
        @click="openDialog('create-file')"
      >
        <AppIcon name="plus" :size="15" />新建文件
      </button>
      <button
        class="workspace-files-action"
        type="button"
        :disabled="busy"
        @click="openDialog('create-directory')"
      >
        <AppIcon name="folder" :size="15" />新建文件夹
      </button>
      <button
        class="workspace-files-action is-icon"
        type="button"
        aria-label="刷新列表"
        title="刷新列表"
        :disabled="loading"
        @click="refresh()"
      >
        <AppIcon name="redo" :size="15" />
      </button>
    </div>

    <p v-if="loading" class="workspace-files-hint">正在读取…</p>
    <p v-else-if="!entries.length" class="workspace-files-empty">
      <strong>这个文件夹是空的</strong>
      <small>用上面的「新建文件 / 新建文件夹」开始整理。</small>
    </p>

    <ul v-else class="workspace-files-list">
      <li
        v-for="entry in entries"
        :key="entry.path"
        class="workspace-files-row"
      >
        <button
          class="workspace-files-entry"
          type="button"
          @click="openEntry(entry)"
        >
          <AppIcon
            :name="entry.kind === 'directory' ? 'folder' : 'file'"
            :size="17"
          />
          <span class="workspace-files-name">{{ entry.name }}</span>
          <span class="workspace-files-meta">
            {{ sizeText(entry) }}
            <template v-if="timeText(entry.modifiedAt)">
              · {{ timeText(entry.modifiedAt) }}
            </template>
          </span>
        </button>
        <div class="workspace-files-row-menu">
          <button
            class="workspace-files-more"
            type="button"
            :aria-label="`${entry.name} 的操作`"
            :aria-expanded="menuPath === entry.path"
            @click="menuPath = menuPath === entry.path ? null : entry.path"
          >
            <AppIcon name="more" :size="16" />
          </button>
          <div v-if="menuPath === entry.path" class="workspace-files-menu">
            <button type="button" @click="openDialog('rename', entry)">
              <AppIcon name="edit" :size="15" />重命名
            </button>
            <button
              class="is-danger"
              type="button"
              @click="openDialog('delete', entry)"
            >
              <AppIcon name="close" :size="15" />删除
            </button>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="listing?.truncated" class="workspace-files-hint">
      条目过多，只显示了前一部分。
    </p>

    <WorkspaceFileEditor
      v-if="editingPath"
      :name="editingPath"
      :content="editingContent"
      :loading="editorLoading"
      :saving="editorSaving"
      :dirty="editingContent !== editorOriginal"
      @update:content="editingContent = $event"
      @save="saveFile()"
      @close="closeEditor()"
    />

    <div v-if="dialog" class="workspace-files-dialog-backdrop">
      <section class="workspace-files-dialog" role="dialog">
        <h3>
          {{
            dialog.kind === "rename"
              ? "重命名"
              : dialog.kind === "delete"
                ? "删除"
                : dialog.kind === "create-directory"
                  ? "新建文件夹"
                  : "新建文件"
          }}
        </h3>
        <p v-if="dialog.kind === 'delete'" class="workspace-files-dialog-note">
          删除「{{ dialog.entry?.name }}」后无法恢复<template
            v-if="dialog.entry?.kind === 'directory'"
            >，里面的内容会一起删掉</template
          >。
        </p>
        <input
          v-else
          v-model="nameInput"
          class="workspace-files-dialog-input"
          type="text"
          :placeholder="
            dialog.kind === 'create-directory' ? '文件夹名称' : '文件名称'
          "
          @keyup.enter="confirmDialog"
        />
        <div class="workspace-files-dialog-actions">
          <button type="button" :disabled="dialogBusy" @click="dialog = null">
            取消
          </button>
          <button
            class="is-primary"
            :class="{ 'is-danger': dialog.kind === 'delete' }"
            type="button"
            :disabled="
              dialogBusy || (dialog.kind !== 'delete' && !nameInput.trim())
            "
            @click="confirmDialog"
          >
            {{ dialog.kind === "delete" ? "删除" : "确定" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
