<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";

/**
 * 「常用目录」快捷入口。
 *
 * 由来：用户说「我想要在工作区能看到技能等其他文件」—— 而这些目录
 * （`skills` / `materials` / …）是**用到才创建**的，没建过的时候工作区就是空的，
 * 看着像坏了。这里把工作目录的约定结构直接摆出来：已有的点进去，
 * 没有的点一下就创建并进入。
 *
 * 只在工作目录根下显示（子目录里的 `skills` 是另一回事，不在这里猜）。
 */
const props = defineProps<{
  /** 当前目录下已存在的名字（用于区分「点进去」和「创建并进入」）。 */
  existing: readonly string[];
}>();

const emit = defineEmits<{
  open: [name: string];
  create: [name: string];
}>();

const folders = [
  { name: "books", label: "作品", hint: "短篇 / 剧本 / 长篇" },
  { name: "materials", label: "素材库", hint: "素材库文件" },
  { name: "skills", label: "技能库", hint: "技能定义" },
  { name: "skill-groups", label: "技能分组", hint: "" },
  { name: "material-groups", label: "素材分组", hint: "" },
  {
    name: "long-book-analysis-sources",
    label: "长篇拆书快照",
    hint: "导入来源"
  }
] as const;

const items = computed(() =>
  folders.map((folder) => ({
    ...folder,
    created: props.existing.includes(folder.name)
  }))
);
</script>

<template>
  <section class="workspace-quick-folders">
    <h3>常用目录</h3>
    <ul>
      <li v-for="item in items" :key="item.name">
        <button
          type="button"
          :class="{ 'is-missing': !item.created }"
          :aria-label="
            item.created ? `进入 ${item.label}` : `创建并进入 ${item.label}`
          "
          @click="
            item.created ? emit('open', item.name) : emit('create', item.name)
          "
        >
          <AppIcon :name="item.created ? 'folder' : 'plus'" :size="15" />
          <span class="workspace-quick-folder-label">{{ item.label }}</span>
          <span v-if="!item.created" class="workspace-quick-folder-state"
            >未创建</span
          >
        </button>
      </li>
    </ul>
  </section>
</template>
