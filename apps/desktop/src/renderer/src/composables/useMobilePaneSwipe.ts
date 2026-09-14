import { onBeforeUnmount, onMounted } from "vue";
import type { MobilePane } from "../stores/mobileShellStore";

/**
 * 手机端「左右滑切换 聊天 / 写作」。
 *
 * 用户要求：「从聊天到写作，目前是只能通过点击，我想要往左滑」。
 *
 * 三条硬规则（不遵守就会误触发，比不做还糟）：
 *  1. **只认内容区**（`SURFACE_SELECTOR`）—— 顶栏、抽屉、弹窗上左右滑不该切栏；
 *  2. **起手落在会横向滚动或要选文字的地方不算**（输入框底行、textarea、弹窗…），
 *     否则用户在工具条上横向滚列表就被当成切栏；
 *  3. **方向锁定**：横向位移要明显大于纵向（1.2 倍），否则是竖向滚动，直接放弃。
 *
 * 只做 chat ↔ writing 两栏，所以「左滑只在 chat 生效、右滑只在 writing 生效」——
 * 不会出现滑一下跳过两栏。
 */
export interface MobilePaneSwipeOptions {
  /** 现在是不是手机壳、且允许手势（抽屉开着、在设置页时应当为 false）。 */
  enabled: () => boolean;
  current: () => MobilePane;
  select: (pane: MobilePane) => void;
}

/** 起手落在这些元素里就不算切栏手势。 */
const IGNORE_SELECTOR = [
  "textarea",
  "input",
  "[contenteditable='true']",
  ".composer-wrap",
  ".composer-toolbar",
  ".mobile-app-bar",
  ".popup-select-menu",
  ".workspace-dialog",
  ".workspace-files-menu",
  ".workspace-files-dialog",
  ".editor-selection-menu"
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
/** 横向位移超过它才算一次切换。 */
const SWIPE_THRESHOLD = 60;

export function useMobilePaneSwipe(options: MobilePaneSwipeOptions): void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let horizontal = false;
  let decided = false;

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
    tracking = true;
  }

  function onTouchMove(event: TouchEvent): void {
    if (!tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (decided) return;
    if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
    decided = true;
    horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    // 判定成纵向就整轮放弃，不再看后面的位移。
    if (!horizontal) reset();
  }

  function onTouchEnd(event: TouchEvent): void {
    if (!tracking || !horizontal) {
      reset();
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch ? touch.clientX - startX : 0;
    const current = options.current();
    if (dx <= -SWIPE_THRESHOLD && current === "chat") {
      options.select("writing");
    } else if (dx >= SWIPE_THRESHOLD && current === "writing") {
      options.select("chat");
    }
    reset();
  }

  onMounted(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
  });

  onBeforeUnmount(() => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", reset);
  });
}
