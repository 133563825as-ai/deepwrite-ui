<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
 *
 * ⚠️ 卡片显示的目录**以文件浏览器量到的真实根为准**：两处走的是同一个
 * 主进程存储，但渲染层这份设置值是异步加载的，历史上出现过
 * 「卡片写『尚未选择工作目录』、下面却已经在列文件了」的自相矛盾。
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
/** 文件浏览器实测到的根目录 —— 它才是「现在真正生效的那个」。 */
const browserRoot = ref<string | null>(null);

const effectivePath = computed(() => props.path ?? browserRoot.value);
/** 设置值还没到、但浏览器已经知道根目录时，不要再喊「尚未选择」。 */
const pendingChoice = computed(() => !effectivePath.value && !props.loading);
const statusText = computed(() => {
  if (effectivePath.value) return "已启用";
  return props.loading ? "读取中" : "待设置";
});

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
      <button
        class="dialog-secondary-button workspace-directory-choose"
        type="button"
        :disabled="loading"
        @click="emit('choose')"
      >
        {{ loading ? "选择中…" : effectivePath ? "切换目录" : "选择目录" }}
      </button>
    </header>

    <div class="dialog-content">
      <div class="directory-card" :class="{ 'is-pending': pendingChoice }">
        <AppIcon name="directory" :size="20" />
        <div>
          <strong>{{
            effectivePath ? "当前工作目录" : "尚未选择工作目录"
          }}</strong>
          <code>{{ effectivePath ?? "首次创建或导入时也会提示选择" }}</code>
        </div>
        <span>{{ statusText }}</span>
      </div>
      <p class="dialog-description">
        这里决定以后新建和导入项目的默认位置：books / materials / skills，
        长篇拆书快照在
        long-book-analysis-sources。变更目录不会移动已打开的作品。
      </p>

      <WorkspaceFilesBrowser
        ref="browser"
        :api="filesApi"
        @update:root="browserRoot = $event"
      />
    </div>
  </section>
</template>
