<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createId } from "@deepwrite/shared";
import type {
  ComposerPickerEntry,
  ComposerPickerItem
} from "../types/composerPicker";
import type { ResourceTreeNode } from "../types/workspace";
import AppIcon from "./AppIcon.vue";

/**
 * 输入框卡片两个半边的通用底部面板：书籍列表与阶段列表都用它。
 * 只负责渲染一组行（可展开的分组 + 叶子行）并回报选中的节点，
 * 选中之后到底切什么由调用方决定。
 */
const props = defineProps<{
  title: string;
  subtitle?: string;
  /** 当前选中行的 id，用于打勾高亮。 */
  currentId?: string;
  entries: readonly ComposerPickerEntry[];
}>();

const emit = defineEmits<{
  select: [node: ResourceTreeNode];
  close: [];
}>();

const titleId = createId("composer-picker-title");
const sheet = ref<HTMLElement | null>(null);
const collapsedIds = ref<readonly string[]>([]);

function isExpanded(entry: ComposerPickerEntry): boolean {
  return !collapsedIds.value.includes(entry.id);
}

function toggleGroup(entry: ComposerPickerEntry): void {
  collapsedIds.value = isExpanded(entry)
    ? [...collapsedIds.value, entry.id]
    : collapsedIds.value.filter((id) => id !== entry.id);
}

function isCurrent(id: string): boolean {
  return props.currentId === id;
}

function chooseEntry(entry: ComposerPickerEntry): void {
  if (!entry.selectable) {
    toggleGroup(entry);
    return;
  }
  emit("select", entry.node);
}

function chooseItem(item: ComposerPickerItem): void {
  emit("select", item.node);
}

onMounted(() => {
  sheet.value?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div class="composer-picker-backdrop" @click="emit('close')">
      <section
        ref="sheet"
        class="composer-picker-sheet"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @click.stop
        @keydown.esc.stop.prevent="emit('close')"
      >
        <header class="composer-picker-head">
          <div class="composer-picker-heading">
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="subtitle">{{ subtitle }}</p>
          </div>
          <button
            type="button"
            class="composer-picker-close"
            :aria-label="`关闭${title}`"
            @click="emit('close')"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </header>

        <div class="composer-picker-tree" role="group" :aria-label="title">
          <template v-for="entry in entries" :key="entry.id">
            <div class="composer-picker-row">
              <button
                v-if="entry.items.length"
                type="button"
                class="composer-picker-caret"
                :class="{ 'is-expanded': isExpanded(entry) }"
                :aria-expanded="isExpanded(entry)"
                :aria-label="`${isExpanded(entry) ? '收起' : '展开'}${entry.label}`"
                @click="toggleGroup(entry)"
              >
                <AppIcon name="chevron" :size="12" />
              </button>
              <span
                v-else
                class="composer-picker-caret is-placeholder"
                aria-hidden="true"
              />
              <button
                type="button"
                class="composer-picker-select"
                :class="{ 'is-current': isCurrent(entry.id) }"
                :aria-current="isCurrent(entry.id) ? 'true' : undefined"
                @click="chooseEntry(entry)"
              >
                <span class="composer-picker-label">{{ entry.label }}</span>
                <span v-if="entry.badge" class="composer-picker-badge">{{
                  entry.badge
                }}</span>
                <span v-if="entry.items.length" class="composer-picker-count">{{
                  entry.items.length
                }}</span>
                <AppIcon
                  v-if="isCurrent(entry.id)"
                  class="composer-picker-check"
                  name="check"
                  :size="14"
                />
              </button>
            </div>

            <div
              v-if="entry.items.length && isExpanded(entry)"
              class="composer-picker-children"
            >
              <div
                v-for="item in entry.items"
                :key="item.id"
                class="composer-picker-row is-child"
              >
                <button
                  type="button"
                  class="composer-picker-select"
                  :class="{ 'is-current': isCurrent(item.id) }"
                  :aria-current="isCurrent(item.id) ? 'true' : undefined"
                  @click="chooseItem(item)"
                >
                  <span class="composer-picker-label">{{ item.label }}</span>
                  <AppIcon
                    v-if="isCurrent(item.id)"
                    class="composer-picker-check"
                    name="check"
                    :size="14"
                  />
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.composer-picker-backdrop {
  position: fixed;
  z-index: 300;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: color-mix(
    in srgb,
    var(--theme-foreground, #1a1c1f) 32%,
    transparent
  );
}

.composer-picker-sheet {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(72vh, 560px);
  padding: 14px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--theme-line);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  background: var(--surface-raised);
  box-shadow: 0 -18px 44px
    color-mix(in srgb, var(--theme-foreground, #1a1c1f) 18%, transparent);
  color: var(--text-primary);
  outline: none;
}

.composer-picker-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 2px 6px 12px;
  border-bottom: 1px solid var(--theme-line-soft);
}

.composer-picker-heading {
  min-width: 0;
}

.composer-picker-heading h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.composer-picker-heading p {
  margin: 4px 0 0;
  font-size: 0.785714rem;
  color: var(--text-tertiary);
}

.composer-picker-close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-left: auto;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.composer-picker-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.composer-picker-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: 8px 2px 2px;
}

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

.composer-picker-label {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-picker-badge {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: 0.714286rem;
  font-weight: 400;
}

.composer-picker-count {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  font-size: 0.785714rem;
  font-weight: 400;
}

.composer-picker-check {
  flex: 0 0 auto;
  color: var(--accent);
}

.composer-picker-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 28px;
}
</style>
