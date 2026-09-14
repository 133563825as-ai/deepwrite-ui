<script setup lang="ts">
import { nextTick } from "vue";
import AppIcon from "./AppIcon.vue";
import { useMobileShellStore } from "../stores/mobileShellStore";

/**
 * 「本书目录」按钮（手机端写作页）。
 *
 * 官方写作页在面包屑那一行的右侧放了一个描边胶囊，点了回到本书目录。
 * 我们这边等价动作 = 打开侧栏抽屉并滚到「创作空间」——桌面本来三栏同屏，
 * 不需要这个入口，所以整个组件只在手机端渲染。
 */
const shell = useMobileShellStore();

/** 「创作空间」区块的锚点，由 SidebarResourceList 透传到 TreeSection 根元素上。 */
const CREATION_SECTION_SELECTOR = '[data-section-id="creation"]';

async function openLibrary(): Promise<void> {
  shell.openDrawer();
  // 侧栏在手机上始终挂载（由 CSS 平移进出），所以等一帧让 data 属性与布局就位，
  // 再滚到创作空间；滚不到也不是错误，抽屉已经打开、用户能自己看到。
  await nextTick();
  document
    .querySelector(CREATION_SECTION_SELECTOR)
    ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
</script>

<template>
  <button
    v-if="shell.isMobile"
    class="editor-library-toc"
    type="button"
    aria-label="打开本书目录"
    @click="openLibrary"
  >
    <AppIcon name="book" :size="15" />
    <span>本书目录</span>
  </button>
</template>
