import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useLayoutStore } from "./layoutStore";
import { workspaceFeatureTitle } from "./layoutFeatureNavigation";

/**
 * 手机端外壳状态。
 *
 * 为什么单开一个 store：手机端布局原先是「打包之后往 HTML 里注入 CSS + 往
 * document.body 上 appendChild 一个悬浮按钮」。那不叫适配，是补丁 —— 按钮不在
 * 组件树里（用户原话「跟原图层不是一个图层」），布局靠 !important 硬掰，
 * 桌面样式一改就崩。
 *
 * 现在把手机端当成渲染层的一种布局模式：状态集中在这里，由它写 <html> 上的
 * data 属性，样式集中在 styles/mobile-shell.css（只认这些属性，不再用裸 @media，
 * 免得和桌面规则互相打架）。
 */
export type MobilePane = "chat" | "writing";

const MOBILE_QUERY = "(max-width: 1024px)";

function matchMobile(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(MOBILE_QUERY).matches;
}

export const useMobileShellStore = defineStore("mobileShell", () => {
  const layout = useLayoutStore();

  const isMobile = ref(matchMobile());
  /** 顶栏两个 tab：聊天（conversation-pane）/ 写作（editor-pane）。 */
  const activePane = ref<MobilePane>("chat");
  const drawerOpen = ref(false);

  /**
   * 设置子页的标题。空串 = 停在设置的分组列表根（顶栏显示「设置」）。
   *
   * 由 SettingsPage 在选中分类时写入；MobileAppBar 的返回键据它决定这一下是
   * 「回到设置列表」还是「回到工作区」—— 不这样收口的话，子页里按返回会直接
   * 跳出设置，用户得重新点一遍。
   */
  const settingsSubPageTitle = ref("");

  function setSettingsSubPage(title: string): void {
    settingsSubPageTitle.value = title;
  }

  /** 设置这类详情页在手机上是整页，顶栏换成「‹ 标题」。 */
  const detailTitle = computed(() => {
    if (layout.currentView === "settings") {
      return settingsSubPageTitle.value || "设置";
    }
    // 工作区里的功能页（工作目录 / 长篇拆书 / 技能广场…）在手机上同样是整页
    // 盖住对话，所以也得给「‹ 标题」。
    //
    // ⚠️ 这里漏了的话用户会**卡死在功能页里**：顶栏只剩「聊天 / 写作」两个 tab，
    // 而切 tab 只改 activePane、不改 workspaceMainView，屏幕上什么都不变
    //（用户原话：「打开工作区后无法返回」）。
    return workspaceFeatureTitle(layout.workspaceMainView);
  });

  // 离开设置就清掉子页状态，否则下次进来会直接停在上一轮那个子页上。
  //
  // ⚠️ 这里必须同时盯 `workspaceMainView`，只盯 `currentView` 是不够的：
  // 抽屉里点「工作区」和全部「更多功能」（修改分析 / 短篇拆书分析 / 技能广场…）
  // 走的都是 `workspaceMainView`，`currentView` 本来就已经是 `workspace`，
  // **值没变 → watch 不触发 → 抽屉一直开着**。用户看到的是「点了没反应」：
  // 页面其实已经在抽屉后面打开了，得再点一次 ✕ 或遮罩才看得见。
  //（`currentView` 只覆盖「设置」那一路，2026-09-15 手机上 9/9 个导航项都复现过。）
  watch(
    [() => layout.currentView, () => layout.workspaceMainView],
    ([view]) => {
      if (view !== "settings") settingsSubPageTitle.value = "";
      // 从抽屉里导航走之后必须把抽屉关上。
      //
      // 抽屉的遮罩是 `position: fixed; inset: 0; z-index: 65` 的一层半透明黑，
      // 不关的话新页面整个是灰的，而且**第一下点击会被遮罩吃掉** ——
      // 用户看到的就是「设置是灰的，得先随便点一下才恢复正常、才能点里面的功能」。
      // 这些导航只改 store 里的视图状态、不碰抽屉，所以收口在这里，
      // 不要指望每个导航入口自己记得关。
      closeDrawer();
    }
  );

  function openDrawer(): void {
    drawerOpen.value = true;
  }

  function closeDrawer(): void {
    drawerOpen.value = false;
  }

  function toggleDrawer(): void {
    drawerOpen.value = !drawerOpen.value;
  }

  function selectPane(pane: MobilePane): void {
    activePane.value = pane;
    closeDrawer();
  }

  function syncRootAttributes(): void {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (isMobile.value) {
      root.dataset.mobile = "true";
    } else {
      delete root.dataset.mobile;
    }
    root.dataset.mobilePane = activePane.value;
    root.dataset.mobileDrawer = drawerOpen.value ? "open" : "closed";
  }

  watch([isMobile, activePane, drawerOpen], syncRootAttributes, {
    immediate: true
  });

  // 手机上侧栏始终挂载、由 CSS 平移进出，所以不能让它被 leftCollapsed 卸载掉
  // （那个状态是桌面「收起左栏」的语义，两回事）。
  watch(
    isMobile,
    (mobile) => {
      if (mobile) {
        layout.leftCollapsed = false;
        drawerOpen.value = false;
      }
    },
    { immediate: true }
  );

  /** 监听视口变化。返回解绑函数，由外壳组件在卸载时调用。 */
  function bindViewport(): () => void {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return () => {};
    }
    const query = window.matchMedia(MOBILE_QUERY);
    const update = (matches: boolean): void => {
      isMobile.value = matches;
    };
    update(query.matches);
    const listener = (event: MediaQueryListEvent): void =>
      update(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }

  return {
    isMobile,
    activePane,
    drawerOpen,
    detailTitle,
    settingsSubPageTitle,
    setSettingsSubPage,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    selectPane,
    bindViewport
  };
});
