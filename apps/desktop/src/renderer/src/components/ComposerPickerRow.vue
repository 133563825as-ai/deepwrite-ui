<script setup lang="ts">
import type { ComposerPickerItem } from "../types/composerPicker";
import type { ResourceTreeNode } from "../types/workspace";
import AppIcon from "./AppIcon.vue";

/**
 * 「书籍 / 阶段」面板里的一行，**自己递归渲染子行**。
 *
 * 为什么单独一个组件：面板里那棵树深度不固定
 * （`正文 → 第一卷 → 第一章` 就是三层），模板里没法自我递归。
 * 结构与左侧栏一致：有子项 → caret 展开；叶子行 → 点它就是选中。
 *
 * 递归自引用靠 `name` + 组件自身（`<ComposerPickerRow>` 在模板里用自己）。
 */
defineOptions({ name: "ComposerPickerRow" });

const props = defineProps<{
  entry: ComposerPickerItem;
  /** 当前选中项 id：命中就打勾高亮。 */
  currentId?: string;
  /** 已经展开的行 id。 */
  expandedIds: readonly string[];
  depth: number;
}>();

const emit = defineEmits<{
  select: [node: ResourceTreeNode];
  toggle: [id: string];
}>();

function isExpanded(): boolean {
  return props.expandedIds.includes(props.entry.id);
}

function isCurrent(): boolean {
  return props.currentId !== undefined && props.currentId === props.entry.id;
}

function choose(): void {
  if (!props.entry.selectable) {
    emit("toggle", props.entry.id);
    return;
  }
  emit("select", props.entry.node);
}
</script>

<template>
  <div class="composer-picker-row" :class="{ 'is-nested': depth > 0 }">
    <button
      v-if="entry.items.length"
      type="button"
      class="composer-picker-caret"
      :class="{ 'is-expanded': isExpanded() }"
      :aria-expanded="isExpanded()"
      :aria-label="`${isExpanded() ? '收起' : '展开'}${entry.label}`"
      @click="emit('toggle', entry.id)"
    >
      <AppIcon name="chevron" :size="12" />
    </button>
    <span v-else class="composer-picker-caret is-placeholder" aria-hidden="true" />
    <button
      type="button"
      class="composer-picker-select"
      :class="{ 'is-current': isCurrent() }"
      :aria-current="isCurrent() ? 'true' : undefined"
      @click="choose"
    >
      <AppIcon
        v-if="entry.node.icon"
        class="composer-picker-icon"
        :name="entry.node.icon"
        :size="16"
      />
      <span class="composer-picker-label">{{ entry.label }}</span>
      <span v-if="entry.badge" class="composer-picker-badge">{{
        entry.badge
      }}</span>
      <!-- 分组行的 badge 本身就是数量（长篇的世界观 7 / 正文 1…），
           再显示子项数就重复了，官方端也只给一个数。 -->
      <span
        v-if="entry.items.length && !entry.badge"
        class="composer-picker-count"
        >{{ entry.items.length }}</span
      >
      <AppIcon
        v-if="isCurrent()"
        class="composer-picker-check"
        name="check"
        :size="14"
      />
    </button>
  </div>

  <div
    v-if="entry.items.length && isExpanded()"
    class="composer-picker-children"
  >
    <ComposerPickerRow
      v-for="child in entry.items"
      :key="child.id"
      :entry="child"
      :current-id="currentId"
      :expanded-ids="expandedIds"
      :depth="depth + 1"
      @select="emit('select', $event)"
      @toggle="emit('toggle', $event)"
    />
  </div>
</template>

<style scoped>
.composer-picker-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.composer-picker-caret {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 26px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.composer-picker-caret > svg {
  transition: transform 0.15s ease;
}

.composer-picker-caret.is-expanded > svg {
  transform: rotate(90deg);
}

.composer-picker-caret:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.composer-picker-caret.is-placeholder {
  visibility: hidden;
}

.composer-picker-select {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.928571rem;
  text-align: left;
  cursor: pointer;
}

.composer-picker-select:hover {
  background: var(--surface-hover);
}

.composer-picker-select.is-current {
  background: var(--surface-selected);
  color: var(--accent);
  font-weight: 560;
}

.composer-picker-icon {
  flex: 0 0 auto;
  color: var(--text-tertiary);
}

.composer-picker-select.is-current .composer-picker-icon {
  color: var(--accent);
}

.composer-picker-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-picker-badge,
.composer-picker-count {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 0.785714rem;
  font-weight: 400;
}

.composer-picker-badge {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  font-size: 0.714286rem;
}

.composer-picker-check {
  flex: 0 0 auto;
  color: var(--accent);
}

.composer-picker-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 22px;
}
</style>
