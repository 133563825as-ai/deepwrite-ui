<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties
} from "vue";
import { createId } from "@deepwrite/shared";
import AppIcon from "./AppIcon.vue";
import { useNarrowPopupMode } from "../composables/useNarrowPopupMode";
import { resolveMenuPlacement } from "../utils/anchoredMenuPlacement";

/**
 * 输入框底行那个「更多」。
 *
 * 桌面端它**不是弹层**：容器够宽时，槽里的控件（上下文用量 / 团队模式 / 修改权限）
 * 直接内联在工具条里，触发按钮 `display: none`（见下面 `@container composer`）。
 * 只有窄容器（手机）才收成一个按钮 + 浮层。
 *
 * ⚠️ 浮层在窄容器下**必须 Teleport 到 body**。原先它是 `position: absolute`
 * 相对 `.composer-toolbar` 朝上弹，而手机端 `.composer-toolbar` 是
 * `overflow-x: auto` —— CSS 规范规定一个轴为 auto 时另一个轴不能再是 visible
 * （计算成 auto），于是浮层整个被工具条裁掉，用户看到的就是
 * **「点了没反应」**（真机复现，与 §20.3 抽屉「+」菜单被裁是同一类病根）。
 *
 * 落点交给 `utils/anchoredMenuPlacement.ts` 真实测量，不再写死方向。
 */
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const panelId = createId("composer-settings");
const panelStyle = ref<CSSProperties>({});
const { narrow } = useNarrowPopupMode({ anchor: root });
let observer: ResizeObserver | undefined;

function close(returnFocus = false): void {
  // Close teleported child menus before their triggers become hidden.
  panel.value
    ?.querySelectorAll('.composer-settings-panel [aria-expanded="true"]')
    .forEach((control) => {
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
  open.value = false;
  panelStyle.value = {};
  if (returnFocus) void nextTick(() => trigger.value?.focus());
}

function belongsToSettings(target: Node): boolean {
  if (root.value?.contains(target)) return true;
  // 浮层被 Teleport 到 body 之后不在 root 里了，得单独认。
  if (panel.value?.contains(target)) return true;
  // PopupSelect teleports its menu to body; keep the parent disclosure open.
  return [...(panel.value?.querySelectorAll("[aria-controls]") ?? [])].some(
    (control) => {
      const id = control.getAttribute("aria-controls");
      return id && document.getElementById(id)?.contains(target);
    }
  );
}

function handleOutsideEvent(event: Event): void {
  if (event.target instanceof Node && !belongsToSettings(event.target)) close();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    event.stopPropagation();
    close(true);
  }
}

/** 视口变了落点就作废，直接收起来，免得浮层悬在半空。 */
function handleViewportChange(): void {
  if (open.value && narrow.value) close();
}

/**
 * 滚动同样会让锚点跑掉。但**浮层内部的滚动不算** —— 槽里的 PopupSelect
 * 菜单是可滚动的，滚动它不该把「更多」一起关掉。
 */
function handleViewportScroll(event: Event): void {
  if (!open.value || !narrow.value) return;
  const target = event.target;
  if (target instanceof Node && panel.value?.contains(target)) return;
  close();
}

/** 量一次浮层尺寸，交给共用的落点函数（优先向下 → 放不下向上 → 再放不下自己滚）。 */
function placePanel(): void {
  const anchorEl = trigger.value;
  const panelEl = panel.value;
  if (!anchorEl || !panelEl) return;
  const anchor = anchorEl.getBoundingClientRect();
  const placement = resolveMenuPlacement({
    anchor: {
      top: anchor.top,
      left: anchor.left,
      right: anchor.right,
      bottom: anchor.bottom,
      width: anchor.width,
      height: anchor.height
    },
    menu: {
      width: panelEl.getBoundingClientRect().width,
      // scrollHeight 是内容高度：即使上一轮被 max-height 夹过也拿得到真实值。
      height: panelEl.scrollHeight
    },
    container: {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    },
    gap: 8
  });
  panelStyle.value = {
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    maxHeight: `${placement.maxHeight}px`
  };
}

async function toggle(): Promise<void> {
  if (open.value) {
    close();
    return;
  }
  open.value = true;
  if (!narrow.value) return;
  await nextTick();
  placePanel();
}

watch(narrow, () => close());

onMounted(() => {
  document.addEventListener("pointerdown", handleOutsideEvent);
  document.addEventListener("focusin", handleOutsideEvent);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", handleViewportChange);
  window.addEventListener("scroll", handleViewportScroll, true);
  const toolbar = root.value?.closest(".composer-toolbar");
  observer = new ResizeObserver(() => close());
  if (toolbar) observer.observe(toolbar);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutsideEvent);
  document.removeEventListener("focusin", handleOutsideEvent);
  document.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("resize", handleViewportChange);
  window.removeEventListener("scroll", handleViewportScroll, true);
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="root"
    class="composer-more-settings"
    :class="{ 'is-open': open, 'is-narrow': narrow }"
  >
    <button
      ref="trigger"
      class="composer-more-trigger"
      type="button"
      aria-label="更多聊天设置"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <AppIcon name="more" :size="16" />
      <span>更多</span>
    </button>
    <!--
      窄容器：Teleport 到 body（任何祖先的 overflow 都裁不到它）+ 固定定位。
      宽容器：`:disabled` 保持原样内联，DOM 与样式与改动前完全一致。
    -->
    <Teleport to="body" :disabled="!narrow">
      <div
        v-if="!narrow || open"
        :id="panelId"
        ref="panel"
        class="composer-settings-panel"
        :class="{ 'is-floating': narrow }"
        :style="narrow ? panelStyle : undefined"
        aria-label="聊天设置"
      >
        <slot />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.composer-more-settings,
.composer-settings-panel {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.composer-more-trigger {
  display: none;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 7px;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 0.75rem;
  white-space: nowrap;
  cursor: pointer;
}

.composer-more-trigger:hover,
.is-open > .composer-more-trigger {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.composer-more-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Keep the font-scaled breakpoint below the composer's 760px content cap. */
@container composer (max-width: min(32rem, 560px)) {
  .composer-more-trigger {
    display: flex;
  }
}

/*
 * 浮层形态。**不能写在容器查询里** —— Teleport 到 body 之后元素已经不在
 * `.composer-wrap` 里，`@container composer` 不再匹配。落点（top / left /
 * max-height）由 `placePanel()` 逐次量出来，写在行内样式上。
 */
.composer-settings-panel.is-floating {
  position: fixed;
  z-index: 60;
  display: grid;
  justify-items: start;
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 16px);
  overflow: auto;
  padding: 8px;
  border: 1px solid var(--theme-line);
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: 0 8px 24px var(--shadow-color);
}
</style>
