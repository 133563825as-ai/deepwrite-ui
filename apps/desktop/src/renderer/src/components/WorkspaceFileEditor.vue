<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/**
 * 工作区文本文件编辑器：整页盖在工作区页上面。
 *
 * 只编辑文本（二进制由上层拦住），保存走原子写（Main 侧）。关掉时如果还有
 * 未保存改动会先问一句 —— 手机上没有「撤销」，误关就等于丢内容。
 */
defineProps<{
  name: string;
  content: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
}>();

const emit = defineEmits<{
  "update:content": [value: string];
  save: [];
  close: [];
}>();

function handleInput(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    emit("update:content", target.value);
  }
}

function requestClose(dirty: boolean): void {
  if (dirty && !window.confirm("还有未保存的改动，确定关闭吗？")) {
    return;
  }
  emit("close");
}
</script>

<template>
  <section class="workspace-file-editor" role="dialog" aria-label="编辑文件">
    <header class="workspace-file-editor-head">
      <button
        class="workspace-file-editor-button"
        type="button"
        aria-label="关闭"
        @click="requestClose(dirty)"
      >
        <AppIcon name="close" :size="18" />
      </button>
      <div class="workspace-file-editor-title">
        <strong>{{ name }}</strong>
        <small v-if="dirty">未保存</small>
      </div>
      <button
        class="workspace-file-editor-button is-primary"
        type="button"
        :disabled="saving || loading || !dirty"
        @click="emit('save')"
      >
        {{ saving ? "保存中…" : "保存" }}
      </button>
    </header>

    <p v-if="loading" class="workspace-files-hint">正在读取…</p>
    <textarea
      v-else
      class="workspace-file-editor-body"
      :value="content"
      spellcheck="false"
      aria-label="文件内容"
      @input="handleInput"
    />
  </section>
</template>
