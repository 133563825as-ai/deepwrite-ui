<script setup lang="ts">
import { computed } from "vue";
import type { WorkspaceFileEntry } from "@deepwrite/contracts/renderer";
import AppIcon from "./AppIcon.vue";

/**
 * 工作区列表里的一行。
 *
 * 版式参照 RikkaHub 的工作区详情页：**两行**（名称 + 次要信息），右侧 ⋮ 出菜单。
 * 之前是一行「图标 + 名称 + 大小」，在手机上信息挤在一起，看着很简陋。
 *
 * 菜单的展开状态由父组件持有（`menuOpen`）：同一时刻只允许开一个菜单，
 * 这个状态属于列表而不是某一行。
 */
const props = defineProps<{
  entry: WorkspaceFileEntry;
  menuOpen: boolean;
}>();

const emit = defineEmits<{
  open: [];
  toggleMenu: [];
  rename: [];
  remove: [];
  copyPath: [];
}>();

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeText(modifiedAt: number | null): string {
  if (!modifiedAt) return "";
  const date = new Date(modifiedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 目录显示「文件夹」（在根下再重复一遍名字没意义），文件显示大小 + 修改时间。 */
const subtitle = computed(() => {
  if (props.entry.kind === "directory") return "文件夹";
  const parts = [sizeText(props.entry.size)];
  const time = timeText(props.entry.modifiedAt);
  if (time) parts.push(time);
  return parts.join(" · ");
});

const entryIcon = computed(() => {
  if (props.entry.kind === "directory") return "folder" as const;
  return /\.(png|jpe?g|webp|gif|bmp|avif|heic)$/iu.test(props.entry.name)
    ? ("image" as const)
    : ("file" as const);
});
</script>

<template>
  <li class="workspace-files-row">
    <button
      class="workspace-files-entry"
      type="button"
      :aria-label="`打开 ${entry.name}`"
      @click="emit('open')"
    >
      <AppIcon :name="entryIcon" :size="18" />
      <span class="workspace-files-entry-text">
        <span class="workspace-files-name">{{ entry.name }}</span>
        <span class="workspace-files-meta">{{ subtitle }}</span>
      </span>
    </button>
    <div class="workspace-files-row-menu">
      <button
        class="workspace-files-more"
        type="button"
        :aria-label="`${entry.name} 的操作`"
        :aria-expanded="menuOpen"
        @click="emit('toggleMenu')"
      >
        <AppIcon name="more" :size="16" />
      </button>
      <div v-if="menuOpen" class="workspace-files-menu">
        <button type="button" @click="emit('open')">
          <AppIcon name="file" :size="15" />打开
        </button>
        <button type="button" @click="emit('copyPath')">
          <AppIcon name="copy" :size="15" />复制相对路径
        </button>
        <button type="button" @click="emit('rename')">
          <AppIcon name="edit" :size="15" />重命名
        </button>
        <button class="is-danger" type="button" @click="emit('remove')">
          <AppIcon name="close" :size="15" />删除
        </button>
      </div>
    </div>
  </li>
</template>
