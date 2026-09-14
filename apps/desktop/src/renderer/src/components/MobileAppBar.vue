<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import AppIcon from "./AppIcon.vue";
import {
  useMobileShellStore,
  type MobilePane
} from "../stores/mobileShellStore";
import { useLayoutStore } from "../stores/layoutStore";

/**
 * 手机端顶栏。
 *
 * 这是应用组件树里的一个真组件 —— 早先那个 `☰` 是打包后
 * `document.body.appendChild` 上去的浮层，用户的原话是「跟原图层不是一个图层」。
 * 现在顶栏和内容一起由渲染层产出，`:root[data-mobile]` 下的样式负责让位
 * （见 styles/mobile-shell.css）。
 *
 * 桌面端不渲染任何东西（整个组件只在 data-mobile="true" 时可见）。
 */
const shell = useMobileShellStore();
const layout = useLayoutStore();

const panes: Array<{ id: MobilePane; label: string }> = [
  { id: "chat", label: "聊天" },
  { id: "writing", label: "写作" }
];

let unbindViewport: (() => void) | null = null;

onMounted(() => {
  unbindViewport = shell.bindViewport();
});

onBeforeUnmount(() => {
  unbindViewport?.();
  unbindViewport = null;
});

/**
 * 顶栏返回键。
 *
 * 三种情形，顺序不能反：
 *  1. 停在设置子页 → 退回设置的分组列表（不然直接跳出设置，用户得从头再点）；
 *  2. 停在工作区功能页（工作目录 / 长篇拆书 / 技能广场…）→ 退回对话页。
 *     ⚠️ 这一条不能少：光调 layout.showWorkspace() 只把 currentView 设成
 *     "workspace"，workspaceMainView 还停在功能页上 —— 按了等于没按，
 *     用户看到的就是「打开工作区后无法返回」；
 *  3. 其余（设置根列表 / 对话页）→ 回工作区。
 */
function goBack(): void {
  if (shell.settingsSubPageTitle) {
    shell.setSettingsSubPage("");
    return;
  }
  if (
    layout.currentView === "workspace" &&
    layout.workspaceMainView !== "conversation"
  ) {
    layout.showWorkspaceFeature("conversation");
    return;
  }
  layout.showWorkspace();
}

/** 顶栏「工作区」：整页打开工作区（工作目录 + 文件浏览）。 */
function openWorkspaceFiles(): void {
  layout.showWorkspaceFeature("directory");
}
</script>

<template>
  <header
    v-if="shell.isMobile"
    class="mobile-app-bar"
    data-testid="mobile-app-bar"
  >
    <button
      v-if="shell.detailTitle"
      class="mobile-app-bar-button"
      type="button"
      :aria-label="shell.settingsSubPageTitle ? '返回设置' : '返回工作区'"
      @click="goBack"
    >
      <AppIcon name="arrow-left" :size="20" />
    </button>
    <button
      v-else
      class="mobile-app-bar-button"
      type="button"
      :aria-label="shell.drawerOpen ? '关闭导航' : '打开导航'"
      :aria-expanded="shell.drawerOpen"
      @click="shell.toggleDrawer()"
    >
      <!-- 抽屉开着时变成 ✕（官方抽屉自己带 ✕，我们让它出现在顶栏同一个位置） -->
      <AppIcon :name="shell.drawerOpen ? 'close' : 'menu'" :size="22" />
    </button>

    <h1 v-if="shell.detailTitle" class="mobile-app-bar-title">
      {{ shell.detailTitle }}
    </h1>
    <template v-else>
      <div class="mobile-app-bar-tabs" role="tablist" aria-label="工作区视图">
        <button
          v-for="pane in panes"
          :key="pane.id"
          class="mobile-app-bar-tab"
          :class="{ 'is-active': shell.activePane === pane.id }"
          type="button"
          role="tab"
          :aria-selected="shell.activePane === pane.id"
          @click="shell.selectPane(pane.id)"
        >
          {{ pane.label }}
        </button>
        <!--
          「工作区」不是第三个 pane（它不进聊天/写作那种左右分栏），而是整页的
          功能页 —— 所以它走 layout.showWorkspaceFeature，点完顶栏会切成
          「‹ 工作区」，和设置页同一套详情页语义。
        -->
        <button
          class="mobile-app-bar-tab"
          type="button"
          aria-label="打开工作区"
          @click="openWorkspaceFiles"
        >
          工作区
        </button>
      </div>
      <!--
        右侧动作槽：对话栏把「历史对话 / 新建对话」Teleport 到这里
        （见 AgentConversation.vue）。官方手机端顶栏右侧就是这两个。
        这样顶栏只有一条，而且控件仍然由原来的组件持有状态，不用把
        会话状态提到 store 里再转发一遍。
      -->
      <div id="mobile-app-bar-actions" class="mobile-app-bar-actions" />
    </template>
  </header>

  <div
    v-if="shell.isMobile && shell.drawerOpen"
    class="mobile-scrim"
    aria-hidden="true"
    @click="shell.closeDrawer()"
  />
</template>
