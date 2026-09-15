<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { createId } from "@deepwrite/shared";
import type {
  ComposerPickerEntry,
  ComposerPickerItem
} from "../types/composerPicker";
import type { ResourceTreeNode } from "../types/workspace";
import AppIcon from "./AppIcon.vue";
import ComposerPickerRow from "./ComposerPickerRow.vue";

/**
 * 输入框卡片两个半边的通用底部面板：书籍列表与阶段列表都用它。
 *
 * 阶段列表是一棵**可展开的树**（与官方端一致）：
 * `正文 → 第一卷 → 第一章`、`世界观 → 规则 / 势力 / …`，行尾带数量、
 * 当前项打勾，打开面板时**自动展开到当前项**，不用用户一层层点。
 */
const props = defineProps<{
  title: string;
  subtitle?: string;
  /** 当前选中行的 id，用于打勾高亮。 */
  currentId?: string;
  entries: readonly ComposerPickerEntry[];
  /**
   * 列表为空时显示这一句。空态必须由面板来解释，不能让卡片那半边
   * 变成点不动的死按钮（2026-09-15 真机反馈）。
   */
  emptyHint?: string;
}>();

const emit = defineEmits<{
  select: [node: ResourceTreeNode];
  close: [];
}>();

const titleId = createId("composer-picker-title");
const sheet = ref<HTMLElement | null>(null);
/** 折叠的行 id；默认全展开，用户收起过哪一行才记下来。 */
const collapsedIds = ref<readonly string[]>([]);

function collectExpandable(
  entries: readonly ComposerPickerItem[],
  into: string[] = []
): string[] {
  for (const entry of entries) {
    if (entry.items.length) {
      into.push(entry.id);
      collectExpandable(entry.items, into);
    }
  }
  return into;
}

function expandedIds(): readonly string[] {
  return collectExpandable(props.entries).filter(
    (id) => !collapsedIds.value.includes(id)
  );
}

function toggleGroup(id: string): void {
  collapsedIds.value = collapsedIds.value.includes(id)
    ? collapsedIds.value.filter((existing) => existing !== id)
    : [...collapsedIds.value, id];
}

/**
 * 默认展开策略（对齐官方端的观感，避免一打开就是几百行）：
 *   1. 当前项在列表里 → 展开「到它的祖先路径」+「它自己」；
 *      当前项是第一层分组时，展开的就是那个分组（官方截图里「世界观」展开就是这个）。
 *   2. 找不到当前项（例如刚打开书、还没有具体阶段）→ 只展开第一个有子项的分组。
 */
function applyDefaultExpansion(): void {
  const expandable = collectExpandable(props.entries);
  if (!props.currentId) {
    collapsedIds.value = expandable.filter(
      (id) => id !== firstExpandableId()
    );
    return;
  }
  let found = false;
  const keep = new Set<string>();
  const walk = (entries: readonly ComposerPickerItem[], path: string[]) => {
    for (const entry of entries) {
      if (entry.id === props.currentId) {
        found = true;
        for (const id of path) keep.add(id);
        if (entry.items.length) keep.add(entry.id);
      }
      if (entry.items.length) walk(entry.items, [...path, entry.id]);
    }
  };
  walk(props.entries, []);
  if (!found) {
    collapsedIds.value = expandable.filter((id) => id !== firstExpandableId());
    return;
  }
  collapsedIds.value = expandable.filter((id) => !keep.has(id));
}

function firstExpandableId(): string | undefined {
  const [first] = props.entries;
  return first?.items.length ? first.id : undefined;
}

onMounted(() => {
  sheet.value?.focus();
  applyDefaultExpansion();
});

// 面板每次换内容（切换书 / 目标）都重新按当前项展开。
watch(
  () => [props.currentId, props.entries] as const,
  () => applyDefaultExpansion()
);
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
          <p v-if="!entries.length && emptyHint" class="composer-picker-empty">
            {{ emptyHint }}
          </p>
          <ComposerPickerRow
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
            :current-id="currentId"
            :expanded-ids="expandedIds()"
            :depth="0"
            @select="emit('select', $event)"
            @toggle="toggleGroup"
          />
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

/* 空态：解释「为什么这里是空的、下一步该点什么」，而不是让入口装死。 */
.composer-picker-empty {
  margin: 4px 6px 8px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 0.857143rem;
  line-height: 1.55;
}
</style>
