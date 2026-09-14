<script setup lang="ts">
/**
 * 字数显示。
 *
 * 抽成单独组件是因为它有两个落点：桌面在底栏 `.editor-footer-meta`，手机端按
 * 官方放在工具条最右侧（官方写作页：`编辑 · 预览 ｜ ↺ ↻ 🔍 ⇄ ｜……｜ 6 字`）。
 * 两处共用同一个组件，千分位和「/ 建议上限」的格式才不会各写一遍、各走各的样。
 *
 * 纯展示组件，不知道自己在桌面还是手机 —— 显隐由父级决定
 * （见 RightEditorPane.vue 与 styles/mobile-shell.css）。
 */
const props = defineProps<{
  count: number;
  /** 素材库 / 技能库条目的建议上限，只有库文档才有，普通文稿不传。 */
  recommended?: number;
}>();
</script>

<template>
  <span class="editor-character-count">
    {{ props.count.toLocaleString("zh-CN")
    }}<template v-if="props.recommended">
      / {{ props.recommended.toLocaleString("zh-CN") }}</template
    >
    字
  </span>
</template>
