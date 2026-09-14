<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/**
 * 图片预览浮层。
 *
 * 图片内容由 `workspaceFiles.readBinary` 以 base64 取回，这里只负责显示 ——
 * 页面是 http 来源，直接 `<img src="file:///sdcard/…">` 会被 WebView 拦掉。
 */
defineProps<{
  name: string;
  /** data URL；空串表示还在加载。 */
  url: string;
  loading: boolean;
}>();

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div
    class="workspace-image-backdrop"
    role="dialog"
    aria-label="图片预览"
    @click.self="emit('close')"
  >
    <div class="workspace-image-panel">
      <header>
        <span class="workspace-image-name">{{ name }}</span>
        <button
          class="workspace-image-close"
          type="button"
          aria-label="关闭预览"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="18" />
        </button>
      </header>
      <p v-if="loading" class="workspace-files-hint">正在读取…</p>
      <img v-else-if="url" :src="url" :alt="name" />
      <p v-else class="workspace-files-hint">读不到这张图片。</p>
    </div>
  </div>
</template>
