<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { COMPOSER_PICKER_CONTEXT_KEY } from "../composables/composerPickerContext";
import { uiMessage } from "../ui-feedback";
import type {
  ComposerBookPickerModel,
  ComposerStagePickerModel
} from "../types/composerPicker";
import type { ResourceTreeNode } from "../types/workspace";
import AppIcon from "./AppIcon.vue";
import ComposerPickerSheet from "./ComposerPickerSheet.vue";

defineProps<{
  bookTitle: string;
  stageLabel: string;
}>();

/**
 * 两个面板的数据与切换动作由 WorkspaceShell 提供；
 * 拿不到（未打开书籍 / 素材库 / 技能库 / 只有一本书）就退化成纯展示卡片。
 */
const pickerContext = inject(COMPOSER_PICKER_CONTEXT_KEY, null);
const stagePicker = computed<ComposerStagePickerModel | undefined>(
  () => pickerContext?.stagePicker.value
);
const bookPicker = computed<ComposerBookPickerModel | undefined>(
  () => pickerContext?.bookPicker.value
);

/** 同一时刻只开一个面板。 */
const openSheet = ref<"book" | "stage" | null>(null);
const bookTrigger = ref<HTMLButtonElement | null>(null);
const stageTrigger = ref<HTMLButtonElement | null>(null);

function openPicker(sheet: "book" | "stage"): void {
  if (sheet === "book" ? bookPicker.value : stagePicker.value) {
    openSheet.value = sheet;
  }
}

/** 关掉面板并把焦点还给刚才那个触发按钮，键盘操作不会丢位置。 */
function closePicker(): void {
  const trigger = openSheet.value === "book" ? bookTrigger : stageTrigger;
  openSheet.value = null;
  trigger.value?.focus();
}

async function selectBook(node: ResourceTreeNode): Promise<void> {
  if (!pickerContext) return;
  closePicker();
  if (!(await pickerContext.selectBook(node))) {
    uiMessage.error("切换作品失败，请稍后重试");
  }
}

async function selectStage(node: ResourceTreeNode): Promise<void> {
  if (!pickerContext) return;
  closePicker();
  if (!(await pickerContext.selectStage(node))) {
    uiMessage.error("切换阶段失败，请稍后重试");
  }
}
</script>

<template>
  <div
    class="composer-context-bar"
    role="group"
    :aria-label="`当前绑定：书籍 ${bookTitle}，阶段 ${stageLabel}`"
  >
    <button
      v-if="bookPicker"
      ref="bookTrigger"
      type="button"
      class="composer-context-item composer-book-context is-interactive"
      :title="`当前书籍：${bookTitle}。点击切换作品`"
      :aria-label="`当前书籍：${bookTitle}。切换作品`"
      aria-haspopup="dialog"
      :aria-expanded="openSheet === 'book'"
      @click="openPicker('book')"
    >
      <AppIcon name="book" :size="16" />
      <strong>{{ bookTitle }}</strong>
      <AppIcon class="composer-context-chevron" name="chevron" :size="12" />
    </button>

    <div
      v-else
      class="composer-context-item composer-book-context"
      :title="`当前书籍：${bookTitle}`"
    >
      <AppIcon name="book" :size="16" />
      <strong>{{ bookTitle }}</strong>
    </div>

    <button
      v-if="stagePicker"
      ref="stageTrigger"
      type="button"
      class="composer-context-item composer-stage-context is-interactive"
      :title="`当前阶段：${stageLabel}。点击选择这本书的具体阶段`"
      :aria-label="`当前阶段：${stageLabel}。选择具体阶段`"
      aria-haspopup="dialog"
      :aria-expanded="openSheet === 'stage'"
      @click="openPicker('stage')"
    >
      <AppIcon name="wand" :size="16" />
      <strong>{{ stageLabel }}</strong>
      <AppIcon class="composer-context-chevron" name="chevron" :size="12" />
    </button>

    <div
      v-else
      class="composer-context-item composer-stage-context"
      :title="`当前阶段：${stageLabel}`"
    >
      <AppIcon name="wand" :size="16" />
      <strong>{{ stageLabel }}</strong>
    </div>

    <ComposerPickerSheet
      v-if="openSheet === 'book' && bookPicker"
      title="切换作品"
      subtitle="打开另一部作品，正文与对话一起切过去"
      :current-id="bookPicker.currentBookId"
      :entries="bookPicker.entries"
      @select="selectBook"
      @close="closePicker"
    />

    <ComposerPickerSheet
      v-if="openSheet === 'stage' && stagePicker"
      title="选择具体阶段"
      :subtitle="`${stagePicker.bookTitle} 的可用剧情与写作结构`"
      :current-id="stagePicker.currentId"
      :entries="stagePicker.entries"
      @select="selectStage"
      @close="closePicker"
    />
  </div>
</template>

<style scoped>
/* 两半变成按钮后重置原生外观，尺寸与原来的 div 保持一致。 */
.composer-context-item.is-interactive {
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  /* 只补按钮缺失的继承项，字号仍由 .composer-context-item 决定。 */
  font-family: inherit;
  line-height: inherit;
  cursor: pointer;
  border-radius: 8px;
}

.composer-context-item.is-interactive:hover > strong,
.composer-context-item.is-interactive:hover > .composer-context-chevron {
  color: var(--accent);
}

.composer-context-item.is-interactive:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.composer-context-chevron {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  transform: rotate(90deg);
}
</style>
