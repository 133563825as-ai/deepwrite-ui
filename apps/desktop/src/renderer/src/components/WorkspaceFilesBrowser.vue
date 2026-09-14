<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { WorkspaceFileEntry } from "@deepwrite/contracts/renderer";
import AppIcon from "./AppIcon.vue";
import WorkspaceFileEditor from "./WorkspaceFileEditor.vue";
import WorkspaceFileRow from "./WorkspaceFileRow.vue";
import WorkspaceImagePreview from "./WorkspaceImagePreview.vue";
import WorkspaceQuickFolders from "./WorkspaceQuickFolders.vue";
import {
  useWorkspaceFiles,
  type WorkspaceFilesApi
} from "../composables/useWorkspaceFiles";
import { uiMessage } from "../ui-feedback";

/**
 * 工作区文件浏览（手机端「工作区」页的主体）。
 *
 * 交互骨架参照 RikkaHub 的工作区（2026-09-15 读的真源码
 * `WorkspaceDetailPage.kt`，AGPL-3.0 —— 只借骨架，没有搬代码）：
 * 面包屑一行 + 两行式列表（名称 / 次要信息 + ⋮ 菜单）+ 空态图标。
 * **不做**它的多工作区 / proot Linux / 终端 —— DeepWrite 只有一个工作目录。
 *
 * 职责边界：这一层只编排（列目录 / 打开 / 新建 / 重命名 / 删除 / 预览），
 * 行、快捷目录、图片预览、文本编辑器各自是独立组件。
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
  currentPath,
  editingPath,
  editingContent,
  editorOriginal,
  editorLoading,
  editorSaving,
  previewPath,
  previewUrl,
  imageLoading,
  open,
  refresh,
  createEntry,
  renameEntry,
  removeEntry,
  openFile,
  saveFile,
  closeEditor,
  openImage,
  closeImage
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
/** 只在工作目录根下摆「常用目录」。 */
const atRoot = computed(() => currentPath.value === "");
const existingNames = computed(() => entries.value.map((entry) => entry.name));

onMounted(() => {
  void open("");
});

// 根目录就往上抛一份，页面上方的卡片不必自己去猜。
watch(rootPath, (root) => emit("update:root", root || null), {
  immediate: true
});

defineExpose({ refresh, rootPath });

const EDITABLE_IMAGE = /\.(png|jpe?g|webp|gif|bmp|avif|heic)$/iu;

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
  if (EDITABLE_IMAGE.test(entry.name)) {
    void openImage(entry);
    return;
  }
  // 其余二进制：手机端还没有「用系统应用打开」这条通道（需要新的宿主能力），
  // 与其渲染一个点了没反应的按钮，不如直说 —— 见 §13.2 的教训。
  uiMessage.info("这类文件暂不支持在应用内打开，可用 MT 管理器查看。");
}

/** 点常用目录里「未创建」的那一项：先建目录，再进去。 */
async function openOrCreateFolder(name: string): Promise<void> {
  if (!existingNames.value.includes(name)) {
    const created = await createEntry(name, "directory");
    if (!created) return;
  }
  void open(name);
}

async function copyPath(entry: WorkspaceFileEntry): Promise<void> {
  menuPath.value = null;
  const text = entry.path;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("clipboard unavailable");
    }
    uiMessage.success(`已复制：${text}`);
  } catch {
    // WebView 里 clipboard API 不一定可用，退到临时输入框 + execCommand。
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "true");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand?.("copy") ?? false;
    scratch.remove();
    if (ok) uiMessage.success(`已复制：${text}`);
    else uiMessage.info(`路径：${text}（长按可手动复制）`);
  }
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

    <ul v-if="entries.length" class="workspace-files-list">
      <WorkspaceFileRow
        v-for="entry in entries"
        :key="entry.path"
        :entry="entry"
        :menu-open="menuPath === entry.path"
        @toggle-menu="menuPath = menuPath === entry.path ? null : entry.path"
        @open="openEntry(entry)"
        @rename="openDialog('rename', entry)"
        @remove="openDialog('delete', entry)"
        @copy-path="copyPath(entry)"
      />
    </ul>

    <div v-else-if="!loading" class="workspace-files-empty">
      <AppIcon name="folder" :size="44" />
      <strong>这个文件夹是空的</strong>
      <small>用上面的「新建文件 / 新建文件夹」开始整理。</small>
    </div>

    <WorkspaceQuickFolders
      v-if="atRoot"
      :existing="existingNames"
      @open="open"
      @create="openOrCreateFolder"
    />

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

    <WorkspaceImagePreview
      v-if="previewPath"
      :name="previewPath"
      :url="previewUrl"
      :loading="imageLoading"
      @close="closeImage()"
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
