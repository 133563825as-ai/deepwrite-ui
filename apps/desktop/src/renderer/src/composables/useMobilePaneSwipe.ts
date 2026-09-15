import { onBeforeUnmount, onMounted } from "vue";
import type { MobilePane } from "../stores/mobileShellStore";

/**
 * 手机端「左右滑切换 聊天 / 写作」——**跟手滑动 + 松手吸附**。
 *
 * 用户两次提这条：
 *   1. 「从聊天到写作，目前是只能通过点击，我想要往左滑」；
 *   2. 「现在只能从聊天到写作，反过来不行，而且切换的很垃圾，跟点击页面有什么区别？
 *       我想要的是滑过去，原版 APP 有这个功能」。
 *
 * 原版（官方安卓包，React Native）用的是 `PagerView` + `PanResponder`：
 * 手指拖到哪页面跟到哪，松手按位移/速度吸附到相邻一格。这里照同一套行为做。
 *
 * ⚠️ 老实现有两个真问题，别再踩回去：
 *  1. **反向滑不动**：它把「起手点落在 textarea / contenteditable / .composer-wrap」
 *     一律当成非手势。可写作栏**整屏都是编辑器**，于是从写作回聊天几乎不可能命中。
 *     现在只排除「必须横向滚动的工具条 / 弹层 / 抽屉」，编辑器本体允许起手。
 *  2. **没有跟手**：老实现只在 `touchend` 判一次阈值就 `select()`，所以手感等于点了一下。
 *     现在 `touchmove` 里实时写 `--mobile-pane-shift`，页面跟着手指走。
 *
 * 方向锁定仍然是硬规则：横向位移必须明显大于纵向（1.5 倍），否则判成竖向滚动直接放弃。
 */

export interface MobilePaneSwipeOptions {
  /** 现在是不是手机壳、且允许手势（抽屉开着、在设置页时为 false）。 */
  enabled: () => boolean;
  current: () => MobilePane;
  /** 点击顶栏 tab 用：直接吸附到目标栏。 */
  select: (pane: MobilePane) => void;
  /** 手指按下、准备跟手（此时先不动画面）。 */
  begin: () => void;
  /** 跟手位移：0 = 聊天，1 = 写作。 */
  drag: (shift: number) => void;
  /** 松手吸附到目标栏（带过渡动画）。 */
  settle: (pane: MobilePane) => void;
}

/**
 * 起手落在这些地方就不算切栏手势。
 *
 * ⚠️ 刻意**不包含** `textarea` / `input` / `[contenteditable]` / `.composer-wrap`：
 * 写作栏整屏是编辑器，排除它们等于把「回聊天」这条路堵死（老实现就是这么坏的）。
 * 这里只留「本身就要横向滚动或本来就是浮层」的东西。
 */
const IGNORE_SELECTOR = [
  ".composer-toolbar",
  ".mobile-app-bar",
  ".left-sidebar",
  ".mobile-scrim",
  ".popup-select-menu",
  ".popup-select-control",
  ".workspace-dialog",
  ".workspace-files-menu",
  ".workspace-files-dialog",
  ".editor-selection-menu",
  "[data-mobile-swipe-ignore]",
  "[role='dialog']"
].join(", ");

/** 只在这些容器里认手势（左右分栏的真正内容区）。 */
const SURFACE_SELECTOR = [
  ".conversation-pane",
  ".editor-pane",
  ".long-workspace-editor",
  ".long-agent-column"
].join(", ");

/** 超过它才判定「这是横向还是纵向」。 */
const DIRECTION_LOCK = 12;
/** 横向要明显大于纵向 —— 否则是竖向滚列表。 */
const DIRECTION_RATIO = 1.5;
/** 松手时超过屏宽这个比例就翻页。 */
const SNAP_RATIO = 0.28;
/** 甩动速度（px/ms）超过它也算翻页，慢拖一小段不算。 */
const FLING_VELOCITY = 0.45;

export function useMobilePaneSwipe(options: MobilePaneSwipeOptions): void {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastX = 0;
  let lastTime = 0;
  let tracking = false;
  let horizontal = false;
  let decided = false;
  let baseShift = 0;

  function reset(): void {
    tracking = false;
    horizontal = false;
    decided = false;
  }

  function onTouchStart(event: TouchEvent): void {
    reset();
    if (!options.enabled() || event.touches.length !== 1) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(IGNORE_SELECTOR)) return;
    if (!target.closest(SURFACE_SELECTOR)) return;
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    lastX = startX;
    startTime = event.timeStamp;
    lastTime = startTime;
    baseShift = options.current() === "writing" ? 1 : 0;
    tracking = true;
  }

  function onTouchMove(event: TouchEvent): void {
    if (!tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK)
        return;
      decided = true;
      horizontal = Math.abs(dx) > Math.abs(dy) * DIRECTION_RATIO;
      if (!horizontal) {
        reset();
        return;
      }
      // 判定成横向了才开始跟手（之前一点都不能动，免得竖向滚动时页面歪一下）。
      options.begin();
    }
    if (!horizontal) return;
    lastX = touch.clientX;
    lastTime = event.timeStamp;
    const width = window.innerWidth || 1;
    // 往左拖（dx < 0）→ 露出写作栏 → shift 变大。
    options.drag(baseShift - dx / width);
  }

  function onTouchEnd(event: TouchEvent): void {
    if (!tracking || !horizontal) {
      reset();
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch ? touch.clientX - startX : 0;
    const width = window.innerWidth || 1;
    const span = lastTime > startTime ? lastTime - startTime : 0;
    const velocity = span > 0 ? (lastX - startX) / span : 0;
    const flicked =
      Math.abs(velocity) >= FLING_VELOCITY && Math.abs(dx) > DIRECTION_LOCK;
    const far = Math.abs(dx) >= width * SNAP_RATIO;
    if (flicked || far) {
      // 往左 → 写作；往右 → 聊天。两侧对称，不再有「只有一边能用」。
      options.settle(dx < 0 ? "writing" : "chat");
    } else {
      options.settle(baseShift >= 0.5 ? "writing" : "chat");
    }
    reset();
  }

  onMounted(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });
  });

  onBeforeUnmount(() => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchEnd);
  });
}
