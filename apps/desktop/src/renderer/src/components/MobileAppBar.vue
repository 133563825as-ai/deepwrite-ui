<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import AppIcon from "./AppIcon.vue";
import {
  useMobileShellStore,
  type MobilePane
} from "../stores/mobileShellStore";
import { useLayoutStore } from "../stores/layoutStore";
import { useMobileBackBridge } from "../composables/useMobileBackBridge";
import { useMobilePaneSwipe } from "../composables/useMobilePaneSwipe";

/**
 * 手机端顶栏。
 *
 * 这是应用组件树里的一个真组件 —— 早先那个 `☰` 是打包后
 * `document.body.appendChild` 上去的浮层，用户的原话是「跟原图层不是一个图层」。
 * 现在顶栏和内容一起由渲染层产出，`:root[data-mobile]` 下的样式负责让位
 * （见 styles/mobile-shell.css）。
 *
 * 桌面端不渲染任何东西（整个组件只在 data-mobile="true" 时可见）。
 * 手机端的两个手势（返回桥、左右滑切栏）也挂在这里 —— 它本来就只在手机端存在，
 * 而且已经有「顶栏返回」这套同级逻辑，放两处必然漂。
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
 * 顶栏返回键 / 系统返回（手势与返回键走同一条）。
 *
 * 顺序不能反：
 *  0. 抽屉开着 → 先关抽屉（它就是当前最「上一层」的东西）；
 *  1. 停在设置子页 → 退回设置的分组列表（不然直接跳出设置，用户得从头再点）；
 *  2. 停在工作区功能页（工作目录 / 长篇拆书 / 技能广场…）→ 退回对话页。
 *     ⚠️ 这一条不能少：光调 layout.showWorkspace() 只把 currentView 设成
 *     "workspace"，workspaceMainView 还停在功能页上 —— 按了等于没按，
 *     用户看到的就是「打开工作区后无法返回」；
 *  3. 写作栏 → 回聊天栏（两栏是平级的，返回手势先回到「上一个界面」）；
 *  4. 其余（设置根列表 / 对话页）→ 回工作区。
 */
function goBack(): void {
  if (shell.drawerOpen) {
    shell.closeDrawer();
    return;
  }
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
  // ⚠️ 这一条必须在「设置 → 回工作区」之前：在设置页里按返回应该离开设置，
  // 而不是先偷偷把栏切了。
  if (layout.currentView === "settings") {
    layout.showWorkspace();
    return;
  }
  if (layout.currentView === "workspace" && shell.activePane === "writing") {
    shell.selectPane("chat");
    return;
  }
  layout.showWorkspace();
}

/**
 * 「现在按返回键，App 内还能不能退一级」—— 必须与 `goBack()` 一一对应：
 * 这里说能退，`goBack()` 就必须真的退得动；两边不一致用户就会看到
 * 「按了没反应」或「莫名退出」（§13.2 的教训）。
 * 全 false = 已经在最外层（对话页的聊天栏），交给系统退出 App。
 */
const canGoBack = computed(
  () =>
    shell.isMobile &&
    (shell.drawerOpen ||
      Boolean(shell.settingsSubPageTitle) ||
      layout.currentView === "settings" ||
      (layout.currentView === "workspace" &&
        layout.workspaceMainView !== "conversation") ||
      shell.activePane === "writing")
);

useMobileBackBridge({
  enabled: () => shell.isMobile,
  canGoBack: () => canGoBack.value,
  goBack
});

// 左右滑切栏：抽屉开着或停在整页详情/设置时不生效，免得和别的滑动打架。
useMobilePaneSwipe({
  enabled: () =>
    shell.isMobile &&
    !shell.drawerOpen &&
    layout.currentView === "workspace" &&
    layout.workspaceMainView === "conversation",
  current: () => shell.activePane,
  select: (pane) => shell.selectPane(pane)
});
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
          ⚠️ 顶栏这里**不放**「工作区」入口（用户：「首页上面的排版不好看，把工作区去掉，
          只保留设置里面的」）。两个原因：
            1. 它不是同类 tab —— 聊天/写作切的是左右分栏（activePane），工作区是整页跳转
               （layout.showWorkspaceFeature），塞进 role="tablist" 语义就是错的；
            2. 三个中文标签挤在顶栏里会各自折成两行（聊/天、工/作/区）。
          入口保留在「设置 → 工作目录」（SettingsGroupedList），抽屉里也有一份。
        -->
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
