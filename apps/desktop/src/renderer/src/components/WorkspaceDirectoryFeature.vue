<script setup lang="ts">
import { ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import WorkspaceFilesBrowser from "./WorkspaceFilesBrowser.vue";
import type { WorkspaceFilesApi } from "../composables/useWorkspaceFiles";

/**
 * 手机端「工作区」页。
 *
 * 它由两块组成：
 *  1. **工作目录卡片** —— 保留原来的职责（决定以后新建/导入项目的落点，可切换）；
 *  2. **文件浏览** —— 浏览 / 打开 / 新建 / 重命名 / 删除工作目录里的文件。
 *
 * 合并成一个页面的原因见交接文档：原来「工作目录」只做第 1 件事，用户要的是
 * 一个能看见、能读写的工作区（原话：「工作区太粗糙了」）。
 *
 * ⚠️ 文件操作都走 Main 的 `workspaceFiles.*` 命令，这一层不碰 fs。
 */
const props = defineProps<{
  path: string | null;
  loading: boolean;
  /** 工作区文件命令的入口；不传就从 window.deepwrite 取。 */
  api?: () => WorkspaceFilesApi | undefined;
}>();

const emit = defineEmits<{
  choose: [];
}>();

const browser = ref<InstanceType<typeof WorkspaceFilesBrowser> | null>(null);

function filesApi(): WorkspaceFilesApi | undefined {
  if (props.api) return props.api();
  return window.deepwrite?.workspaceFiles;
}

// 切换工作目录之后，文件列表得跟着换根。
watch(
  () => props.path,
  () => {
    void browser.value?.refresh();
  }
);
</script>

<template>
  <section class="workspace-settings-panel">
    <header>
      <div>
        <span class="dialog-eyebrow">DeepWrite</span>
        <h2>工作区</h2>
      </div>
    </header>

    <div class="dialog-content">
      <p class="dialog-description">
        这里决定以后新建和导入项目的默认位置。切换目录不会移动或影响已经打开的书籍、素材库和技能库。
      </p>
      <div class="directory-card">
        <AppIcon name="directory" :size="20" />
        <div>
          <strong>{{ path ? "当前工作目录" : "尚未选择工作目录" }}</strong>
          <code>{{ path ?? "首次创建或导入时也会提示选择" }}</code>
        </div>
        <span>{{ path ? "已启用" : "待设置" }}</span>
      </div>
      <div class="dialog-note">
        新书和旧版导入保存在 books，新素材库保存在 materials，新技能库保存在
        skills；长篇拆书导入快照保存在 long-book-analysis-sources。项目仍采用
        deepwrite.json + Markdown 文件结构，可由 Git 或同步盘直接管理。
      </div>
      <div class="dialog-actions">
        <button
          class="dialog-primary-button"
          type="button"
          :disabled="loading"
          @click="emit('choose')"
        >
          {{ loading ? "选择中…" : path ? "切换工作目录" : "选择工作目录" }}
        </button>
      </div>

      <WorkspaceFilesBrowser ref="browser" :api="filesApi" />
    </div>
  </section>
</template>
